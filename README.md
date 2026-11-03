# PrepAI

PrepAI is a MERN preparation workspace with private accounts, personalized dashboards, offline technical topic guides, mock interviews, voice practice, and saved progress.

## Local setup (Windows PowerShell)

Requirements: Node.js 20+, pnpm 11+, and MongoDB. In this project folder:

```powershell
pnpm.cmd install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
pnpm.cmd dev
```

Open http://localhost:5175. The API runs on port 5000 and Vite proxies /api to it. If PrepAI is already running, use that instance or stop it from its own VS Code terminal with Ctrl+C.

## Features

- Sign-up, sign-in, sign-out, secure sessions, required first-login profiles, and per-account records.
- Personalized dashboard, editable profile, light/dark themes, interview practice, voice practice, and progress tracking.
- Technical Topic Learning supports built-in English guides for HTML, Java, React, JavaScript, CSS, Python, and SQL. Guides contain concepts, explanations, example code, revision notes, practice questions, answers, quizzes, and flashcards.
- Topic guides come from a small local reference library. They are labeled as guides and never represented as summaries of unprocessed videos. Unknown topics are clearly reported as unsupported instead of being invented.
- Pasted transcripts are saved with transcript-derived notes. Follow-up answers quote relevant transcript sentences, or use a separately labeled built-in topic reference when available. Unsupported questions receive an explicit limitation.
- YouTube URLs and selected media files may be saved as session metadata only. PrepAI does not fetch, upload, transcribe, or claim to process them. Paste captions or a transcript for source-specific learning.
- Saved sessions can be reopened, chat history is persisted per user, and **Finalize & save progress** records completion in MongoDB.
- All question generation, topic guides, Q&A, and interview rubrics run locally; no external AI API or API key is used. The mock interview report checks response structure and length, not technical correctness.
- Browser voice input depends on browser speech-recognition support and permission. Microphone audio is not stored by PrepAI.

## Environment

See .env.example. Required variables:

- PORT and HOST: API port and bind address (5000 and 127.0.0.1 locally).
- MONGODB_URI: MongoDB connection string. MongoDB is required for accounts and persistence.
- SESSION_SECRET: set a long random value for production. Local development can use the generated ephemeral value.
- FRONTEND_ORIGIN: optional exact origin for a separately hosted frontend.
- VITE_API_URL, VITE_API_PROXY_TARGET, VITE_PORT: optional frontend API URL, proxy target, and port. Never store secrets in VITE variables.

No AI provider credentials or paid API are required.

## Production build and deployment

```powershell
pnpm.cmd build
$env:NODE_ENV = 'production'
pnpm.cmd start
```

Express serves client/dist and /api from one origin. Provide MongoDB and SESSION_SECRET through the deployment platform's secret manager. Set HOST=0.0.0.0 when the platform requires binding to all interfaces. Do not commit .env or database credentials. No public deployment is configured.

## Verification

```powershell
pnpm.cmd run build
pnpm.cmd run server:dev
pnpm.cmd run client:dev
```

GET /api/health reports API and MongoDB status. Use pnpm.cmd dev in PowerShell to avoid the pnpm.ps1 execution-policy restriction. The VS Code task **PrepAI: Start app** uses the same command.
