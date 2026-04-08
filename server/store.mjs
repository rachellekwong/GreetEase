import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Single JSON file — swap for Postgres later; path stays server-relative. */
export const DATA_FILE = path.join(__dirname, '..', 'data', 'greetease.json');

export function emptyStore() {
  return {
    contacts: [],
    holidays: [],
    userSettings: [],
    notificationLogs: [],
    scheduledMessages: [],
    /** Inbound private chat messages from Telegram (via getUpdates). */
    telegramInbound: [],
    /** Next getUpdates offset (last_update_id + 1). */
    telegram_update_offset: 0,
    /** Workspace profile + optional stored bot token (local demo; prefer env in production). */
    workspace: {
      display_name: '',
      email: '',
      telegram_bot_token: '',
      telegram_bot_id: null,
      telegram_bot_username: '',
      telegram_bot_first_name: '',
    },
  };
}

export function loadStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      const base = emptyStore();
      for (const key of Object.keys(base)) {
        if (key === 'workspace') {
          if (data.workspace && typeof data.workspace === 'object' && !Array.isArray(data.workspace)) {
            base.workspace = { ...base.workspace, ...data.workspace };
          }
          continue;
        }
        if (Array.isArray(data[key])) base[key] = data[key];
      }
      if (typeof data.telegram_update_offset === 'number') {
        base.telegram_update_offset = data.telegram_update_offset;
      }
      return base;
    }
  } catch (e) {
    console.error('[GreetEase] Could not read data store, starting empty:', e.message);
  }
  return emptyStore();
}

export function saveStore(store) {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  const payload = JSON.stringify(store, null, 2);
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}
