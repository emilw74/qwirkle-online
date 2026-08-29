/**
 * Web Push subscription handling (browser side).
 *
 * The Telegram channel is linked by opening a bot link; this channel is linked
 * by asking the browser for notification permission and storing the resulting
 * subscription against the player's uid.
 *
 * Each browser keeps a stable device id in localStorage and stores its
 * subscription under that key, so re-subscribing overwrites the same entry
 * instead of piling up stale ones, and several devices can be registered for
 * the same account at once.
 */

import {
  savePushSubscription, removePushSubscription, setPushNotifications,
} from '../firebase/gameService';

const KEY_ENDPOINT = '/api/push-key';
const DEVICE_ID_KEY = 'qwirkle-push-device';
const LAST_ENDPOINT_KEY = 'qwirkle-push-endpoint';

/** Stable per-browser id, used as the Realtime Database key for this device. */
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Decode a base64url VAPID key into the byte array the Push API expects. */
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Whether this browser can do Web Push at all (iOS needs the PWA installed). */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Current notification permission for this browser. */
export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no-key' | 'failed' };

/**
 * Ask for permission, subscribe this device, and register it for `uid`.
 * Safe to call repeatedly — an existing subscription is reused unless it was
 * created against a different application server key.
 */
export async function subscribeToPush(uid: string): Promise<PushSubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const keyRes = await fetch(KEY_ENDPOINT);
    const { publicKey } = await keyRes.json();
    if (!publicKey) return { ok: false, reason: 'no-key' };

    const reg = await navigator.serviceWorker.ready;

    // Drop a subscription created against a different VAPID key, otherwise the
    // push service would reject every delivery to it.
    let subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const existingKey = subscription.options.applicationServerKey;
      if (!existingKey || bufferToBase64Url(existingKey) !== publicKey) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    await savePushSubscription(uid, getDeviceId(), subscription.toJSON());
    localStorage.setItem(LAST_ENDPOINT_KEY, subscription.endpoint);
    // Enabling is an explicit user action, so this is the one place the
    // channel flag gets switched on.
    await setPushNotifications(uid, true);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Remove this device's subscription, both locally and in the database. */
export async function unsubscribeFromPush(uid: string): Promise<void> {
  if (!isPushSupported()) return;
  try {
    localStorage.removeItem(LAST_ENDPOINT_KEY);
    await removePushSubscription(uid, getDeviceId()).catch(() => {});
    const subscription = await getExistingSubscription();
    await subscription?.unsubscribe().catch(() => {});
  } catch {
    /* ignore — the caller only cares that the channel is off */
  }
}

/**
 * Reconcile this device on app start and report whether it is subscribed.
 *
 * Also the self-healing step for the one case the server cannot handle: when
 * notifications were revoked in browser settings, or the endpoint rotated, the
 * stored entry is refreshed or dropped here rather than left to fail forever.
 */
export async function syncPushSubscription(uid: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const subscription = await getExistingSubscription();

    if (!subscription) {
      // Only clean up when this device had registered before — otherwise every
      // player who never uses push would write on each app load.
      if (localStorage.getItem(LAST_ENDPOINT_KEY)) {
        localStorage.removeItem(LAST_ENDPOINT_KEY);
        await removePushSubscription(uid, getDeviceId()).catch(() => {});
      }
      return false;
    }

    // Only write when the endpoint actually changed, so opening the app
    // repeatedly does not re-save the same subscription every time.
    if (localStorage.getItem(LAST_ENDPOINT_KEY) !== subscription.endpoint) {
      await savePushSubscription(uid, getDeviceId(), subscription.toJSON()).catch(() => {});
      localStorage.setItem(LAST_ENDPOINT_KEY, subscription.endpoint);
    }
    return true;
  } catch {
    return false;
  }
}
