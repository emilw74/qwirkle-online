/**
 * Minimal Web Push sender built on Node built-ins only.
 *
 * Implements:
 *  - RFC 8291 (Message Encryption for Web Push, "aes128gcm" content encoding)
 *  - RFC 8292 (VAPID — Voluntary Application Server Identification)
 *
 * No external dependencies, so nothing new has to be bundled into the function.
 */

import crypto from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const unb64url = (str) => Buffer.from(String(str), 'base64url');

/**
 * Generate a VAPID keypair. Run once, then store the result in env vars
 * (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) — the pair must stay stable, because
 * browsers tie each push subscription to the public key it was created with.
 */
export function generateVapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });
  return {
    publicKey: b64url(Buffer.concat([
      Buffer.from([0x04]), unb64url(pubJwk.x), unb64url(pubJwk.y),
    ])),
    privateKey: privJwk.d,
  };
}

/** Rebuild a signing key from the raw base64url scalar + public point. */
function vapidKeyObject(privateKeyB64, publicKeyB64) {
  const pub = unb64url(publicKeyB64); // 0x04 || x(32) || y(32)
  return crypto.createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: privateKeyB64,
    },
  });
}

/** Build the `Authorization: vapid t=<jwt>, k=<pubkey>` header for one endpoint. */
function vapidAuthHeader(endpoint, publicKey, privateKey, subject) {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }));
  // ES256 requires the raw r||s form, not DER — hence dsaEncoding.
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), {
    key: vapidKeyObject(privateKey, publicKey),
    dsaEncoding: 'ieee-p1363',
  });
  return `vapid t=${header}.${payload}.${b64url(signature)}, k=${publicKey}`;
}

/**
 * Encrypt a payload for one subscription into an aes128gcm body.
 * Layout: salt(16) || record_size(4) || key_id_len(1) || server_public(65) || ciphertext
 */
export function encryptPayload(plaintext, uaPublicB64, authSecretB64) {
  const uaPublic = unb64url(uaPublicB64);
  const authSecret = unb64url(authSecretB64);

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const serverPublic = ecdh.getPublicKey(); // uncompressed, 65 bytes
  const sharedSecret = ecdh.computeSecret(uaPublic);

  // IKM is derived from the ECDH secret, salted with the subscription's auth secret.
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'), uaPublic, serverPublic,
  ]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));

  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
  );
  const nonce = Buffer.from(
    crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  );

  // Single record, so the padding delimiter is 0x02 ("last record").
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([Buffer.from(plaintext, 'utf8'), Buffer.from([0x02])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);

  return Buffer.concat([
    salt, recordSize, Buffer.from([serverPublic.length]), serverPublic, ciphertext,
  ]);
}

/**
 * Deliver one notification.
 * Never throws — returns a result object so a push failure can never take down
 * another notification channel.
 * `gone: true` means the subscription is dead and the caller should prune it.
 */
export async function sendPush(subscription, payload, vapid, { ttl = 3600, urgency = 'high' } = {}) {
  if (!vapid?.publicKey || !vapid?.privateKey) return { ok: false, reason: 'vapid-not-configured' };

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return { ok: false, reason: 'bad-subscription' };

  try {
    const body = encryptPayload(JSON.stringify(payload), p256dh, auth);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuthHeader(endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(ttl),
        Urgency: urgency,
      },
      body,
    });

    // 404/410 = subscription permanently gone (app uninstalled, permission revoked).
    if (res.status === 404 || res.status === 410) {
      return { ok: false, gone: true, status: res.status };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, status: res.status, detail: detail.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, reason: err?.message || 'send-failed' };
  }
}
