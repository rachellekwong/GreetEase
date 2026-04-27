# GreetEase

GreetEase is a full-stack app for managing contacts, holidays, and scheduled greeting messages, with Telegram delivery and AI-assisted message generation.

## Tech Stack

- Frontend: React + Vite
- Backend: Express (Node.js, ESM)
- Data store: local JSON file (`data/greetease.json` by default)
- UI: Tailwind + Radix UI components
- Messaging: Telegram Bot API
- AI: OpenAI-compatible Chat Completions API

## Features

- Contact management (groups, tone preferences, Telegram chat IDs)
- Holiday management (date, recurrence, default tones by group)
- Draft and schedule greeting messages
- Dispatch scheduled messages automatically
- Send Telegram test messages
- Sync inbound Telegram private messages
- Generate greetings with an OpenAI-compatible LLM

## Project Structure

- `src/` - React frontend
- `server/index.mjs` - Express API server
- `server/store.mjs` - JSON persistence layer
- `server/seed-defaults.mjs` - initial seed data for contacts/holidays
- `scripts/render-start.mjs` - production startup helper
- `telegram_api.env.example` - Telegram env template

## Prerequisites

- Node.js 18+ (recommended)
- npm
- (Optional) Telegram bot token
- (Optional) OpenAI-compatible API key

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create local env files in project root:

### `telegram_api.env`

Copy from `telegram_api.env.example` and fill values:

```env
TELEGRAM_BOT_TOKEN=
# TELEGRAM_TEST_CHAT_ID=
```

### `ai_api_key.env`

Create this file and add your API key:

```env
OPENAI_API_KEY=
# Optional overrides:
# OPENAI_BASE_URL=https://api.bianxie.ai/v1
# OPENAI_MODEL=gpt-4o-mini
```

3. Start frontend + backend together:

```bash
npm run dev:all
```

- Frontend (Vite): `http://localhost:5173` (default)
- API server: `http://localhost:3030` (default)

## Available Scripts

- `npm run dev` - start frontend only
- `npm run server` - start backend only
- `npm run dev:all` - run backend + frontend concurrently
- `npm run build` - build frontend for production
- `npm run start` - production start (auto-builds if needed)
- `npm run preview` - preview production frontend build
- `npm run lint` - run ESLint
- `npm run lint:fix` - run ESLint with auto-fixes
- `npm run typecheck` - run TypeScript checks

## API Quick Checks

- `GET /api/health` - server health check
- `GET /api/contacts` - list contacts
- `GET /api/holidays` - list holidays
- `POST /api/telegram/test` - send Telegram test message
- `POST /api/llm` - generate message with LLM backend

## Data and Environment Notes

- Local data is stored in `data/greetease.json` by default.
- You can override storage location with:
  - `DATA_FILE` (full JSON file path), or
  - `GREETEASE_DATA_DIR` (directory for `greetease.json`)
- Sensitive env files are gitignored:
  - `.env`, `.env.*`, `ai_api_key.env`, `telegram_api.env`

## Troubleshooting

- Port 3030 already in use  
  Run with another port:

  ```bash
  PORT=3040 npm run server
  ```

- Telegram features disabled  
  Add `TELEGRAM_BOT_TOKEN` in `telegram_api.env`, then restart backend.

- AI generation fails  
  Add `OPENAI_API_KEY` in `ai_api_key.env` (or `.env`) and restart backend.

- 404 API route from frontend  
  Ensure backend is running (`npm run server`) or use `npm run dev:all`.

## Security Reminder

Do not commit personal data or secret keys. The repo is configured to ignore local data and env secret files.
