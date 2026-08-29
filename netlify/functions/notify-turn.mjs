/**
 * Netlify Function: Notify Turn
 *
 * Single entry point for all turn notifications. The client posts one event and
 * this function fans it out to every channel the player has enabled:
 *   - Telegram (bot message)
 *   - Web Push (browser / PWA notification)
 *
 * Body: { playerId, roomCode, gameName, type?: 'turn' | 'reminder', minutesLeft?, turnDeadline? }
 *
 * Channels are delivered independently: each one is gated on its own settings
 * and its own per-game mute, and a failure in one can never suppress another.
 */

import { sendPush } from './lib/webpush.mjs';
import { getVapidKeys } from './lib/vapid.mjs';
import { dbGet } from './lib/db.mjs';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = "https://qwirkle.ewakon.pl";

/** Format the turn deadline as "HH:MM CET", or '' when there is no deadline. */
export function formatDeadline(turnDeadline) {
  if (!turnDeadline) return '';
  try {
    const cetStr = new Date(turnDeadline).toLocaleString('pl-PL', {
      timeZone: 'Europe/Warsaw',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `\n⏳ Deadline: ${cetStr} CET`;
  } catch {
    return '';
  }
}

/**
 * Build the message once, in both renderings, so every channel says exactly the
 * same thing. Telegram gets HTML; Web Push gets a title/body pair.
 */
export function buildMessages({ type, displayName, deadlineStr, minutesLeft }) {
  const headline = type === 'reminder'
    ? `⏰ Pozostało ${minutesLeft} min! / ${minutesLeft} min left!`
    : `🎲 Twój ruch! / Your turn!`;

  const telegramHeadline = type === 'reminder'
    ? `⏰ <b>Pozostało ${minutesLeft} min!</b> / <b>${minutesLeft} min left!</b>`
    : `🎲 <b>Twój ruch!</b> / <b>Your turn!</b>`;

  return {
    telegramHtml: `${telegramHeadline}\n${displayName}${deadlineStr}`,
    push: {
      title: headline,
      body: `${displayName}${deadlineStr}`.trim(),
    },
  };
}

/** Deliver the Telegram message. Resolves to a result object, never throws. */
async function deliverTelegram(profile, roomCode, html) {
  if (!profile.telegramChatId || !profile.telegramNotifications) {
    return { skipped: true, reason: 'not-connected' };
  }
  if (profile.telegramMutedGames?.[roomCode]) {
    return { skipped: true, reason: 'muted' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegramChatId,
        text: html,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "▶️ Zagraj / Play", url: SITE_URL },
          ]],
        },
      }),
    });
    const result = await res.json();
    return { sent: result.ok, debug: result.ok ? undefined : result };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

/** Deliver a Web Push notification to every registered device. Never throws. */
async function deliverPush(profile, roomCode, payload) {
  const subs = profile.pushSubs;
  if (!profile.pushNotifications || !subs || Object.keys(subs).length === 0) {
    return { skipped: true, reason: 'not-connected' };
  }
  if (profile.pushMutedGames?.[roomCode]) {
    return { skipped: true, reason: 'muted' };
  }

  const vapid = await getVapidKeys();
  if (!vapid) return { skipped: true, reason: 'vapid-not-configured' };

  // Every registered device gets the notification.
  const results = await Promise.all(
    Object.values(subs).map(sub => sendPush(sub, payload, vapid)),
  );

  return {
    sent: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    // Dead endpoints are reported rather than deleted here: this function
    // cannot write to profiles. The owning device clears its own entry the
    // next time the app runs.
    gone: results.filter(r => r.gone).length,
    debug: results.some(r => !r.ok) ? results.filter(r => !r.ok) : undefined,
  };
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { playerId, roomCode, gameName, type = 'turn', minutesLeft, turnDeadline } = await req.json();

    if (!playerId || !roomCode) {
      return new Response(JSON.stringify({ error: "Missing playerId or roomCode" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const profile = await dbGet(`profiles/${playerId}`);
    if (!profile) {
      return new Response(JSON.stringify({ skipped: true, reason: "no-profile" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const displayName = gameName || "Qwirkle";
    const messages = buildMessages({
      type,
      displayName,
      deadlineStr: formatDeadline(turnDeadline),
      minutesLeft,
    });

    const pushPayload = {
      title: messages.push.title,
      body: messages.push.body,
      url: SITE_URL,
      // One notification per room: a reminder replaces the earlier "your turn"
      // instead of stacking up on the lock screen.
      tag: `qwirkle-${roomCode}`,
      roomCode,
    };

    // allSettled, so a broken channel cannot take the other one down with it.
    const [telegram, push] = await Promise.allSettled([
      deliverTelegram(profile, roomCode, messages.telegramHtml),
      deliverPush(profile, roomCode, pushPayload),
    ]);

    const unwrap = (r) => r.status === 'fulfilled' ? r.value : { error: String(r.reason) };

    return new Response(JSON.stringify({
      telegram: unwrap(telegram),
      push: unwrap(push),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/notify-turn",
};
