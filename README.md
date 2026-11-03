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

### Guided demo

On the sign-in page choose **Start guided demo**. PrepAI creates or reuses a clearly labeled shared sample account and adds sample learning and interview records in MongoDB. No password or API key is needed. Use the banner to step through Dashboard, Technical learning, Mock interview, Progress, and Settings. Do not enter personal information in this shared demo account. Select **Exit demo** or **Sign out** when finished.

## Features

- Sign-up, sign-in, sign-out, secure sessions, required first-login profiles, and per-account records.
- Personalized dashboard, editable profile, light/dark themes, interview practice, voice practice, and progress tracking.
- Technical Topic Learning supports built-in English guides for HTML, Java, React, JavaScript, CSS, Python, and SQL. Guides contain concepts, explanations, example code, revision notes, practice questions, answers, quizzes, and flashcards.
- Topic guides come from a small local reference library. They are labeled as guides and never represented as summaries of unprocessed videos. Unknown topics are clearly reported as unsupported instead of being invented.
- Pasted transcripts are saved with transcript-derived notes. Follow-up answers quote relevant transcript sentences, or use a separately labeled built-in topic reference when available. Unsupported questions receive an explicit limitation.
- Technical topic guides keep working offline. YouTube links, pasted transcripts, and local audio/video uploads can use the local Whisper + Ollama processing pipeline. Original timestamped transcripts and study packs are saved to the signed-in user's MongoDB records.
- Saved sessions can be reopened, chat history is persisted per user, and **Finalize & save progress** records completion in MongoDB.
- All question generation, topic guides, Q&A, and interview rubrics run locally; no external AI API or API key is used. The mock interview report checks response structure and length, not technical correctness.
- Processed video/transcript packs include local study actions: explain again, ask transcript-grounded questions, generate practice questions, quiz one at a time, request examples, and see next-topic suggestions.
- Browser voice input depends on browser speech-recognition support and permission. Microphone audio is not stored by PrepAI.

## Environment

See .env.example. Required variables:

- PORT and HOST: API port and bind address (5000 and 127.0.0.1 locally).
- MONGODB_URI: MongoDB connection string. MongoDB is required for accounts and persistence.
- SESSION_SECRET: set a long random value for production. Local development can use the generated ephemeral value.
- FRONTEND_ORIGIN: optional exact origin for a separately hosted frontend.
- VITE_API_URL, VITE_API_PROXY_TARGET, VITE_PORT: optional frontend API URL, proxy target, and port. Never store secrets in VITE variables.

No cloud AI credentials are used. Video learning requires the local services below.

## Local video-learning services (Windows)

The media pipeline uses a small Java 21 worker, FFmpeg, the standalone yt-dlp executable, whisper.cpp, and local Ollama. It does not use Python or a hosted AI key.

1. Install a [Java 21 JDK](https://adoptium.net/temurin/releases/?version=21) and add its `bin` folder to PATH. Confirm `java -version` and `javac -version` both work; the JDK is required because Express starts the Java worker from source.
2. Install FFmpeg from [Gyan builds](https://www.gyan.dev/ffmpeg/builds/) and add its `bin` directory to PATH. Confirm `ffmpeg -version`.
3. Download the standalone Windows `yt-dlp.exe` from the [official yt-dlp releases](https://github.com/yt-dlp/yt-dlp/releases/latest) and place it on PATH. Confirm `yt-dlp --version`. YouTube caption access can also depend on YouTube availability, age/location restrictions, or current site changes.
4. Build [whisper.cpp](https://github.com/ggml-org/whisper.cpp) with [CMake](https://cmake.org/download/) and Visual Studio C++ build tools. From the project root, use `git clone https://github.com/ggml-org/whisper.cpp.git tools/whisper.cpp`, then `cmake -S tools/whisper.cpp -B tools/whisper.cpp/build -DWHISPER_BUILD_TESTS=OFF` and `cmake --build tools/whisper.cpp/build --config Release --target whisper-cli`. Add the resulting `whisper-cli.exe` folder to PATH, or set `WHISPER_COMMAND` to its full path.
5. In PowerShell from the project root, run `New-Item -ItemType Directory -Force models` then `curl.exe -L --fail -o models/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`. Set `WHISPER_MODEL_PATH=./models/ggml-small.bin`. Confirm `whisper-cli --help`.
6. Install Ollama from [ollama.com/download](https://ollama.com/download), start it, and run `ollama pull llama3.2`. Set `OLLAMA_MODEL` to another installed model if preferred. PrepAI asks Ollama to keep the configured model loaded for 30 minutes by default, avoiding repeated cold starts between analysis steps; adjust `OLLAMA_KEEP_ALIVE` if desired.
   If Ollama reports GPU discovery or runner startup timeouts, stop the tray instance and start it from PowerShell with `$env:OLLAMA_LLM_LIBRARY='cpu_avx2'; ollama serve` to use the stable CPU runner. Ollama documents this library override for bypassing GPU auto-detection.
7. Copy `.env.example` to `.env` and change the executable/model paths if needed. Restart PrepAI; **LOCAL VIDEO SERVICES** reports Java, JDK compiler, yt-dlp, FFmpeg, whisper.cpp/model, and Ollama status. Uploads are limited by `MAX_MEDIA_FILE_MB` (default 1024 MB). Java asks FFmpeg to split audio into ten-minute chunks and whisper.cpp to transcribe each chunk with timestamps.

On Windows, set `JAVA_COMMAND`, `JAVAC_COMMAND`, `YT_DLP_COMMAND`, `FFMPEG_COMMAND`, and `WHISPER_COMMAND` in `.env` to the full `.exe` paths if a tool is not on PATH. Use forward slashes, for example `FFMPEG_COMMAND=C:/tools/ffmpeg/bin/ffmpeg.exe`. yt-dlp is started directly as an executable (not through Python), and its audio-download fallback receives the configured FFmpeg folder. Keep model weights and downloaded executables local; `.gitignore` excludes them.

The language selectors use all 100 multilingual language codes supported by whisper.cpp, plus Auto Detect for spoken language. The original transcript is preserved; Ollama generates learner-facing content in the selected explanation language. Translation quality depends on the selected local model.

PrepAI tries available public YouTube captions first and uses yt-dlp audio retrieval plus Java/FFmpeg/whisper.cpp when captions are unavailable. Private, age-restricted, region-blocked, DRM-protected, or otherwise inaccessible videos may fail. Media temporary files are removed after processing; transcripts and study packs remain in the user's MongoDB account. Background jobs are in-memory and are lost if the API process restarts before a job completes.

## Production build and deployment

```powershell
pnpm.cmd build
$env:NODE_ENV = 'production'
pnpm.cmd start
```

Express serves client/dist and /api from one origin. Provide MongoDB and SESSION_SECRET through the deployment platform's secret manager. Set HOST=0.0.0.0 when the platform requires binding to all interfaces. Do not commit .env or database credentials. No public deployment is configured.

## Verification

```powershell
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
Invoke-RestMethod http://127.0.0.1:5000/api/learning/services
```

GET /api/health reports API and MongoDB status. Use pnpm.cmd dev in PowerShell to avoid the pnpm.ps1 execution-policy restriction. The VS Code task **PrepAI: Start app** uses the same command.

## Known limitations

- The interview evaluator is a local reference-clause rubric, not a language model. It flags answers without enough aligned evidence as **Needs manual review**; scores are an approximate text comparison and do not establish semantic correctness.
- Voice questions use browser speech synthesis; microphone transcription requires browser support and permission. Typed answers remain available.
- Local video explanations are generated by the configured Ollama model and can contain model errors. They are constrained to transcript evidence, retain source references when available, and should be checked against the saved original transcript. If Whisper, FFmpeg, yt-dlp, MongoDB, or the Ollama model is unavailable, processing reports a clear failure and does not save a fabricated study pack.
- Lint tooling is not configured in the existing project. The test command covers question-bank shape and evaluated, partial, irrelevant, and empty answer cases; the production build parses the frontend.
