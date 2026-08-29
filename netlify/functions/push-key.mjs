/**
 * Netlify Function: Push Key
 *
 * GET /api/push-key → { publicKey }
 *
 * The browser needs the VAPID application server key before it can call
 * pushManager.subscribe(). The matching private key never leaves the server.
 *
 * Storing the resulting subscription is deliberately NOT done here: the
 * Realtime Database only accepts writes to `profiles/**` from an authenticated
 * client, so the app writes its own subscription with the Firebase SDK.
 */

import { getVapidKeys } from './lib/vapid.mjs';

export default async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const vapid = await getVapidKeys();

  return new Response(JSON.stringify({ publicKey: vapid?.publicKey || null }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // The key is public and stable; let browsers hold on to it.
      "Cache-Control": "public, max-age=3600",
    },
  });
};

export const config = {
  path: "/api/push-key",
};
