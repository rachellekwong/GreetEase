import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, '..', 'data');
const configuredDataDir = process.env.GREETEASE_DATA_DIR?.trim() || defaultDataDir;

/**
 * SQLite file path.
 * Back-compat: DATA_FILE still works as an override if SQLITE_FILE is unset.
 */
export const DATA_FILE =
  process.env.SQLITE_FILE?.trim() || process.env.DATA_FILE?.trim() || path.join(configuredDataDir, 'greetease.db');
const LEGACY_JSON_FILE = path.join(configuredDataDir, 'greetease.json');

const dbDir = path.dirname(DATA_FILE);
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DATA_FILE);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS app_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`);

const selectMainRow = db.prepare('SELECT value FROM app_store WHERE key = ?');
const upsertMainRow = db.prepare(`
  INSERT INTO app_store (key, value, updated_at)
  VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`);

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

function normalizeStore(data) {
  const base = emptyStore();
  if (!data || typeof data !== 'object') return base;

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

function seedFromLegacyJsonIfNeeded() {
  try {
    const existing = selectMainRow.get('main');
    if (existing) return;
    if (!fs.existsSync(LEGACY_JSON_FILE)) return;

    const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    upsertMainRow.run('main', JSON.stringify(normalized));
    console.log(`[GreetEase] Imported legacy JSON data into SQLite: ${LEGACY_JSON_FILE}`);
  } catch (e) {
    console.error('[GreetEase] Could not import legacy JSON store:', e.message);
  }
}

seedFromLegacyJsonIfNeeded();

export function loadStore() {
  try {
    const row = selectMainRow.get('main');
    if (!row?.value) return emptyStore();
    const parsed = JSON.parse(row.value);
    return normalizeStore(parsed);
  } catch (e) {
    console.error('[GreetEase] Could not read SQLite store, starting empty:', e.message);
    return emptyStore();
  }
}

export function saveStore(store) {
  const normalized = normalizeStore(store);
  upsertMainRow.run('main', JSON.stringify(normalized));
}
