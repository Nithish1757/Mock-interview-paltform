const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

// whisper.cpp supports these 100 multilingual language codes, including Cantonese.
const languageEntries = [
  ['English','en'],['Chinese','zh'],['German','de'],['Spanish','es'],['Russian','ru'],['Korean','ko'],['French','fr'],['Japanese','ja'],['Portuguese','pt'],['Turkish','tr'],['Polish','pl'],['Catalan','ca'],['Dutch','nl'],['Arabic','ar'],['Swedish','sv'],['Italian','it'],['Indonesian','id'],['Hindi','hi'],['Finnish','fi'],['Vietnamese','vi'],['Hebrew','he'],['Ukrainian','uk'],['Greek','el'],['Malay','ms'],['Czech','cs'],['Romanian','ro'],['Danish','da'],['Hungarian','hu'],['Tamil','ta'],['Norwegian','no'],['Thai','th'],['Urdu','ur'],['Croatian','hr'],['Bulgarian','bg'],['Lithuanian','lt'],['Latin','la'],['Maori','mi'],['Malayalam','ml'],['Welsh','cy'],['Slovak','sk'],['Telugu','te'],['Persian','fa'],['Latvian','lv'],['Bengali','bn'],['Serbian','sr'],['Azerbaijani','az'],['Slovenian','sl'],['Kannada','kn'],['Estonian','et'],['Macedonian','mk'],['Breton','br'],['Basque','eu'],['Icelandic','is'],['Armenian','hy'],['Nepali','ne'],['Mongolian','mn'],['Bosnian','bs'],['Kazakh','kk'],['Albanian','sq'],['Swahili','sw'],['Galician','gl'],['Marathi','mr'],['Punjabi','pa'],['Sinhala','si'],['Khmer','km'],['Shona','sn'],['Yoruba','yo'],['Somali','so'],['Afrikaans','af'],['Occitan','oc'],['Georgian','ka'],['Belarusian','be'],['Tajik','tg'],['Sindhi','sd'],['Gujarati','gu'],['Amharic','am'],['Yiddish','yi'],['Lao','lo'],['Uzbek','uz'],['Faroese','fo'],['Haitian Creole','ht'],['Pashto','ps'],['Turkmen','tk'],['Nynorsk','nn'],['Maltese','mt'],['Sanskrit','sa'],['Luxembourgish','lb'],['Myanmar','my'],['Tibetan','bo'],['Tagalog','tl'],['Malagasy','mg'],['Assamese','as'],['Tatar','tt'],['Hawaiian','haw'],['Lingala','ln'],['Hausa','ha'],['Bashkir','ba'],['Javanese','jw'],['Sundanese','su'],['Cantonese','yue'],
];
const languages = Object.fromEntries(languageEntries);
const supportedLanguages = languageEntries.map(([name, code]) => ({ name, code }));

function executable(envName, fallback) {
  const configured = (process.env[envName] || fallback).trim().replace(/^"|"$/g, '');
  return process.platform === 'win32' && !path.extname(configured) ? `${configured}.exe` : configured;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = options.timeout > 0 ? setTimeout(() => { timedOut = true; child.kill(); }, options.timeout) : null;
    child.stdout?.on('data', data => { stdout += data.toString(); });
    child.stderr?.on('data', data => { stderr += data.toString(); });
    child.on('error', error => {
      const failure = new Error(error.code === 'ENOENT' ? `${command} is missing or not on PATH.` : error.code === 'EACCES' ? `${command} could not run; check its PATH entry and Windows permissions.` : `${command} could not start: ${error.message}`);
      failure.code = error.code;
      reject(failure);
    });
    child.on('close', code => {
      if (timer) clearTimeout(timer);
      if (timedOut) return reject(new Error(`${command} timed out after ${Math.ceil(options.timeout / 1000)} seconds.`));
      return code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr.trim() || `${command} exited with code ${code}.`));
    });
  });
}

async function runYtDlp(args, options = {}) {
  const command = executable('YT_DLP_COMMAND', 'yt-dlp');
  try { return await run(command, args, options); }
  catch (error) {
    if (error.code === 'ENOENT' || /missing or not on PATH/i.test(error.message)) {
      const missing = new Error('yt-dlp.exe is unavailable. Install the standalone Windows executable and add it to PATH, or set YT_DLP_COMMAND to its full path.');
      missing.code = 'TOOL_MISSING';
      throw missing;
    }
    throw error;
  }
}

async function checkServices() {
  const checkCommand = async (command, args, label) => {
    try { const result = await run(command, args, { timeout: 10000 }); return { available: true, version: (result.stdout || result.stderr).trim().split(/\r?\n/)[0], label }; }
    catch (error) { return { available: false, label, error: error.message }; }
  };
  const javaSource = path.join(__dirname, 'video-service', 'VideoProcessor.java');
  const [java, javac, ytDlp, ffmpeg, whisper] = await Promise.all([
    checkCommand(executable('JAVA_COMMAND', 'java'), [javaSource, '--check'], 'Java video worker'),
    checkCommand(executable('JAVAC_COMMAND', 'javac'), ['-version'], 'Java compiler (JDK)'),
    (async () => { try { const result = await runYtDlp(['--version'], { timeout: 10000 }); return { available: true, version: (result.stdout || result.stderr).trim().split(/\r?\n/)[0], label: 'yt-dlp' }; } catch (error) { return { available: false, label: 'yt-dlp', error: error.message }; } })(),
    checkCommand(executable('FFMPEG_COMMAND', 'ffmpeg'), ['-version'], 'FFmpeg'),
    (async () => { try { const command = executable('WHISPER_COMMAND', 'whisper-cli'); const result = await run(command, ['--help'], { timeout: 10000 }); const model = process.env.WHISPER_MODEL_PATH || path.resolve(__dirname, '../models/ggml-small.bin'); const modelInstalled = await fs.stat(model).then(item => item.isFile()).catch(() => false); return { available: true, version: (result.stdout || result.stderr).trim().split(/\r?\n/)[0], model, modelInstalled, error: modelInstalled ? undefined : `Whisper model not found at ${model}. Set WHISPER_MODEL_PATH.`, label: 'whisper.cpp' }; } catch (error) { return { available: false, label: 'whisper.cpp', error: error.code === 'ENOENT' ? 'whisper-cli.exe is missing or not on PATH. Install whisper.cpp and set WHISPER_COMMAND.' : error.message }; } })(),
  ]);
  let ollama = { available: false, label: 'Ollama' };
  try {
    const response = await fetch(`${(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const data = await response.json();
      const model = process.env.OLLAMA_MODEL || 'llama3.2';
      const installed = (data.models || []).some(item => item.name === model || item.name.startsWith(`${model}:`));
      ollama = { available: true, model, modelInstalled: installed, label: 'Ollama' };
    }
  } catch (error) { ollama.error = error.message; }
  return { java, javac, ytDlp, ffmpeg, whisper, ollama };
}

function timeLabel(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseVtt(vtt) {
  return vtt.replace(/^WEBVTT[^\n]*\n+/i, '').split(/\n\s*\n/).flatMap(block => {
    const lines = block.split(/\r?\n/);
    const timingIndex = lines.findIndex(line => line.includes('-->'));
    if (timingIndex < 0) return [];
    const match = lines[timingIndex].match(/(\d{2}:)?(\d{2}):(\d{2})[.,](\d{3})/);
    if (!match) return [];
    const start = Number(match[1] ? match[1].slice(0, 2) : 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    const text = lines.slice(timingIndex + 1).join(' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    return text ? [{ start, end: start, text }] : [];
  });
}

async function ollamaJson(system, prompt, timeoutMs = 900000) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llama3.2';
  let response;
  try {
    response = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: false, format: 'json', keep_alive: process.env.OLLAMA_KEEP_ALIVE || '30m', messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], options: { temperature: 0.2 } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' ? `Ollama timed out while running ${model}. Ensure the local model is loaded and retry.` : `Ollama is unavailable at ${base}. Start Ollama and pull ${model}.`);
  }
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404) throw new Error(`Ollama model “${model}” is missing. Run: ollama pull ${model}`);
    throw new Error(`Ollama request failed (${response.status}): ${text.slice(0, 400)}`);
  }
  const data = await response.json();
  try { return JSON.parse(data.message?.content || ''); }
  catch { throw new Error('Ollama returned an unreadable learning pack. No session was saved; try again or select a larger local model.'); }
}

function splitTranscript(text, maxChars = 14000) {
  const blocks = String(text).split(/\n+/);
  const chunks = [];
  let current = '';
  for (const block of blocks) {
    if (block.length > maxChars) {
      if (current) { chunks.push(current); current = ''; }
      for (let start = 0; start < block.length; start += maxChars) chunks.push(block.slice(start, start + maxChars));
      continue;
    }
    if (current.length + block.length + 1 > maxChars) { chunks.push(current); current = ''; }
    current += (current ? '\n' : '') + block;
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [String(text)];
}

function languageName(code) {
  const normalized = String(code || '').trim().toLowerCase();
  const pair = Object.entries(languages).find(([name, value]) => value.toLowerCase() === normalized || name.toLowerCase() === normalized);
  return pair?.[0] || code || 'Unknown';
}

async function analyzeTranscript(transcript, segments, title, explanationLanguage, onProgress) {
  const chunks = splitTranscript(transcript);
  const partials = [];
  for (let index = 0; index < chunks.length; index++) {
    onProgress('analyzing', 62 + Math.round((index / chunks.length) * 18), `Analyzing transcript section ${index + 1} of ${chunks.length}`);
    const system = `You are a careful video-learning teacher. Analyze only the supplied transcript; never infer facts from the title or outside knowledge. Write all learner-facing text in ${explanationLanguage}. Preserve technical terms. For this section only, return compact JSON {summary,keyPoints,notes,importantTimestamps}. Limit each array to five items. Explain only what this section supports, label source statements “From the video”, preserve exact timestamps/short quotations when present, and do not generate final questions or examples yet.`;
    const partial = await ollamaJson(system, `Video title (context only): ${title}\nAnalyze this transcript section and cite its [mm:ss] markers when present:\n${chunks[index]}`);
    partials.push(partial);
  }
  onProgress('preparing', 82, 'Preparing the complete study pack');
  const refs = (segments || []).map(item => Number.isFinite(item.start) ? `[${timeLabel(item.start)}] ${item.text}` : item.text).join('\n');
  const system = `You create accurate study content from video transcript analysis. Only state facts supported by the supplied transcript extracts. Title is context only. Return valid JSON with fields: summary, explanation, notes (array of strings), keyPoints (array of strings), revisionPoints (array of strings), examples (array of {title,code,explanation}), questions (array of strings), answers (array of strings aligned to questions), quiz (array of {question,options,answerIndex}), flashcards (array of {front,back}), whatToLearnNext (array of strings), importantTimestamps (array of {timestamp,point}). All learner-facing content must be in ${explanationLanguage}; keep original technical terms where useful. Include timestamps or short source quotations when available. Label video-supported statements “From the video” and extra teaching “Additional explanation”. Explain definitions, examples, and steps only when supported. If evidence is missing, say so, do not invent it.`;
  const content = await ollamaJson(system, `Video title (not evidence): ${title}\nTranscript-derived section analyses:\n${JSON.stringify(partials)}\nTimestamped source transcript:\n${refs.slice(0, 100000)}`);
  if (!String(content.summary || '').trim() || !String(content.explanation || '').trim()) throw new Error('Ollama did not produce a complete explanation. No study pack was saved; retry with the local model available.');
  const array = key => Array.isArray(content[key]) ? content[key] : [];
  const questions = array('questions').slice(0, 20);
  const answers = array('answers').slice(0, questions.length);
  const quiz = array('quiz').map(item => ({ ...item, answer: Number.isInteger(item.answerIndex) ? item.answerIndex : (Number.isInteger(item.answer) ? item.answer : 0) })).filter(item => Array.isArray(item.options) && item.options.length > 1);
  const validTimes = new Set((segments || []).filter(item => Number.isFinite(item.start)).map(item => timeLabel(item.start)));
  const importantTimestamps = array('importantTimestamps').filter(item => validTimes.has(String(item.timestamp || item.time || '').replace(/^\[|\]$/g, '')));
  return {
    summary: content.summary, explanation: content.explanation,
    notes: array('notes'), keyPoints: array('keyPoints'), revisionPoints: array('revisionPoints'), whatToLearnNext: array('whatToLearnNext'),
    examples: array('examples'), questions, answers, quiz, flashcards: array('flashcards'),
    importantTimestamps,
  };
}

async function runJavaVideoProcessor(input, workDir, languageCode, onProgress) {
  const java = executable('JAVA_COMMAND', 'java');
  const source = path.join(__dirname, 'video-service', 'VideoProcessor.java');
  const ffmpeg = executable('FFMPEG_COMMAND', 'ffmpeg');
  const whisper = executable('WHISPER_COMMAND', 'whisper-cli');
  const model = path.resolve(process.env.WHISPER_MODEL_PATH || path.join(__dirname, '../models/ggml-small.bin'));
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let pending = '';
    const child = spawn(java, [source, input, workDir, ffmpeg, whisper, model, languageCode || 'auto'], { windowsHide: true });
    child.stdout.on('data', data => {
      pending += data.toString();
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('PROGRESS\t')) {
          const [, stage, percent, ...message] = line.split('\t');
          onProgress(stage, Number(percent), message.join(' '));
        } else if (line) stdout += `${line}\n`;
      }
    });
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-5000); });
    child.on('error', error => reject(new Error(error.code === 'ENOENT' ? 'Java is missing or not on PATH. Install JDK 21 and restart the backend.' : `Java video worker could not start: ${error.message}`)));
    child.on('close', code => {
      if (pending && !pending.startsWith('PROGRESS\t')) stdout += pending;
      if (code === 0) return resolve({ stdout, stderr });
      const detail = stderr.trim() || stdout.trim() || `Java video worker exited with code ${code}.`;
      if (/ffmpeg is unavailable/i.test(detail)) return reject(new Error('FFmpeg is missing. Install FFmpeg and add its bin folder to PATH.'));
      if (/whisper-cli(?:\.exe)? is unavailable/i.test(detail)) return reject(new Error('whisper.cpp is missing. Install whisper.cpp, add whisper-cli to PATH, and configure WHISPER_COMMAND.'));
      reject(new Error(detail.slice(-1800)));
    });
  });
}

function parseWhisperTimestamp(value) {
  const match = String(value || '').match(/(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return null;
  return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function parseWhisperResult(result, offsetSeconds = 0) {
  const segments = (Array.isArray(result.transcription) ? result.transcription : []).flatMap(segment => {
    const start = parseWhisperTimestamp(segment.timestamps?.from);
    const end = parseWhisperTimestamp(segment.timestamps?.to);
    const text = String(segment.text || '').trim();
    return text ? [{ start: start == null ? null : start + offsetSeconds, end: end == null ? null : end + offsetSeconds, text }] : [];
  });
  return { segments, detectedLanguage: languageName(result.result?.language) };
}

async function transcribeChunks(input, workDir, videoLanguage, onProgress) {
  const languageCode = languages[videoLanguage] || 'auto';
  try { await runJavaVideoProcessor(input, workDir, languageCode, onProgress); }
  catch (error) {
    if (/^FFmpeg is missing/i.test(error.message)) throw error;
    if (/^Java is missing/i.test(error.message)) throw error;
    if (/ffmpeg is unavailable/i.test(error.message)) throw new Error('FFmpeg is missing. Install FFmpeg and add its bin folder to PATH.');
    if (/cannot find the file specified|model file is missing/i.test(error.message)) throw new Error('Whisper model file is missing. Download a multilingual whisper.cpp model and set WHISPER_MODEL_PATH.');
    if (/does not contain any stream|matches no streams|no audio track/i.test(error.message)) throw new Error('No audio track was found. Choose a video/audio file with an audio stream.');
    throw new Error(`Java video processing failed: ${error.message.slice(-1200)}`);
  }
  const resultFiles = (await fs.readdir(workDir)).filter(name => /^recognized-\d+\.json$/i.test(name)).sort();
  if (!resultFiles.length) throw new Error('whisper.cpp completed without a transcript. No learning pack was created.');
  const segments = [];
  let detectedLanguage = '';
  for (let index = 0; index < resultFiles.length; index++) {
    let result;
    try { result = JSON.parse(await fs.readFile(path.join(workDir, resultFiles[index]), 'utf8')); }
    catch { throw new Error(`whisper.cpp returned invalid transcript data for chunk ${index + 1}.`); }
    const parsed = parseWhisperResult(result, index * 600);
    if (!detectedLanguage) detectedLanguage = parsed.detectedLanguage;
    segments.push(...parsed.segments);
  }
  if (!segments.length) throw new Error('whisper.cpp completed but found no speech. Check that the audio contains audible speech.');
  return { segments, detectedLanguage: languageName(detectedLanguage) };
}

function renderTranscript(segments) { return segments.map(segment => `${Number.isFinite(segment.start) ? `[${timeLabel(segment.start)}] ` : ''}${segment.text}`).join('\n'); }

async function processVideoLearning({ title, sourceType, sourceUrl, videoLanguage, explanationLanguage, transcript, file, onProgress }) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepai-video-'));
  let inputPath = file?.path || '';
  let actualTitle = title || file?.originalname || 'Video learning session';
  let sourceMetadata = {};
  let segments = [];
  let sourceLanguage = videoLanguage === 'Auto Detect' ? 'Unknown' : videoLanguage;
  try {
    if (sourceType === 'youtube') {
      onProgress('captions', 5, 'Retrieving available YouTube captions and metadata');
      const retryOptions = ['--retries', '3', '--extractor-retries', '3', '--fragment-retries', '3', '--sleep-requests', '1'];
      let metadata;
      try {
        const result = await runYtDlp(['--no-warnings', '--skip-download', '--dump-single-json', ...retryOptions, sourceUrl], { timeout: 0 });
        metadata = JSON.parse(result.stdout);
      } catch (error) {
        if (error.code === 'TOOL_MISSING') throw error;
        throw new Error(`YouTube metadata could not be retrieved. Confirm the video is public and accessible: ${error.message.slice(-500)}`);
      }
      actualTitle = title || metadata.title || actualTitle;
      sourceMetadata = { platform: 'YouTube', videoTitle: metadata.title || actualTitle, durationSeconds: Number(metadata.duration) || undefined, channel: String(metadata.channel || metadata.uploader || '').slice(0, 160), uploadDate: String(metadata.upload_date || '').slice(0, 8) };
      onProgress('captions', 10, 'Retrieving available YouTube captions');
      const languageCode = languages[videoLanguage] || '';
      let captionError = '';
      try {
        await runYtDlp(['--no-warnings', '--skip-download', '--write-subs', '--write-auto-subs', '--sub-format', 'vtt', '--sub-langs', languageCode || 'all', '--sleep-subtitles', '1', ...retryOptions, '-o', path.join(workDir, 'source.%(ext)s'), sourceUrl], { timeout: 0 });
      } catch (error) { captionError = error.message; }
      const files = await fs.readdir(workDir);
      const captions = files.filter(name => name.endsWith('.vtt')).sort((a, b) => {
        const wanted = languages[videoLanguage];
        return wanted ? Number(!a.includes(wanted)) - Number(!b.includes(wanted)) : 0;
      });
      if (captions.length) {
        const captionText = await fs.readFile(path.join(workDir, captions[0]), 'utf8');
        segments = parseVtt(captionText);
        const code = captions[0].match(/\.([a-z]{2,3})(?:-[^.]+)?\.vtt$/i)?.[1];
        if (videoLanguage === 'Auto Detect' && code) sourceLanguage = languageName(code);
      }
      if (!segments.length) {
        onProgress('extracting', 14, captionError ? 'Captions were unavailable; retrying with YouTube audio' : 'No captions were available; downloading audio for local transcription');
        try {
          const ffmpegCommand = executable('FFMPEG_COMMAND', 'ffmpeg');
          const ffmpegLocation = path.dirname(path.resolve(ffmpegCommand));
          const ffmpegArgs = process.env.FFMPEG_COMMAND && (process.env.FFMPEG_COMMAND.includes('/') || process.env.FFMPEG_COMMAND.includes('\\')) ? ['--ffmpeg-location', ffmpegLocation] : [];
          await runYtDlp(['--no-warnings', '-f', 'bestaudio', '-x', '--audio-format', 'wav', ...retryOptions, ...ffmpegArgs, '-o', path.join(workDir, 'youtube-audio.%(ext)s'), sourceUrl], { timeout: 0 });
        } catch (error) { throw new Error(`YouTube captions${captionError ? ` failed (${captionError.slice(-300)})` : ' are unavailable'} and audio fallback failed: ${error.message.slice(-600)}`); }
        const audioName = (await fs.readdir(workDir)).find(name => /^youtube-audio\./.test(name));
        if (!audioName) throw new Error('YouTube audio download completed without an audio file.');
        inputPath = path.join(workDir, audioName);
      }
    } else if (sourceType === 'transcript') {
      onProgress('analyzing', 30, 'Using the pasted transcript as the source');
      if (String(transcript || '').trim().length < 30) throw new Error('Paste at least 30 characters of transcript.');
      segments = String(transcript).split(/\n+/).filter(Boolean).map(line => {
        const marker = line.match(/^\[(?:(\d{2}):)?(\d{2}):(\d{2})\]\s*(.*)$/);
        const start = marker ? Number(marker[1] || 0) * 3600 + Number(marker[2]) * 60 + Number(marker[3]) : null;
        return marker ? { start, end: start, text: marker[4] } : { text: line.trim() };
      });
      if (videoLanguage === 'Auto Detect') {
        const detection = await ollamaJson('Detect only the dominant language of this transcript. Return JSON {language} with a common language name. Do not translate or summarize.', String(transcript).slice(0, 4000), 60000);
        sourceLanguage = String(detection.language || 'Unknown');
      }
    } else if (sourceType === 'upload') {
      if (!file) throw new Error('Choose a video or audio file to upload.');
      onProgress('extracting', 12, 'Checking local media and extracting audio');
    } else throw new Error('Choose a YouTube URL, local media upload, or transcript.');

    if (inputPath) {
      const transcription = await transcribeChunks(inputPath, workDir, videoLanguage, onProgress);
      segments = transcription.segments;
      if (videoLanguage === 'Auto Detect') sourceLanguage = transcription.detectedLanguage;
    }
    if (!segments.length) throw new Error('No usable captions or transcript were found. No learning pack was created.');
    const sourceTranscript = renderTranscript(segments);
    if (Buffer.byteLength(sourceTranscript, 'utf8') > 10 * 1024 * 1024) throw new Error('Transcript is larger than the safe MongoDB storage limit. No study pack was saved.');
    onProgress('analyzing', 60, 'Analyzing transcript content with local Ollama');
    const content = await analyzeTranscript(sourceTranscript, segments, actualTitle, explanationLanguage || 'English', onProgress);
    return { ...content, title: actualTitle, transcript: sourceTranscript, segments, sourceMetadata, sourceLanguage, videoLanguage, outputLanguage: explanationLanguage || 'English', explanationLanguage: explanationLanguage || 'English', generationMode: 'local-whisper-ollama', fallbackLabel: 'Local video analysis — Whisper transcript + Ollama explanation.', titlePracticeLabel: undefined };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (file?.path) await fs.rm(file.path, { force: true }).catch(() => {});
  }
}

async function answerVideoQuestion(record, question) {
  const transcript = String(record.transcript || '');
  const lines = transcript.split(/\n+/).filter(Boolean);
  const outputLanguage = record.outputLanguage || 'English';
  const sourceLanguage = record.sourceLanguage || 'English';
  const rankLines = searchText => {
    const rawTerms = searchText.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
    const terms = [...new Set(rawTerms.flatMap(term => term.length > 4 && term.endsWith('s') ? [term, term.slice(0, -1)] : [term]))];
    return lines.map((line, index) => ({ line, index, score: terms.reduce((sum, term) => sum + Number(line.toLowerCase().includes(term)), 0) }))
      .filter(row => row.score).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 12).sort((a, b) => a.index - b.index);
  };
  let ranked = rankLines(question);
  let retrievalQuestion = question;
  if (!ranked.length && sourceLanguage !== 'Unknown') {
    const translation = await ollamaJson(
      `Translate the question into ${sourceLanguage} to help locate relevant transcript lines. Return JSON {translatedQuestion}. Preserve technical terms and do not answer the question.`,
      question,
      60000,
    ).catch(() => ({}));
    retrievalQuestion = String(translation.translatedQuestion || question);
    ranked = rankLines(retrievalQuestion);
  }
  let references = ranked.map(row => row.line);
  if (!references.length) {
    const candidates = lines.slice(0, 60).map((line, index) => ({ line, index }));
    const context = candidates.map(row => `SOURCE LINE ${row.index}: ${row.line}`).join('\n').slice(0, 22000);
    const selection = await ollamaJson(
      `Check whether the numbered transcript lines explicitly answer the question. Return JSON {supported:boolean,sourceLineNumbers:[integers]}. Select only the minimum lines that contain the answer. The integers must be copied from SOURCE LINE labels. Return supported=false and an empty list when the transcript does not answer it.`,
      `Question in the transcript language: ${retrievalQuestion}\nTranscript lines:\n${context}`,
      120000,
    );
    const candidateIndexes = new Set(candidates.map(row => row.index));
    const selectedIndexes = Array.isArray(selection.sourceLineNumbers)
      ? [...new Set(selection.sourceLineNumbers.map(Number).filter(index => Number.isInteger(index) && candidateIndexes.has(index)))].slice(0, 5)
      : [];
    if (selection.supported === true) references = selectedIndexes.map(index => lines[index]);
  }
  if (!references.length) {
    const localized = await ollamaJson(
      `Translate the fixed no-evidence notice into ${outputLanguage}. Return JSON {notice}. Do not add advice or facts.`,
      'Notice: The saved transcript does not contain enough evidence to answer this question reliably.',
      30000,
    ).catch(() => ({ notice: 'The saved transcript does not contain enough evidence to answer this question reliably.' }));
    return { answer: String(localized.notice || 'The saved transcript does not contain enough evidence to answer this question reliably.'), mode: 'transcript-grounded', sourceReferences: [] };
  }
  const translated = await ollamaJson(
    `Answer the question entirely in ${outputLanguage} by translating and explaining only the selected transcript evidence. Do not add facts, examples, or details that the evidence does not state. Preserve technical terms when useful. Return JSON {answer}.`,
    `Question: ${question}\nSelected verbatim transcript evidence:\n${references.join('\n')}`,
    120000,
  );
  return { answer: `${String(translated.answer || '')}\n\nTranscript reference: ${references.join(' · ')}`, mode: 'transcript-grounded-ollama', sourceReferences: references };
}

module.exports = { checkServices, processVideoLearning, answerVideoQuestion, ollamaJson, parseVtt, parseWhisperResult, splitTranscript, renderTranscript, timeLabel, supportedLanguages };
