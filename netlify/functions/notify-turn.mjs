/**
 * Netlify Function: Notify Turn
 * Called by the client to send Telegram notifications.
 * Body: { playerId: string, roomCode: string, gameName: string, type?: 'turn' | 'reminder', minutesLeft?: number }
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DB_URL = "https://qwirkle-online-6ca1c-default-rtdb.europe-west1.firebasedatabase.app";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { playerId, roomCode, gameName, type = 'turn', minutesLeft } = await req.json();

    if (!playerId || !roomCode) {
      return new Response(JSON.stringify({ error: "Missing playerId or roomCode" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get player profile
    const res = await fetch(`${DB_URL}/profiles/${playerId}.json`);
    const profile = await res.json();

    if (!profile?.telegramChatId || !profile?.telegramNotifications) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check per-game mute
    if (profile.telegramMutedGames?.[roomCode]) {
      return new Response(JSON.stringify({ skipped: true, reason: "muted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const displayName = gameName || "Qwirkle";
    const siteUrl = "https://qwirkle.ewakon.pl";

    // Build message based on type
    let text;
    if (type === 'reminder') {
      text = `⏰ <b>Pozostało ${minutesLeft} min!</b> / <b>${minutesLeft} min left!</b>\n${displayName}`;
    } else {
      text = `🎲 <b>Twój ruch!</b> / <b>Your turn!</b>\n${displayName}`;
    }

    // Send Telegram message
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: profile.telegramChatId,
        text,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "▶️ Zagraj / Play", url: siteUrl },
          ]],
        },
      }),
    });

    const tgResult = await tgRes.json();
    return new Response(JSON.stringify({ sent: tgResult.ok }), {
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
