/**
 * VAPID keypair provisioning.
 *
 * Resolution order:
 *   1. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars (set these to pin the pair)
 *   2. a keypair stored in Netlify Blobs
 *   3. a freshly generated pair, persisted to Blobs for every later request
 *
 * The pair has to stay stable: browsers bind each push subscription to the
 * public key it was created with, so rotating the keys invalidates every
 * existing subscription.
 */

import { getStore } from '@netlify/blobs';
import { generateVapidKeys } from './webpush.mjs';

const STORE_NAME = 'qwirkle-config';
const BLOB_KEY = 'vapid-keys';
const DEFAULT_SUBJECT = 'mailto:admin@qwirkle.ewakon.pl';

let cached = null;

/** Resolve the VAPID keypair, or null when push cannot be configured at all. */
export async function getVapidKeys() {
  const subject = process.env.VAPID_SUBJECT || DEFAULT_SUBJECT;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject,
    };
  }

  if (cached) return { ...cached, subject };

  try {
    const store = getStore(STORE_NAME);
    let keys = await store.get(BLOB_KEY, { type: 'json' }).catch(() => null);

    if (!keys?.publicKey || !keys?.privateKey) {
      const fresh = generateVapidKeys();
      await store.setJSON(BLOB_KEY, fresh);
      // Read back, so two concurrent cold starts converge on the same winner
      // instead of each trusting the pair it generated locally.
      keys = (await store.get(BLOB_KEY, { type: 'json' }).catch(() => null)) || fresh;
    }

    cached = { publicKey: keys.publicKey, privateKey: keys.privateKey };
    return { ...cached, subject };
  } catch {
    // Blobs unavailable (e.g. plain `vite dev`) — push is simply unavailable.
    return null;
  }
}
