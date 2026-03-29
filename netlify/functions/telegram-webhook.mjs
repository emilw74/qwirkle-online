/**
 * Netlify Function: Telegram Webhook
 * Handles /start, /stop, /on commands from Telegram Bot.
 * Links Telegram chatId to Firebase uid.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DB_URL = "https://qwirkle-online-6ca1c-default-rtdb.europe-west1.firebasedatabase.app";

async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function dbGet(path) {
  const res = await fetch(`${DB_URL}/${path}.json`);
  return res.json();
}

async function dbPatch(path, data) {
  await fetch(`${DB_URL}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function dbPut(path, data) {
  await fetch(`${DB_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export default async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  const update = await req.json();
  const message = update?.message;
  if (!message?.text) return new Response("OK", { status: 200 });

  const chatId = message.chat.id;
  const text = message.text.trim();

  // Handle /start <uid>
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const uid = parts[1];

    if (!uid) {
      await sendTelegram(chatId,
        "⚠️ Użyj linku z aplikacji Qwirkle, aby połączyć konto.\n" +
        "⚠️ Use the link from the Qwirkle app to connect your account."
      );
      return new Response("OK", { status: 200 });
    }

    // Verify uid exists
    const profile = await dbGet(`profiles/${uid}`);
    if (!profile) {
      await sendTelegram(chatId,
        "❌ Nie znaleziono konta. Spróbuj ponownie z aplikacji.\n" +
        "❌ Account not found. Try again from the app."
      );
      return new Response("OK", { status: 200 });
    }

    // Save chatId
    await dbPatch(`profiles/${uid}`, {
      telegramChatId: chatId,
      telegramNotifications: true,
    });

    const nickname = profile.nickname || "Gracz";
    await sendTelegram(chatId,
      `✅ Połączono z kontem <b>${nickname}</b>!\n` +
      `Będziesz dostawać powiadomienia gdy nadejdzie Twój ruch.\n\n` +
      `✅ Connected to <b>${nickname}</b>!\n` +
      `You'll receive notifications when it's your turn.`
    );
    return new Response("OK", { status: 200 });
  }

  // Handle /stop
  if (text === "/stop") {
    // Find profile by chatId — scan profiles
    const profiles = await dbGet("profiles");
    if (profiles) {
      for (const [uid, p] of Object.entries(profiles)) {
        if (p && p.telegramChatId === chatId) {
          await dbPatch(`profiles/${uid}`, { telegramNotifications: false });
        }
      }
    }
    await sendTelegram(chatId,
      "🔕 Powiadomienia wyłączone. Wpisz /on aby włączyć ponownie.\n" +
      "🔕 Notifications disabled. Type /on to re-enable."
    );
    return new Response("OK", { status: 200 });
  }

  // Handle /on
  if (text === "/on") {
    const profiles = await dbGet("profiles");
    if (profiles) {
      for (const [uid, p] of Object.entries(profiles)) {
        if (p && p.telegramChatId === chatId) {
          await dbPatch(`profiles/${uid}`, { telegramNotifications: true });
        }
      }
    }
    await sendTelegram(chatId,
      "🔔 Powiadomienia włączone!\n" +
      "🔔 Notifications enabled!"
    );
    return new Response("OK", { status: 200 });
  }

  // Default
  await sendTelegram(chatId,
    "🎲 Qwirkle Bot\n\n" +
    "/stop — wyłącz powiadomienia / disable notifications\n" +
    "/on — włącz powiadomienia / enable notifications"
  );
  return new Response("OK", { status: 200 });
};

export const config = {
  path: "/api/telegram-webhook",
};
