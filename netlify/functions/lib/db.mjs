/**
 * Firebase Realtime Database read helper.
 *
 * Read-only on purpose: `profiles/**` rejects unauthenticated writes, so any
 * mutation has to happen in the app through the authenticated Firebase SDK.
 */

const DB_URL = "https://qwirkle-online-6ca1c-default-rtdb.europe-west1.firebasedatabase.app";

export async function dbGet(path) {
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) return null;
  return res.json();
}
