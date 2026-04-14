import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, '..', 'data');
const configuredDataDir = process.env.GREETEASE_DATA_DIR?.trim();
const configuredDataFile = process.env.DATA_FILE?.trim();

/**
 * JSON data file path.
 * Env options:
 * 1) DATA_FILE: full path to greetease.json
 * 2) GREETEASE_DATA_DIR: directory containing greetease.json
 */
function resolveDataFile() {
  const candidates = [];
  if (configuredDataFile) candidates.push(configuredDataFile);
  if (configuredDataDir) candidates.push(path.join(configuredDataDir, 'greetease.json'));
  candidates.push(path.join(defaultDataDir, 'greetease.json'));

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(path.dirname(candidate), { recursive: true });
      return candidate;
    } catch (e) {
      console.error(`[GreetEase] Cannot use data dir for ${candidate}: ${e.message}`);
    }
  }
  return path.join(defaultDataDir, 'greetease.json');
}

export const DATA_FILE = resolveDataFile();

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

export function loadStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return emptyStore();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return emptyStore();
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch (e) {
    console.error('[GreetEase] Could not read data store, starting empty:', e.message);
    return emptyStore();
  }
}

export function saveStore(store) {
  const normalized = normalizeStore(store);
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  const payload = JSON.stringify(normalized, null, 2);
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}
