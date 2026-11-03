const express = require('express');
const mongoose = require('mongoose');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { Learning, Interview } = require('../models/Record');
const { publicUser } = require('../auth');
const { topicNames, INTERVIEW_QUESTION_COUNT, buildQuestions, evaluateAnswer } = require('../interviewBank');
const { checkServices, processVideoLearning, answerVideoQuestion, ollamaJson, supportedLanguages } = require('../videoLearning');

const router = express.Router();
const languages = supportedLanguages.map(language => language.name);
const videoLanguages = ['Auto Detect', ...languages];
const videoJobs = new Map();
const uploadDir = path.join(os.tmpdir(), 'prepai-uploads');

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  throw error;
}

function detectLanguage(text = '') {
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi';
  if (/[\u3040-\u30ff]/.test(text)) return 'Japanese';
  if (/[\u4e00-\u9fff]/.test(text)) return 'Chinese';
  if (/[\uac00-\ud7af]/.test(text)) return 'Korean';
  if (/[\u0600-\u06ff]/.test(text)) return 'Arabic';
  if (/[\u0400-\u04ff]/.test(text)) return 'Russian';
  const lower = text.toLowerCase();
  if (/[¿¡ñáéíóú]/.test(lower) || /\b(el|los|las|una|que|para|con|índice|datos)\b/.test(lower)) return 'Spanish';
  if (/[àâçéèêëîïôûùüÿœ]/.test(lower) || /\b(le|les|une|des|avec|pour|données)\b/.test(lower)) return 'French';
  if (/[äöüß]/.test(lower) || /\b(der|die|das|und|für|mit)\b/.test(lower)) return 'German';
  if (/[ãõ]/.test(lower) || /\b(uma|para|com|dados|você)\b/.test(lower)) return 'Portuguese';
  if (/\b(il|lo|la|gli|una|con|per|dati)\b/.test(lower)) return 'Italian';
  return 'English';
}

function titleTopicGuide(title) {
  const library = [
    { match: /\bhtml\b|hypertext markup language/i, name: 'HTML', summary: 'HTML defines the structure and meaning of web pages.', explanation: 'Build a document with semantic elements, descriptive links, accessible images, and labeled forms. HTML supplies structure; CSS supplies presentation; JavaScript adds behavior.', concepts: ['Document structure: use doctype, html, head, and body.', 'Semantic markup: main, nav, article, and footer describe page regions.', 'Accessibility: label form inputs and provide useful image alt text.', 'Links and forms: use native elements for navigation and user input.'], exampleTitle: 'A small semantic page', code: '<main>\n  <h1>Study notes</h1>\n  <p>Learn one concept at a time.</p>\n  <a href="/progress">View progress</a>\n</main>', qa: [['What does HTML stand for?', 'HTML stands for HyperText Markup Language.'], ['What is HTML used for?', 'HTML describes the structure and meaning of web content. CSS handles presentation and JavaScript adds behavior.'], ['What is the difference between a tag and an element?', 'A tag is markup such as <p> or </p>. An element is the complete construct, including its tags and content.'], ['Why use semantic HTML?', 'Semantic elements communicate the purpose of page regions to browsers and assistive technology.'], ['How do I make an image accessible?', 'Use concise alt text for meaningful images and empty alt text for decorative images.'], ['What are forms for?', 'Forms collect user input through controls such as input, select, and textarea.']] },
    { match: /\bjava\b/i, name: 'Java', summary: 'Java is a statically typed, class-based language commonly compiled to JVM bytecode.', explanation: 'Java programs organize behavior in classes and methods. The compiler checks types and produces bytecode that runs on a Java Virtual Machine. Start by understanding types, control flow, methods, classes, collections, and exceptions.', concepts: ['Types and variables: declare values with a type such as int or String.', 'Methods: package reusable behavior behind parameters and return values.', 'Classes and objects: define state and behavior; construct objects with new.', 'Collections and exceptions: use List or Map for groups and handle expected failures explicitly.'], exampleTitle: 'A small Java program', code: 'public class Main {\n  public static void main(String[] args) {\n    String name = "PrepAI";\n    System.out.println("Hello, " + name);\n  }\n}', qa: [['What is the JVM?', 'The Java Virtual Machine runs Java bytecode and provides a runtime environment for Java programs.'], ['What is a class?', 'A class is a definition for objects, describing their fields and methods.'], ['What is the difference between int and Integer?', 'int is a primitive numeric type. Integer is its wrapper class and can be null or used where an object is required.'], ['What does static mean in main?', 'A static method belongs to the class and can run without first creating an instance of that class.'], ['What is an exception?', 'An exception represents an error or unusual condition that interrupts normal control flow and can be handled with try/catch.']] },
    { match: /\breact\b/i, name: 'React', summary: 'React is a JavaScript library for building user interfaces from reusable components.', explanation: 'A React interface is a tree of components. Props pass data into components, state stores values that change over time, and rendering updates the UI from the current state. Keep side effects in effects or event handlers.', concepts: ['Components: reusable functions that return UI.', 'Props: read-only inputs passed from a parent component.', 'State: component data updated with a setter such as setCount.', 'Rendering: state and props determine the displayed interface; keys help React track list items.'], exampleTitle: 'A stateful React component', code: 'import { useState } from "react";\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Count: {count}\n    </button>\n  );\n}', qa: [['What is a React component?', 'A React component is a reusable unit of UI, commonly a JavaScript function that returns JSX.'], ['What are props?', 'Props are read-only values a parent passes to a child component.'], ['What is state?', 'State is component data that can change; updating it schedules a re-render.'], ['Why do list items need keys?', 'Keys let React match list items across renders so it can update the correct elements efficiently.'], ['When should I use useEffect?', 'Use an effect to synchronize a component with an external system, such as a subscription or browser API. Do not use it for values that can be calculated during render.']] },
    { match: /\bjavascript\b|\bjs\b/i, name: 'JavaScript', summary: 'JavaScript is a dynamically typed language used in browsers, servers, and other runtimes.', explanation: 'Learn values and types, functions, objects, modules, asynchronous promises, and error handling. In browsers it can respond to events and update the DOM; on servers a runtime such as Node.js provides APIs for I/O.', concepts: ['Bindings: const prevents reassignment; let allows reassignment.', 'Functions: values that can receive arguments and return results.', 'Objects and arrays: common structures for related data and ordered lists.', 'Promises and async/await: represent work that completes later.'], exampleTitle: 'An asynchronous function', code: 'async function loadUser() {\n  const response = await fetch("/api/profile");\n  if (!response.ok) throw new Error("Request failed");\n  return response.json();\n}', qa: [['What is a promise?', 'A promise represents the eventual completion or failure of an asynchronous operation.'], ['What does async/await do?', 'It provides syntax for writing promise-based asynchronous code in a sequential style.'], ['What is the difference between let and const?', 'Both are block-scoped; let bindings can be reassigned, while const bindings cannot. A const object’s properties may still change.'], ['What is a closure?', 'A closure is a function together with access to variables from its surrounding lexical scope.']] },
    { match: /\bcss\b|cascading style sheets/i, name: 'CSS', summary: 'CSS controls the visual presentation and layout of documents.', explanation: 'Rules match elements with selectors and assign declarations. The cascade resolves competing rules using origin, importance, layers, specificity, and source order. Layout tools include flexbox and grid.', concepts: ['Selectors choose elements to style.', 'The box model includes content, padding, border, and margin.', 'Flexbox lays out items along one axis; Grid handles rows and columns.', 'Responsive design adapts layouts with fluid sizing and media queries.'], exampleTitle: 'A responsive card', code: '.card {\n  display: grid;\n  gap: 1rem;\n  padding: 1rem;\n}\n@media (min-width: 48rem) {\n  .card { grid-template-columns: 1fr 2fr; }\n}', qa: [['What is the CSS box model?', 'It describes an element as content surrounded by padding, border, and margin.'], ['What is specificity?', 'Specificity is a priority used to resolve competing selector rules within the cascade.'], ['When should I use Grid versus Flexbox?', 'Grid is suited to two-dimensional row-and-column layouts; Flexbox is suited to arranging items along one axis.']] },
    { match: /\bpython\b/i, name: 'Python', summary: 'Python is a high-level, general-purpose programming language with dynamic typing.', explanation: 'Python code uses indentation to delimit blocks. Core building blocks include values, functions, collections, modules, exceptions, and classes. Prefer clear names and small functions, and use virtual environments to isolate project packages.', concepts: ['Indentation defines suites such as function and loop bodies.', 'Lists are ordered and mutable; tuples are ordered and immutable.', 'Dictionaries map keys to values.', 'Exceptions can be handled with try/except and cleaned up with finally or context managers.'], exampleTitle: 'A small Python function', code: 'def average(values):\n    if not values:\n        return None\n    return sum(values) / len(values)\n\nprint(average([2, 4, 6]))', qa: [['What is a dictionary?', 'A dictionary is a mutable mapping of keys to values.'], ['What does None mean?', 'None is Python’s singleton value representing the absence of a value.'], ['Why use a virtual environment?', 'A virtual environment isolates a project’s installed packages from other Python projects.']] },
    { match: /\bsql\b|database queries/i, name: 'SQL', summary: 'SQL is a language for defining, querying, and changing data in relational databases.', explanation: 'Tables contain rows and columns. Queries use SELECT to read data, WHERE to filter rows, JOIN to combine related tables, and INSERT, UPDATE, or DELETE to change records. Transactions group changes atomically.', concepts: ['Primary keys identify rows; foreign keys represent relationships.', 'SELECT and WHERE retrieve and filter rows.', 'JOIN combines rows using related columns.', 'Transactions provide atomic commit or rollback for a group of changes.'], exampleTitle: 'A filtered join query', code: 'SELECT students.name, sessions.title\nFROM students\nJOIN sessions ON sessions.student_id = students.id\nWHERE sessions.completed_at IS NOT NULL;', qa: [['What is a primary key?', 'A primary key uniquely identifies each row in a table.'], ['What does a JOIN do?', 'A JOIN combines rows from tables based on a related-column condition.'], ['What is a transaction?', 'A transaction groups database operations so they can commit together or roll back together.']] },
  ];
  const topic = library.find(item => item.match.test(String(title || '')));
  if (!topic) return null;
  const questions = topic.qa.map(item => item[0]);
  const answers = topic.qa.map(item => item[1]);
  const disclaimer = `Topic guide for ${topic.name}, based on built-in reference notes. It is not a summary of a video that was not processed.`;
  return {
    topicName: topic.name, sourceLanguage: 'Unknown', outputLanguage: 'English', summary: `${topic.summary} ${disclaimer}`,
    explanation: `${topic.explanation} ${disclaimer}`, notes: topic.concepts, keyPoints: topic.concepts.map(item => item.split(':')[0]),
    revisionPoints: topic.concepts.map(item => `Review: ${item.split(':')[0]}.`), examples: [{ title: topic.exampleTitle, code: topic.code, explanation: `Illustrative ${topic.name} example. Adapt it to your project and runtime.` }],
    questions, answers, quiz: [{ question: questions[0], options: [answers[0], 'The topic guide does not state this.', 'This is a CSS-only behavior.', 'This depends on the video source.'], answer: 0 }],
    flashcards: topic.qa.slice(0, 4).map(([front, back]) => ({ front, back })), titlePracticeLabel: 'Topic guide — not a summary of an unprocessed video.',
  };
}

function fallbackLearning(title, transcript, language, metadata = {}) {
  const text = String(transcript || '').trim();
  const sentences = text.split(/(?<=[.!?。！？])\s+|\n+/).map(item => item.trim()).filter(item => item.length >= 18);
  const label = 'Local topic guide — generated offline.';
  const titlePracticeLabel = 'Topic guide — not a summary of an unprocessed video.';
  if (!sentences.length) {
    const sessionTitle = String(title || metadata.fileName || (metadata.sourceUrl ? 'YouTube video session' : 'Uploaded media session')).trim();
    const guide = titleTopicGuide(sessionTitle);
    if (guide) return {
      ...guide, title: sessionTitle, transcript: '', sourceLanguage: 'Unknown', generationMode: 'local-fallback',
      fallbackLabel: label, titlePracticeLabel,
      summary: `${guide.summary} ${titlePracticeLabel}`,
    };
    const questions = [
      `What background ideas might help someone study “${sessionTitle}”?`,
      `What would you ask to verify claims related to “${sessionTitle}”?`,
      `What would you want to learn about “${sessionTitle}”?`,
    ];
    const disclaimer = 'The title alone does not verify the video content. Add a transcript for session-specific notes and answers.';
    return {
      title: sessionTitle, transcript: '', sourceLanguage: 'Unknown', generationMode: 'local-fallback', fallbackLabel: label, titlePracticeLabel,
      summary: `No transcript was available. PrepAI did not process the video. ${titlePracticeLabel}`,
      explanation: disclaimer, notes: [], keyPoints: [], revisionPoints: ['Paste a transcript to create content-based notes and verified answers.'],
      questions, answers: questions.map(() => disclaimer), quiz: [], flashcards: [],
    };
  }

  const stopWords = new Set('about after again also among because before being between both each from have into just more most other over same some than that them then there these they this through under very what when where which while with your will would have does their were been much many only such should could onto using use used'.split(' '));
  const frequency = new Map();
  const original = new Map();
  for (const word of text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]{3,}/gu) || []) {
    const key = word.toLowerCase();
    if (stopWords.has(key)) continue;
    frequency.set(key, (frequency.get(key) || 0) + 1);
    if (!original.has(key)) original.set(key, word);
  }
  const topics = [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word]) => original.get(word));
  const keyPoints = topics.slice(0, 5).map(topic => `Topic mentioned in the transcript: ${topic}`);
  const notes = topics.slice(0, 5).map(topic => `${topic}: ${sentences.filter(sentence => sentence.toLowerCase().includes(topic.toLowerCase())).slice(0, 2).join(' ')}`);
  const questionTopics = (topics.length ? topics : ['main idea']).slice(0, 3);
  const questions = questionTopics.map(topic => `According to the transcript, what does it say about ${topic}?`);
  const answers = questionTopics.map(topic => sentences.find(sentence => sentence.toLowerCase().includes(topic.toLowerCase())) || 'The transcript does not include enough detail to answer this.');
  const points = sentences.slice(0, 5);
  const topicGuide = titleTopicGuide(title);
  return {
    title: String(title || metadata.fileName || 'Untitled learning session').trim(), transcript: text, sourceLanguage: language,
    topicName: topicGuide?.topicName, generationMode: 'transcript-notes', fallbackLabel: label,
    summary: points.slice(0, 3).join(' '),
    explanation: `This overview is assembled from the supplied transcript only. ${points.slice(0, 3).join(' ')}${topicGuide ? ` A separate ${topicGuide.topicName} reference guide is also available below; it is not attributed to the transcript.` : ''}`,
    notes: [...(topicGuide?.notes || []), ...notes].slice(0, 10), keyPoints: [...(topicGuide?.keyPoints || []), ...keyPoints].slice(0, 10),
    revisionPoints: [...(topicGuide?.revisionPoints || []), ...questionTopics.map(topic => `Revisit the transcript passages about ${topic}.`)].slice(0, 10),
    examples: topicGuide?.examples || [],
    questions: [...(topicGuide?.questions || []), ...questions].slice(0, 10),
    answers: [...(topicGuide?.answers || []), ...answers].slice(0, 10),
    quiz: topicGuide?.quiz?.length ? topicGuide.quiz : (answers.length ? [{ question: `Which statement is present in the transcript about ${questionTopics[0]}?`, options: [answers[0], 'The transcript does not provide that detail.', 'This is not stated in the supplied transcript.', 'No source passage is available for this point.'], answer: 0 }] : []),
    flashcards: [...(topicGuide?.flashcards || []), ...questionTopics.map((topic, index) => ({ front: topic, back: answers[index] }))].slice(0, 10),
  };
}

function localSessionAnswer(record, question) {
  const transcript = String(record.transcript || '').trim();
  if (!transcript) {
    const ignored = new Set('what when where which this that with from about into does did have your they them then than been were will would could should there their video session transcript the and for are was can tell explain give show me please'.split(' '));
    const builtIn = titleTopicGuide(record.topicName || record.title);
    const topicName = String(record.topicName || builtIn?.topicName || record.title || '').trim();
    if (!record.topicName && !builtIn && !record.questions?.length) return { answer: `There is no built-in topic guide for ${record.title} yet. Add a transcript so I can answer from its text, or choose a supported topic.`, mode: 'local-topic-guide' };
    const topicTerms = new Set((topicName.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []));
    const terms = [...new Set((question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(word => !ignored.has(word)))];
    const titleMatch = terms.some(word => topicTerms.has(word));
    const conceptTerms = terms.filter(word => !topicTerms.has(word));
    if (/\b(code|example|snippet|syntax)\b/i.test(question) && record.examples?.[0]?.code) {
      const example = record.examples[0];
      return { answer: `${example.title}\n\n${example.code}\n\n${example.explanation}\n\nSource: built-in ${topicName} topic guide; not video content.`, mode: 'local-topic-guide' };
    }
    const facts = (record.questions || []).map((prompt, index) => {
      const answer = record.answers?.[index] || '';
      const haystack = `${prompt} ${answer}`.toLowerCase();
      return { answer, score: conceptTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) };
    }).sort((a, b) => b.score - a.score);
    if (facts[0]?.score) return { answer: `${facts[0].answer}\n\nSource: built-in ${topicName} topic guide; not video content.`, mode: 'local-topic-guide' };
    if (titleMatch && record.explanation) return { answer: `${record.explanation}\n\nSource: built-in ${topicName} topic guide; not video content.`, mode: 'local-topic-guide' };
    return { answer: `I can answer questions covered by the built-in ${topicName} guide, but this question is outside its verified notes. The title and any linked video were not used as evidence. Try asking about one of the listed concepts or add a transcript.`, mode: 'local-topic-guide' };
  }
  const ignored = new Set('what when where which this that with from about into does did have your they them then than been were will would could should there their video session transcript'.split(' '));
  const terms = [...new Set((question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(word => !ignored.has(word)))];
  const sentences = transcript.split(/(?<=[.!?。！？])\s+|\n+/).map(value => value.trim()).filter(Boolean);
  const matches = sentences.map((text, index) => ({ text, index, score: terms.reduce((score, term) => score + (text.toLowerCase().includes(term) ? 1 : 0), 0) }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 3).sort((a, b) => a.index - b.index);
  if (!matches.length) {
    if (/\b(code|example|snippet|syntax)\b/i.test(question) && record.examples?.[0]?.code) {
      const example = record.examples[0];
      return { answer: `${example.title}\n\n${example.code}\n\n${example.explanation}\n\nSource: built-in ${record.topicName || record.title} reference guide; not transcript content.`, mode: 'local-topic-guide' };
    }
    const ignored = new Set('what when where which this that with from about into does did have your they them then than been were will would could should there their video session transcript the and for are was can tell explain give show me please'.split(' '));
    const terms = [...new Set((question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(word => !ignored.has(word)))];
    const facts = (record.questions || []).map((prompt, index) => ({ answer: record.answers?.[index] || '', score: terms.reduce((score, term) => score + (`${prompt} ${record.answers?.[index] || ''}`.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
    if (facts[0]?.score) return { answer: `${facts[0].answer}\n\nSource: built-in ${record.topicName || record.title} reference guide; not transcript content.`, mode: 'local-topic-guide' };
    return { answer: 'The saved transcript does not provide enough information to answer that, and it is outside the built-in topic notes. No video-specific details were inferred.', mode: 'transcript-grounded' };
  }
  const quote = matches.map(item => item.text).join(' ');
  return { answer: `The transcript says: ${quote}\n\nSource: ${quote}`, mode: 'transcript-grounded' };
}

function validateYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host) || url.protocol !== 'https:') return null;
    if (host === 'youtu.be') return /^\/[\w-]{11}/.test(url.pathname) ? url.toString() : null;
    const id = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    return `https://www.youtube.com/watch?v=${id}`;
  } catch { return null; }
}

async function buildLearning({ title, transcript, sourceType, youtubeUrl, media }) {
  const detected = transcript ? detectLanguage(transcript) : 'Unknown';
  if (sourceType === 'transcript' && (!transcript || transcript.trim().length < 30)) fail(400, 'Paste at least 30 characters of transcript.');
  // Study packs are generated locally; no external AI service receives source material.
  const fallbackMetadata = { sourceType, sourceUrl: youtubeUrl, fileName: media?.fileName, mimeType: media?.mimeType };
  const content = fallbackLearning(title, transcript, detected, fallbackMetadata);
  const savedTranscript = String(content.transcript || transcript);
  if (Buffer.byteLength(savedTranscript, 'utf8') > 10 * 1024 * 1024) fail(413, 'The transcript exceeds the safe database save limit. No study pack was saved; use a shorter media file or paste selected transcript sections.');
  const sourceMetadata = media ? { fileName: media.fileName || '', mimeType: media.mimeType || '' } : undefined;
  return {
    title: String(content.title || title || '').trim().slice(0, 100) || 'Untitled learning session',
    transcript: savedTranscript,
    sourceType: sourceType || 'transcript',
    sourceUrl: youtubeUrl || undefined,
    sourceMetadata,
    sourceLanguage: content.sourceLanguage || detected,
    outputLanguage: detected === 'Unknown' ? 'English' : detected,
    generationMode: content.topicName ? 'topic-guide' : 'transcript-notes',
    fallbackLabel: content.fallbackLabel || 'Local topic guide — generated offline.',
    titlePracticeLabel: content.titlePracticeLabel || undefined,
    topicName: content.topicName || undefined,
    summary: content.summary || transcript.slice(0, 400),
    explanation: content.explanation || content.summary || transcript.slice(0, 500),
    notes: Array.isArray(content.notes) ? content.notes : (content.keyPoints || []).slice(0, 8),
    keyPoints: Array.isArray(content.keyPoints) ? content.keyPoints : [],
    revisionPoints: Array.isArray(content.revisionPoints) ? content.revisionPoints : [],
    examples: Array.isArray(content.examples) ? content.examples : [],
    questions: Array.isArray(content.questions) ? content.questions : [],
    answers: Array.isArray(content.answers) ? content.answers : [],
    quiz: Array.isArray(content.quiz) ? content.quiz : [],
    flashcards: Array.isArray(content.flashcards) ? content.flashcards : [],
    chatHistory: [],
  };
}

router.get('/settings', (req, res) => res.json({ settings: req.user.settings || { outputLanguage: 'English' } }));
router.put('/settings', async (req, res, next) => {
  try {
    const outputLanguage = String(req.body.outputLanguage || '');
    if (!languages.includes(outputLanguage)) return res.status(400).json({ error: 'Choose a supported output language.' });
    req.user.settings = { ...req.user.settings?.toObject?.(), outputLanguage };
    await req.user.save();
    res.json({ settings: req.user.settings });
  } catch (error) { next(error); }
});

router.get('/profile', (req, res) => res.json({ name: req.user.name, email: req.user.email, phone: req.user.phone || '', collegeName: req.user.collegeName || '', profileComplete: Boolean(req.user.profileComplete) }));
router.put('/profile', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const collegeName = String(req.body.collegeName || '').trim();
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Enter your full name (2–80 characters).' });
    if (!/^[+()\d .-]{7,24}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid phone number.' });
    if (collegeName.length < 2 || collegeName.length > 120) return res.status(400).json({ error: 'Enter a college name (2–120 characters).' });
    req.user.name = name;
    req.user.phone = phone;
    req.user.collegeName = collegeName;
    req.user.profileComplete = true;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (error) { next(error); }
});

router.get('/learning/services', async (_req, res) => {
  res.json({ services: await checkServices(), model: process.env.OLLAMA_MODEL || 'llama3.2', languages: supportedLanguages });
});

router.post('/learning/process', async (req, res, next) => {
  let file;
  try {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    const rawUpload = contentType.startsWith('audio/') || contentType.startsWith('video/') || contentType === 'application/octet-stream';
    const sourceType = String(rawUpload ? req.get('X-PrepAI-Source') || 'upload' : req.body.sourceType || '');
    const title = String(rawUpload ? decodeURIComponent(req.get('X-PrepAI-Title') || '') : req.body.title || '').trim().slice(0, 100);
    const sourceUrl = sourceType === 'youtube' ? validateYouTubeUrl(String(req.body.youtubeUrl || '').trim()) : '';
    const videoLanguage = videoLanguages.includes(rawUpload ? req.get('X-PrepAI-Video-Language') : req.body.videoLanguage) ? (rawUpload ? req.get('X-PrepAI-Video-Language') : req.body.videoLanguage) : 'Auto Detect';
    const requestedExplanationLanguage = rawUpload ? req.get('X-PrepAI-Explanation-Language') : req.body.explanationLanguage;
    const explanationLanguage = languages.includes(requestedExplanationLanguage) ? requestedExplanationLanguage : 'English';
    const transcript = String(rawUpload ? '' : req.body.transcript || '').trim();
    if (!['youtube', 'upload', 'transcript'].includes(sourceType)) return res.status(400).json({ error: 'Choose a YouTube video, media upload, or transcript.' });
    if (!title && sourceType !== 'youtube' && sourceType !== 'upload') return res.status(400).json({ error: 'Enter a session title for this learning source.' });
    if (sourceType === 'youtube' && !sourceUrl) return res.status(400).json({ error: 'Enter a valid public YouTube URL.' });
    if (sourceType === 'upload' && !rawUpload) return res.status(400).json({ error: 'Upload the audio or video file to the local processor.' });
    if (sourceType === 'transcript' && transcript.length < 30) return res.status(400).json({ error: 'Paste at least 30 characters of transcript.' });
    if (rawUpload) {
      const maximumBytes = Number(process.env.MAX_MEDIA_FILE_MB || 1024) * 1024 * 1024;
      if (Number(req.headers['content-length'] || 0) > maximumBytes) return res.status(413).json({ error: `Media exceeds the ${process.env.MAX_MEDIA_FILE_MB || 1024} MB upload limit.` });
      const mimeType = contentType === 'application/octet-stream' ? String(req.get('X-PrepAI-Mime') || '') : contentType.split(';')[0];
      if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) return res.status(400).json({ error: 'Choose a supported audio or video file.' });
      await fs.promises.mkdir(uploadDir, { recursive: true });
      const originalname = path.basename(decodeURIComponent(req.get('X-PrepAI-Name') || 'video-upload')).slice(0, 160);
      const target = path.join(uploadDir, `${randomUUID()}${path.extname(originalname).slice(0, 12)}`);
      let bytes = 0;
      const limiter = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; callback(bytes > maximumBytes ? new Error(`Media exceeds the ${process.env.MAX_MEDIA_FILE_MB || 1024} MB upload limit.`) : null, chunk); } });
      try { await pipeline(req, limiter, fs.createWriteStream(target, { flags: 'wx' })); }
      catch (error) { await fs.promises.rm(target, { force: true }); return res.status(error.message.includes('upload limit') ? 413 : 400).json({ error: error.message || 'The media upload was interrupted.' }); }
      file = { path: target, originalname, mimetype: mimeType };
    }
    const activeForUser = [...videoJobs.values()].filter(job => job.userId === String(req.userId) && job.status === 'processing').length;
    if (activeForUser >= 2) { if (file) await fs.promises.rm(file.path, { force: true }); return res.status(429).json({ error: 'Two local video jobs are already running for this account. Wait for one to finish and try again.' }); }
    for (const [id, oldJob] of videoJobs) if (Date.now() - Date.parse(oldJob.createdAt) > 24 * 60 * 60 * 1000) videoJobs.delete(id);
    const job = { id: randomUUID(), userId: String(req.userId), status: 'processing', stage: sourceType === 'youtube' ? 'captions' : sourceType === 'transcript' ? 'analyzing' : 'extracting', progress: 1, message: 'Preparing local processing', createdAt: new Date().toISOString() };
    videoJobs.set(job.id, job);
    res.status(202).json({ jobId: job.id, status: job.status, stage: job.stage, progress: job.progress });
    processVideoLearning({ title, sourceType, sourceUrl, videoLanguage, explanationLanguage, transcript, file, onProgress: (stage, progress, message) => Object.assign(job, { stage, progress, message }) })
      .then(async content => {
        Object.assign(job, { stage: 'saving', progress: 96, message: 'Saving the transcript and study pack to your account' });
        const record = await Learning.create({
          userId: req.userId, title: content.title, transcript: content.transcript, sourceType,
          sourceUrl: sourceUrl || undefined, sourceMetadata: file ? { ...content.sourceMetadata, fileName: file.originalname, mimeType: file.mimetype, processedLocally: true } : content.sourceMetadata,
          sourceLanguage: content.sourceLanguage, videoLanguage: content.videoLanguage, outputLanguage: content.outputLanguage, explanationLanguage: content.explanationLanguage, generationMode: content.generationMode,
          fallbackLabel: content.fallbackLabel, summary: content.summary, explanation: content.explanation,
          notes: content.notes, keyPoints: content.keyPoints, revisionPoints: content.revisionPoints, whatToLearnNext: content.whatToLearnNext,
          examples: content.examples, questions: content.questions, answers: content.answers,
          quiz: content.quiz, flashcards: content.flashcards, importantTimestamps: content.importantTimestamps,
          chatHistory: [],
        });
        Object.assign(job, { status: 'complete', stage: 'complete', progress: 100, message: 'Study pack saved', sessionId: String(record._id), completedAt: new Date().toISOString() });
      })
      .catch(error => Object.assign(job, { status: 'failed', stage: 'failed', progress: 100, error: error.message || 'Local media processing failed. No study pack was saved.' }));
  } catch (error) { if (file?.path) await fs.promises.rm(file.path, { force: true }).catch(() => {}); next(error); }
});

router.get('/learning/jobs/:jobId', (req, res) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job || job.userId !== String(req.userId)) return res.status(404).json({ error: 'Processing job not found.' });
  const { userId, ...publicJob } = job;
  if (job.status === 'complete') return Learning.findOne({ _id: job.sessionId, userId: req.userId }).then(session => session ? res.json({ ...publicJob, session }) : res.status(404).json({ error: 'Saved study session was not found.' })).catch(error => res.status(500).json({ error: error.message }));
  res.json(publicJob);
});

router.get('/learning', async (req, res, next) => {
  try {
    const sessions = await Learning.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(30).select('-transcript -segments');
    res.json({ sessions });
  } catch (error) { next(error); }
});

router.get('/learning/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Study session not found.' });
    const record = await Learning.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ error: 'Study session not found.' });
    res.json(record);
  } catch (error) { next(error); }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const [learnings, interviews, allReports, learningCount] = await Promise.all([
      Learning.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5),
      Interview.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5),
      Interview.find({ userId: req.userId, report: { $ne: null } }).select('report'),
      Learning.countDocuments({ userId: req.userId, finalizedAt: { $ne: null } }),
    ]);
    const dimensions = { technicalCorrectness: 'Technical knowledge', relevance: 'Relevance', completeness: 'Completeness', problemSolving: 'Problem solving', communication: 'Communication', grammar: 'Grammar', clarity: 'Clarity' };
    const averages = Object.keys(dimensions).map(key => {
      const values = allReports.map(item => Number(item.report?.scores?.[key])).filter(Number.isFinite);
      return { topic: dimensions[key], score: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    const weak = {};
    allReports.forEach(item => (item.report?.topicsToRevise || []).forEach(topic => weak[topic] = (weak[topic] || 0) + 1));
    const weakTopics = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([topic, count]) => ({ topic, count }));
    const recommendedTopic = weakTopics[0]?.topic || learnings[0]?.keyPoints?.[0] || 'Start with a role-specific technical topic';
    res.json({ learnings, interviews, learningCount, completedSessions: allReports.length, averageScore: allReports.length ? Math.round(allReports.reduce((sum, item) => sum + Number(item.report?.overallScore || 0), 0) / allReports.length) : null, strongTopics: allReports.length ? averages.slice(0, 3) : [], weakTopics, recommendation: recommendedTopic });
  } catch (error) { next(error); }
});

router.post('/learning', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 100);
    const transcript = String(req.body.transcript || '').trim();
    const sourceType = String(req.body.sourceType || 'transcript');
    if (!title) return res.status(400).json({ error: 'Enter a technical topic or session title.' });
    if (['youtube', 'upload'].includes(sourceType)) return res.status(400).json({ error: 'YouTube and uploaded media must complete local transcription and analysis before a study pack can be saved.' });
    let youtubeUrl = null;
    let media = null;
    if (sourceType === 'youtube') {
      youtubeUrl = validateYouTubeUrl(String(req.body.youtubeUrl || '').trim());
      if (!youtubeUrl) return res.status(400).json({ error: 'Enter a valid public YouTube video link.' });
    } else if (sourceType === 'upload') {
      const mimeType = String(req.body.mimeType || '').toLowerCase();
      if (!mimeType.startsWith('audio/') && !mimeType.startsWith('video/')) return res.status(400).json({ error: 'Choose an audio or video file to save its session details.' });
      media = { fileName: String(req.body.fileName || '').slice(0, 160), mimeType };
    }
    else if (!['transcript', 'topic'].includes(sourceType)) return res.status(400).json({ error: 'Choose a topic guide, transcript, YouTube link, or media metadata.' });
    if (sourceType === 'transcript' && transcript.trim().length < 30) return res.status(400).json({ error: 'Paste at least 30 characters of transcript.' });
    const data = await buildLearning({ title, transcript, sourceType, youtubeUrl, media });
    data.userId = req.userId;
    const record = await Learning.create(data);
    res.status(201).json(record);
  } catch (error) { next(error); }
});

router.post('/learning/:id/ask', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Study pack not found.' });
    const record = await Learning.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ error: 'Study pack not found.' });
    const question = String(req.body.question || '').trim().slice(0, 1000);
    if (question.length < 3) return res.status(400).json({ error: 'Enter a question about this learning material.' });
    const result = record.generationMode === 'local-whisper-ollama'
      ? await answerVideoQuestion(record, question)
      : localSessionAnswer(record, question);
    record.chatHistory = [...(record.chatHistory || []), { question, answer: result.answer, mode: result.mode, askedAt: new Date() }].slice(-100);
    await record.save();
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/learning/:id/action', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Study session not found.' });
    const record = await Learning.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ error: 'Study session not found.' });
    if (record.generationMode !== 'local-whisper-ollama' || !record.transcript) return res.status(400).json({ error: 'This option needs a session processed from a transcript or video.' });
    const actions = {
      explain: 'Explain the topic again more simply using a step-by-step explanation and one example grounded in the transcript.',
      practice: 'Create five practice questions grounded in the transcript, each with an answer and source reference.',
      quiz: 'Create five quiz questions grounded in the transcript, each with four options, the zero-based correct option index, answer explanation, and timestamp/source reference.',
      examples: 'Give additional examples only when supported by the transcript. If it gives no examples, explicitly say so and label any general illustrative example as external explanation.',
      next: 'Suggest useful next concepts based on the transcript; distinguish recommendations from things explicitly stated in the video.',
    };
    const action = String(req.body.action || '');
    if (!actions[action]) return res.status(400).json({ error: 'Choose a supported learning option.' });
    const result = await ollamaJson(
      `You are a source-grounded tutor. Use only the timestamped transcript as evidence. Write in ${record.outputLanguage || 'English'}. Never claim a detail was in the video unless supported. Return JSON with a short text field, plus any relevant questions, answers, quiz, examples, recommendations, and sourceReferences arrays.`,
      `Session title (context only): ${record.title}\nSaved full-session analysis derived from the transcript:\nSummary: ${record.summary}\nExplanation: ${record.explanation}\nKey points: ${(record.keyPoints || []).join('\n')}\nStudy notes: ${(record.notes || []).join('\n')}\nTask: ${actions[action]}\nTimestamped transcript source (may be long):\n${String(record.transcript).slice(0, 80000)}`,
      180000,
    );
    res.json({ ...result, mode: 'transcript-grounded-ollama', action });
  } catch (error) { next(error); }
});

router.post('/learning/:id/quiz-answer', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Study session not found.' });
    const record = await Learning.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ error: 'Study session not found.' });
    const question = String(req.body.question || '').trim().slice(0, 1000);
    const expectedAnswer = String(req.body.expectedAnswer || '').trim().slice(0, 2000);
    const answer = String(req.body.answer || '').trim().slice(0, 2000);
    if (!question || !expectedAnswer || !answer) return res.status(400).json({ error: 'Submit an answer to the current quiz question.' });
    const result = await ollamaJson(
      `Evaluate a learner using only the transcript evidence and expected answer provided. Write feedback in ${record.outputLanguage || 'English'}. If evidence is ambiguous, return status "needs-manual-review" and do not invent correctness. Return JSON {status,correct,feedback,explanation,sourceReferences}.`,
      `Transcript evidence:\n${String(record.transcript || '').slice(0, 80000)}\nQuestion: ${question}\nExpected answer based on transcript: ${expectedAnswer}\nLearner answer: ${answer}`,
      120000,
    );
    res.json({ ...result, mode: 'transcript-grounded-ollama' });
  } catch (error) { next(error); }
});

router.post('/learning/:id/finalize', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Study session not found.' });
    const record = await Learning.findOne({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ error: 'Study session not found.' });
    record.finalizedAt = new Date();
    await record.save();
    res.json({ session: record });
  } catch (error) { next(error); }
});

router.post('/interviews/start', async (req, res, next) => {
  try {
    const role = String(req.body.role || '').trim().slice(0, 80);
    const difficulty = String(req.body.difficulty || 'Intermediate');
    const topic = String(req.body.topic || '').trim();
    if (!role) return res.status(400).json({ error: 'Choose a job role to continue.' });
    if (!['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)) return res.status(400).json({ error: 'Choose a valid difficulty.' });
    if (!topicNames.includes(topic)) return res.status(400).json({ error: 'Choose a valid interview topic.' });
    const voiceMode = Boolean(req.body.voiceMode);
    const questions = buildQuestions(topic, difficulty);
    const record = await Interview.create({ userId: req.userId, role, topic, difficulty, voiceMode, questions, answers: [], answerEvaluations: [], voiceEvaluations: [], report: null });
    const response = record.toObject();
    response.questions = record.questions.map(({ expectedAnswer, explanation, ...question }) => question);
    res.status(201).json(response);
  } catch (error) { next(error); }
});

async function saveInterviewAnswer(req, res, next, voiceOnly = false) {
  try {
    const index = Number(req.body.index);
    const answer = String(req.body.answer || '').trim().slice(0, 2400);
    if (!Number.isInteger(index) || index < 0 || index >= INTERVIEW_QUESTION_COUNT) return res.status(400).json({ error: 'Choose a valid question.' });
    if (answer.length < 3) return res.status(400).json({ error: 'Speak or type an answer before continuing.' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Interview session not found.' });
    const query = { _id: req.params.id, userId: req.userId };
    if (voiceOnly) query.voiceMode = true;
    const interview = await Interview.findOne(query);
    if (!interview) return res.status(404).json({ error: voiceOnly ? 'Voice practice session not found.' : 'Interview session not found.' });
    const question = interview.questions[index];
    if (!question) return res.status(404).json({ error: 'Interview question not found.' });
    const evaluation = evaluateAnswer(question, answer);
    interview.answers[index] = answer;
    interview.answerEvaluations[index] = evaluation;
    if (voiceOnly) interview.voiceEvaluations[index] = evaluation;
    await interview.save();
    res.json({ evaluation, correctAnswer: question.expectedAnswer, explanation: question.explanation, nextQuestion: interview.questions[index + 1] || null, completed: index === interview.questions.length - 1 });
  } catch (error) { next(error); }
}

router.post('/interviews/:id/answer', (req, res, next) => saveInterviewAnswer(req, res, next, false));
router.post('/interviews/:id/voice-answer', (req, res, next) => saveInterviewAnswer(req, res, next, true));

router.post('/interviews/:id/submit', async (req, res, next) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length !== INTERVIEW_QUESTION_COUNT || answers.some(answer => !String(answer).trim())) return res.status(400).json({ error: `Answer all ${INTERVIEW_QUESTION_COUNT} questions before generating your report.` });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Interview session not found.' });
    const interview = await Interview.findOne({ _id: req.params.id, userId: req.userId });
    if (!interview) return res.status(404).json({ error: 'Interview session not found.' });
    const evaluations = answers.map((answer, index) => {
      const evaluation = evaluateAnswer(interview.questions[index], String(answer).trim());
      return { ...evaluation, question: interview.questions[index].question, referenceAnswer: interview.questions[index].expectedAnswer, explanation: interview.questions[index].explanation };
    });
    const automaticallyEvaluated = evaluations.filter(item => item.status === 'evaluated');
    const reviewRequiredCount = evaluations.length - automaticallyEvaluated.length;
    const average = key => automaticallyEvaluated.length
      ? Math.round(automaticallyEvaluated.reduce((sum, item) => sum + item.scores[key], 0) / automaticallyEvaluated.length)
      : null;
    const overallScore = reviewRequiredCount
      ? null
      : Math.round(evaluations.reduce((sum, item) => sum + item.score, 0) / evaluations.length);
    const weak = automaticallyEvaluated.some(item => item.score < 60 || item.missingConcepts.length > 0);
    const report = {
      overallScore,
      scoreStatus: reviewRequiredCount ? 'needs-manual-review' : 'evaluated',
      reviewRequiredCount,
      evaluatedAnswerCount: automaticallyEvaluated.length,
      scores: { correctness: average('correctness'), relevance: average('relevance'), completeness: average('completeness'), problemSolving: average('problemSolving'), communication: average('communication') },
      strengths: [...new Set(automaticallyEvaluated.map(item => item.strength).filter(Boolean))],
      weaknesses: [...new Set([
        ...evaluations.flatMap(item => item.missingConcepts.map(concept => `Add or clarify: ${concept}`)),
        ...evaluations.filter(item => item.status === 'needs-manual-review').map(item => item.feedback),
      ])],
      improvedAnswers: interview.questions.map(question => `Reference answer: ${question.expectedAnswer} Explanation: ${question.explanation}`),
      topicsToRevise: weak ? [interview.topic, 'Review the missing concepts shown in each answer.'] : (reviewRequiredCount ? [interview.topic, 'Manually review the flagged responses.'] : []),
      questionEvaluations: evaluations,
      evaluationMethod: 'reference-clause-rubric',
      scoreFormula: 'Each evaluated answer is the equal-weight mean of correctness, relevance, completeness, problem-solving, and communication. The report score is the mean of all question scores. If any answer needs manual review, the report withholds the overall score; dimension averages include evaluated answers only.',
      evaluationNote: reviewRequiredCount
        ? `${reviewRequiredCount} answer(s) need manual review. No overall score is shown; dimension averages use only automatically evaluated answers.`
        : 'Scores compare answer wording and clause coverage with the saved reference answer. They are a local study rubric, not expert semantic grading.',
    };
    interview.answers = answers;
    interview.answerEvaluations = evaluations;
    interview.report = report;
    await interview.save();
    res.json({ ...interview.toObject(), report });
  } catch (error) { next(error); }
});

router.get('/progress', async (req, res, next) => {
  try {
    const [interviews, learnings] = await Promise.all([
      Interview.find({ userId: req.userId, report: { $ne: null } }).sort({ createdAt: -1 }),
      Learning.find({ userId: req.userId }).sort({ createdAt: -1 }),
    ]);
    const weak = {};
    interviews.forEach(interview => (interview.report?.topicsToRevise || []).forEach(topic => weak[topic] = (weak[topic] || 0) + 1));
    res.json({ interviews, learnings, weakTopics: Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([topic, count]) => ({ topic, count })) });
  } catch (error) { next(error); }
});

module.exports = router;
