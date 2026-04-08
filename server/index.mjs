import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { loadStore, saveStore, DATA_FILE } from './store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
// Load .env, then ai_api_key.env, then telegram_api.env (same key → later file wins).
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, 'ai_api_key.env'), override: true });
dotenv.config({ path: path.join(projectRoot, 'telegram_api.env'), override: true });

/** OpenAI-compatible API root (no trailing slash). Same idea as: OpenAI(api_key=..., base_url=".../v1"). */
function chatCompletionsUrl() {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.bianxie.ai/v1').trim().replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

// Default 3030 — port 3000 is often taken by other dev servers
const PORT = Number(process.env.PORT) || 3030;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>GreetEase API</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem">
  <h1>GreetEase API</h1>
  <p>This URL is the <strong>backend</strong> (REST). There is no full app UI here.</p>
  <p>Open the web app: <a href="http://localhost:5299">http://localhost:5299</a> (run <code>npm run dev</code> or <code>npm run dev:all</code>).</p>
  <h2>Quick checks</h2>
  <ul>
    <li><a href="/api/health">GET /api/health</a></li>
    <li><a href="/api/contacts">GET /api/contacts</a></li>
    <li><code>POST /api/telegram/test</code> — Telegram bot test (optional JSON <code>{"chat_id":"..."}</code>)</li>
  </ul>
</body></html>`);
});

const now = () => new Date().toISOString();

const store = loadStore();

function persist() {
  try {
    saveStore(store);
  } catch (e) {
    console.error('[GreetEase] Failed to save data store:', e.message);
  }
}

function defaultWorkspace() {
  return {
    display_name: '',
    email: '',
    telegram_bot_token: '',
    telegram_bot_id: null,
    telegram_bot_username: '',
    telegram_bot_first_name: '',
  };
}

function ensureWorkspace() {
  if (!store.workspace || typeof store.workspace !== 'object' || Array.isArray(store.workspace)) {
    store.workspace = defaultWorkspace();
    return;
  }
  const d = defaultWorkspace();
  for (const k of Object.keys(d)) {
    if (store.workspace[k] === undefined) store.workspace[k] = d[k];
  }
}

function getEffectiveTelegramToken() {
  ensureWorkspace();
  const w = store.workspace.telegram_bot_token?.trim();
  if (w) return w;
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
}

function workspacePublicJson() {
  ensureWorkspace();
  const w = store.workspace;
  const token = getEffectiveTelegramToken();
  return {
    display_name: w.display_name || '',
    email: w.email || '',
    telegram_token_configured: Boolean(token),
    telegram_token_source: w.telegram_bot_token?.trim() ? 'workspace' : token ? 'env' : 'none',
    telegram_bot_id: w.telegram_bot_id ?? null,
    telegram_bot_username: w.telegram_bot_username || '',
    telegram_bot_first_name: w.telegram_bot_first_name || '',
  };
}

async function syncBotProfileFromTelegram(token) {
  if (!token) return { ok: false, error: 'No bot token' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const gd = await r.json().catch(() => ({}));
    if (!gd.ok) return { ok: false, error: gd.description || 'Telegram getMe failed' };
    const bot = gd.result || {};
    ensureWorkspace();
    store.workspace.telegram_bot_id = bot.id != null ? bot.id : null;
    store.workspace.telegram_bot_username = bot.username != null ? String(bot.username) : '';
    store.workspace.telegram_bot_first_name = bot.first_name != null ? String(bot.first_name) : '';
    persist();
    return { ok: true, bot };
  } catch (e) {
    return { ok: false, error: e.message || 'Network error' };
  }
}

function id() {
  return crypto.randomUUID();
}

function parseScheduledAt(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map((n) => Number(n));
  if (!y || !m || !d) return null;
  const [hh, mm] = String(timeStr || '09:00').split(':').map((n) => Number(n));
  const dt = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getScheduledAtMs(msg) {
  const explicit = msg?.scheduled_at ? new Date(msg.scheduled_at) : null;
  if (explicit && !Number.isNaN(explicit.getTime())) return explicit.getTime();
  const fallback = parseScheduledAt(msg?.holiday_date, msg?.holiday_send_time);
  return fallback ? fallback.getTime() : null;
}

function sortByCreated(items, sortParam) {
  const desc = sortParam?.startsWith('-');
  return [...items].sort((a, b) => {
    const ta = new Date(a.created_date || 0).getTime();
    const tb = new Date(b.created_date || 0).getTime();
    return desc ? tb - ta : ta - tb;
  });
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', (_, res) => {
  res.json({
    id: 'local',
    name: 'Rachelle',
    email: 'local@localhost',
    role: 'admin',
  });
});

app.get('/api/workspace', async (_, res) => {
  try {
    ensureWorkspace();
    const token = getEffectiveTelegramToken();
    if (token && !(store.workspace.telegram_bot_username || '').trim()) {
      await syncBotProfileFromTelegram(token);
    }
    res.json(workspacePublicJson());
  } catch (err) {
    console.error('[GreetEase] GET /api/workspace:', err.message);
    res.status(500).json({ message: err.message || 'workspace failed' });
  }
});

app.patch('/api/workspace', async (req, res) => {
  ensureWorkspace();
  const body = req.body || {};

  if (typeof body.display_name === 'string') {
    store.workspace.display_name = body.display_name.trim();
  }
  if (typeof body.email === 'string') {
    store.workspace.email = body.email.trim();
  }
  if (typeof body.telegram_bot_token === 'string') {
    const t = body.telegram_bot_token.trim();
    store.workspace.telegram_bot_token = t;
    if (!t) {
      store.workspace.telegram_bot_id = null;
      store.workspace.telegram_bot_username = '';
      store.workspace.telegram_bot_first_name = '';
    }
  }

  persist();

  let botSync = null;
  if (typeof body.telegram_bot_token === 'string' && body.telegram_bot_token.trim() !== '') {
    botSync = await syncBotProfileFromTelegram(getEffectiveTelegramToken());
  }

  res.json({ ...workspacePublicJson(), bot_sync: botSync });
});

app.post('/api/workspace/refresh-telegram-bot', async (req, res) => {
  const token = getEffectiveTelegramToken();
  if (!token) {
    return res.status(400).json({
      message:
        'No bot token. Save a token on the Profile page or set TELEGRAM_BOT_TOKEN in telegram_api.env (restart server).',
    });
  }
  const synced = await syncBotProfileFromTelegram(token);
  if (!synced.ok) {
    return res.status(400).json({ message: synced.error || 'Could not reach Telegram' });
  }
  res.json(workspacePublicJson());
});

app.get('/api/contacts', (req, res) => {
  res.json(sortByCreated(store.contacts, req.query.sort));
});

app.post('/api/contacts', (req, res) => {
  const row = { ...req.body, id: id(), created_date: now() };
  store.contacts.push(row);
  persist();
  res.status(201).json(row);
});

app.patch('/api/contacts/:cid', (req, res) => {
  const i = store.contacts.findIndex((c) => c.id === req.params.cid);
  if (i === -1) return res.status(404).json({ message: 'Not found' });
  store.contacts[i] = { ...store.contacts[i], ...req.body, id: store.contacts[i].id };
  persist();
  res.json(store.contacts[i]);
});

app.delete('/api/contacts/:cid', (req, res) => {
  store.contacts = store.contacts.filter((c) => c.id !== req.params.cid);
  persist();
  res.status(204).end();
});

app.get('/api/holidays', (req, res) => {
  res.json(sortByCreated(store.holidays, req.query.sort));
});

app.post('/api/holidays', (req, res) => {
  const row = { ...req.body, id: id(), created_date: now() };
  store.holidays.push(row);
  persist();
  res.status(201).json(row);
});

app.patch('/api/holidays/:hid', (req, res) => {
  const i = store.holidays.findIndex((h) => h.id === req.params.hid);
  if (i === -1) return res.status(404).json({ message: 'Not found' });
  store.holidays[i] = { ...store.holidays[i], ...req.body, id: store.holidays[i].id };
  persist();
  res.json(store.holidays[i]);
});

app.delete('/api/holidays/:hid', (req, res) => {
  store.holidays = store.holidays.filter((h) => h.id !== req.params.hid);
  persist();
  res.status(204).end();
});

app.get('/api/user-settings', (_, res) => {
  res.json(store.userSettings);
});

app.post('/api/user-settings', (req, res) => {
  const row = { ...req.body, id: id(), created_date: now() };
  store.userSettings.push(row);
  persist();
  res.status(201).json(row);
});

app.patch('/api/user-settings/:sid', (req, res) => {
  const i = store.userSettings.findIndex((s) => s.id === req.params.sid);
  if (i === -1) return res.status(404).json({ message: 'Not found' });
  store.userSettings[i] = { ...store.userSettings[i], ...req.body, id: store.userSettings[i].id };
  persist();
  res.json(store.userSettings[i]);
});

app.get('/api/notification-logs', (req, res) => {
  let rows = sortByCreated(store.notificationLogs, req.query.sort);
  const lim = req.query.limit ? parseInt(req.query.limit, 10) : null;
  if (lim && lim > 0) rows = rows.slice(0, lim);
  res.json(rows);
});

app.post('/api/notification-logs', (req, res) => {
  const row = { ...req.body, id: id(), created_date: now() };
  store.notificationLogs.push(row);
  persist();
  res.status(201).json(row);
});

app.get('/api/scheduled-messages', (req, res) => {
  res.json(sortByCreated(store.scheduledMessages, req.query.sort));
});

app.post('/api/scheduled-messages', (req, res) => {
  const row = { ...req.body, id: id(), created_date: now() };
  store.scheduledMessages.push(row);
  persist();
  res.status(201).json(row);
});

app.patch('/api/scheduled-messages/:mid', (req, res) => {
  const i = store.scheduledMessages.findIndex((m) => m.id === req.params.mid);
  if (i === -1) return res.status(404).json({ message: 'Not found' });
  store.scheduledMessages[i] = { ...store.scheduledMessages[i], ...req.body, id: store.scheduledMessages[i].id };
  persist();
  res.json(store.scheduledMessages[i]);
});

app.delete('/api/scheduled-messages/:mid', (req, res) => {
  store.scheduledMessages = store.scheduledMessages.filter((m) => m.id !== req.params.mid);
  persist();
  res.status(204).end();
});

/**
 * Quick Telegram check: optional body { "chat_id": "123" } or set TELEGRAM_TEST_CHAT_ID.
 * If chat_id is missing but the token is valid, returns 400 with bot username (getMe) so you can still verify the token.
 */
app.post('/api/telegram/test', async (req, res) => {
  const token = getEffectiveTelegramToken();
  if (!token) {
    return res.status(503).json({
      ok: false,
      message:
        'No bot token: add it on the Profile page or set TELEGRAM_BOT_TOKEN in telegram_api.env (restart the server).',
    });
  }

  const fromBody = req.body?.chat_id;
  const fromEnv = process.env.TELEGRAM_TEST_CHAT_ID?.trim();
  const chat_id =
    fromBody != null && String(fromBody).trim() !== '' ? String(fromBody).trim() : fromEnv || '';

  const base = `https://api.telegram.org/bot${token}`;

  if (!chat_id) {
    try {
      const gr = await fetch(`${base}/getMe`);
      const gd = await gr.json().catch(() => ({}));
      if (!gd.ok) {
        return res.status(502).json({
          ok: false,
          message: gd.description || 'Invalid bot token or Telegram API error',
          details: gd,
        });
      }
      return res.status(400).json({
        ok: false,
        message:
          'Bot token is valid. Add your numeric chat_id: POST { "chat_id": "..." } or TELEGRAM_TEST_CHAT_ID in telegram_api.env (open @userinfobot, and /start your bot).',
        bot: gd.result,
      });
    } catch (err) {
      return res.status(502).json({ ok: false, message: err.message || 'Failed to reach api.telegram.org' });
    }
  }

  const text = `GreetEase Telegram test — ${new Date().toISOString()}`;
  try {
    const r = await fetch(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text }),
    });
    const data = await r.json().catch(() => ({}));
    if (!data.ok) {
      const msg = data.description || r.statusText || 'Telegram sendMessage error';
      return res.status(r.status >= 400 && r.status < 500 ? r.status : 502).json({
        ok: false,
        message: msg,
        details: data,
      });
    }
    res.json({ ok: true, messageId: data.result?.message_id, chat_id });
  } catch (err) {
    console.error('Telegram test send error:', err.message);
    res.status(502).json({ ok: false, message: err.message || 'Failed to reach api.telegram.org' });
  }
});

/**
 * Telegram Bot API — send one or more messages.
 * Body: { items: [ { chat_id: string | number, text: string } ] }
 */
app.post('/api/telegram/send', async (req, res) => {
  const token = getEffectiveTelegramToken();
  if (!token) {
    return res.status(503).json({
      message:
        'No bot token: add it on the Profile page or set TELEGRAM_BOT_TOKEN in telegram_api.env (restart the server).',
    });
  }

  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Body must include items: [{ chat_id, text }, ...]' });
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const results = [];

  for (const it of items) {
    const chat_id = it?.chat_id;
    const text = String(it?.text ?? '').trim();
    if (chat_id == null || String(chat_id).trim() === '' || !text) {
      results.push({ chat_id, ok: false, error: 'Each item needs chat_id and non-empty text' });
      continue;
    }
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text }),
      });
      const data = await r.json().catch(() => ({}));
      if (!data.ok) {
        results.push({
          chat_id,
          ok: false,
          error: data.description || r.statusText || 'Telegram API error',
        });
      } else {
        results.push({ chat_id, ok: true, messageId: data.result?.message_id ?? null });
      }
    } catch (err) {
      results.push({ chat_id, ok: false, error: err.message || 'Network error' });
    }
  }

  const sent = results.filter((x) => x.ok).length;
  res.json({ results, sent, failed: results.length - sent });
});

function ensureTelegramInboundStore() {
  if (!Array.isArray(store.telegramInbound)) store.telegramInbound = [];
  if (typeof store.telegram_update_offset !== 'number' || store.telegram_update_offset < 0) {
    store.telegram_update_offset = 0;
  }
}

function textFromTelegramMessage(msg) {
  if (msg?.text) return String(msg.text);
  if (msg?.caption) return String(msg.caption);
  if (msg?.sticker) return '[Sticker]';
  if (msg?.photo?.length) return '[Photo]';
  if (msg?.document) return '[Document]';
  if (msg?.voice) return '[Voice]';
  if (msg?.video_note) return '[Video note]';
  if (msg?.video) return '[Video]';
  if (msg?.audio) return '[Audio]';
  if (msg?.location) return '[Location]';
  return '[Message]';
}

/**
 * Pull new private chat messages via long-poll-friendly getUpdates (timeout 0).
 * Persists telegram_update_offset and appends deduped rows to store.telegramInbound.
 */
async function pollTelegramInbound() {
  const token = getEffectiveTelegramToken();
  if (!token) return { ok: false, ingested: 0, error: 'no_token' };
  ensureTelegramInboundStore();

  let offset = store.telegram_update_offset;
  let ingested = 0;
  const url = `https://api.telegram.org/bot${token}/getUpdates`;

  for (let iter = 0; iter < 25; iter += 1) {
    let data;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset,
          limit: 100,
          timeout: 0,
          allowed_updates: ['message'],
        }),
      });
      data = await r.json().catch(() => ({}));
    } catch (err) {
      console.error('[GreetEase] Telegram getUpdates fetch error:', err.message);
      break;
    }
    if (!data.ok) {
      if (data.error_code || data.description) {
        console.warn('[GreetEase] getUpdates:', data.description || data);
      }
      break;
    }

    const updates = data.result || [];
    if (updates.length === 0) break;

    const seenIds = new Set(store.telegramInbound.map((r) => r.telegram_update_id));

    for (const u of updates) {
      const updateId = u.update_id;
      offset = updateId + 1;

      const msg = u.message;
      if (!msg || msg.chat?.type !== 'private') continue;
      if (msg.from?.is_bot) continue;
      if (seenIds.has(updateId)) continue;

      const chatId = String(msg.chat.id);
      const contact = store.contacts.find(
        (c) => String(c.telegram_chat_id || '').trim() === chatId
      );
      const row = {
        id: id(),
        created_date: new Date((msg.date || 0) * 1000).toISOString(),
        chat_id: chatId,
        from_user_id: msg.from?.id != null ? String(msg.from.id) : '',
        from_username: msg.from?.username || '',
        from_first_name: msg.from?.first_name || '',
        from_last_name: msg.from?.last_name || '',
        text: textFromTelegramMessage(msg),
        telegram_message_id: msg.message_id,
        telegram_update_id: updateId,
        contact_id: contact?.id ?? null,
        contact_name: contact?.name ?? null,
      };
      store.telegramInbound.push(row);
      seenIds.add(updateId);
      ingested += 1;
    }

    store.telegram_update_offset = offset;
    persist();

    if (updates.length < 100) break;
  }

  return { ok: true, ingested };
}

app.get('/api/telegram/inbound', (req, res) => {
  ensureTelegramInboundStore();
  let rows = sortByCreated(store.telegramInbound, req.query.sort || '-created_date');
  const lim = req.query.limit ? parseInt(req.query.limit, 10) : null;
  if (lim && lim > 0) rows = rows.slice(0, lim);
  res.json(rows);
});

app.post('/api/telegram/sync-inbound', async (req, res) => {
  const token = getEffectiveTelegramToken();
  if (!token) {
    return res.status(503).json({
      message:
        'No bot token: add it on the Profile page or set TELEGRAM_BOT_TOKEN in telegram_api.env (restart the server).',
    });
  }
  try {
    const result = await pollTelegramInbound();
    res.json({
      ok: result.ok,
      ingested: result.ingested,
      total: store.telegramInbound.length,
    });
  } catch (err) {
    res.status(502).json({ ok: false, message: err.message || 'sync failed' });
  }
});

let pollInboundRunning = false;
async function pollTelegramInboundSafe() {
  if (pollInboundRunning) return;
  pollInboundRunning = true;
  try {
    await pollTelegramInbound();
  } catch (err) {
    console.error('[GreetEase] Inbound poll error:', err.message);
  } finally {
    pollInboundRunning = false;
  }
}

let dispatchingScheduled = false;

async function dispatchDueScheduledMessages() {
  if (dispatchingScheduled) return;
  dispatchingScheduled = true;
  try {
    const token = getEffectiveTelegramToken();
    if (!token) return;

    const nowDate = new Date();
    const nowMs = nowDate.getTime();
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    for (const msg of store.scheduledMessages) {
      if (msg.status !== 'scheduled') continue;
      const scheduledAtMs = getScheduledAtMs(msg);
      if (scheduledAtMs == null || scheduledAtMs > nowMs) continue;

      const isIndividuals =
        msg.target_mode === 'individuals' &&
        Array.isArray(msg.target_contact_ids) &&
        msg.target_contact_ids.length > 0;
      const idSet = isIndividuals ? new Set(msg.target_contact_ids.map((x) => String(x))) : null;
      const recipients = store.contacts.filter((c) => {
        if (c.is_active === false || !String(c.telegram_chat_id || '').trim()) return false;
        if (isIndividuals) return idSet.has(String(c.id));
        return c.group === msg.target_group;
      });
      if (recipients.length === 0) {
        msg.status = 'sent';
        msg.sent_count = 0;
        msg.sent_at = nowDate.toISOString();
        delete msg.dispatch_error;
        continue;
      }

      let sentCount = 0;
      let lastTelegramError = '';
      for (const c of recipients) {
        const chat_id = String(c.telegram_chat_id).trim();
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id, text: String(msg.message || '') }),
          });
          const data = await r.json().catch(() => ({}));
          if (!data.ok) {
            lastTelegramError = data.description || r.statusText || 'Telegram sendMessage error';
            continue;
          }
          sentCount += 1;
          store.notificationLogs.push({
            id: id(),
            created_date: nowDate.toISOString(),
            contact_name: c.name,
            contact_email: c.email || '',
            contact_group: c.group,
            holiday_name: msg.holiday_name,
            message: msg.message,
            status: 'sent',
            sent_via: 'telegram',
          });
        } catch (err) {
          lastTelegramError = err.message || 'Network error';
        }
      }

      if (sentCount === 0) {
        msg.status = 'failed';
        msg.sent_count = 0;
        msg.dispatch_error = lastTelegramError || 'Telegram delivery failed for every recipient (check chat IDs).';
        msg.sent_at = nowDate.toISOString();
      } else {
        msg.status = 'sent';
        msg.sent_count = sentCount;
        msg.sent_at = nowDate.toISOString();
        delete msg.dispatch_error;
      }
    }
    persist();
  } finally {
    dispatchingScheduled = false;
  }
}

app.post('/api/llm', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    return res.status(400).json({ message: 'Missing prompt' });
  }

  const apiKey = (
    process.env.OPENAI_API_KEY ||
    process.env.BIANXIE_API_KEY ||
    process.env.API_KEY
  )?.trim();
  if (!apiKey) {
    return res.status(503).json({
      message:
        'No API key: set OPENAI_API_KEY in ai_api_key.env (or .env) with your key after the = sign, save the file, and restart npm run server.',
    });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const completionsUrl = chatCompletionsUrl();

  try {
    const r = await fetch(completionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You write short holiday greeting messages suitable for instant messaging (e.g. Telegram). Output only the message body — no subject line, no "Dear [Name]", no signature — unless the user explicitly asks otherwise.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600,
        temperature: 0.85,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || r.statusText || 'LLM request failed';
      return res.status(r.status >= 400 && r.status < 500 ? r.status : 502).json({ message: msg });
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return res.status(502).json({ message: 'Empty model response' });
    }
    res.json({ text });
  } catch (err) {
    console.error('LLM fetch error:', err.message);
    res.status(502).json({ message: 'Could not reach the LLM API. Check your network, OPENAI_BASE_URL, and API key.' });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  const hasKey = Boolean(
    (process.env.OPENAI_API_KEY || process.env.BIANXIE_API_KEY || process.env.API_KEY)?.trim()
  );
  const hasTelegram = Boolean(getEffectiveTelegramToken());
  console.log(`GreetEase API listening on http://127.0.0.1:${PORT}  (and http://localhost:${PORT})`);
  console.log(`Data store: ${DATA_FILE}`);
  console.log(`LLM (OpenAI-compatible): ${chatCompletionsUrl()}`);
  if (!hasKey) {
    console.warn(
      '[GreetEase] OPENAI_API_KEY is empty — Generate Message will fail until you add your key to ai_api_key.env and restart.'
    );
  }
  if (!hasTelegram) {
    console.warn(
      '[GreetEase] No Telegram bot token — set TELEGRAM_BOT_TOKEN or save a token on the Profile page; Send/sync will stay disabled until then.'
    );
  }
  // Auto-dispatch due scheduled messages every minute.
  setInterval(() => {
    dispatchDueScheduledMessages().catch((err) => {
      console.error('[GreetEase] Scheduled dispatch error:', err.message);
    });
  }, 60_000);
  // Pull Telegram replies (private messages to the bot) every 30s (no-ops when no token).
  pollTelegramInboundSafe();
  setInterval(() => {
    pollTelegramInboundSafe();
  }, 30_000);

  const bootToken = getEffectiveTelegramToken();
  ensureWorkspace();
  if (bootToken && !(store.workspace.telegram_bot_username || '').trim()) {
    syncBotProfileFromTelegram(bootToken).then((r) => {
      if (r?.ok && store.workspace.telegram_bot_username) {
        console.log(
          `[GreetEase] Telegram bot linked: @${store.workspace.telegram_bot_username}` +
            (store.workspace.telegram_bot_first_name ? ` (${store.workspace.telegram_bot_first_name})` : '')
        );
      }
    });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[GreetEase] Port ${PORT} is already in use. Try: PORT=3040 npm run server\n` +
        `Or stop the other process using that port.`
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
