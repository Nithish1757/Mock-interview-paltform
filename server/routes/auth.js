const express = require('express');
const { promisify } = require('node:util');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const mongoose = require('mongoose');
const { User, Learning, Interview } = require('../models/Record');
const { attachUser, clearSession, publicUser, setSession } = require('../auth');
const { buildQuestions } = require('../interviewBank');

const router = express.Router();
const scryptAsync = promisify(scrypt);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}.${Buffer.from(hash).toString('hex')}`;
}

async function passwordMatches(password, stored) {
  const [salt, hex] = String(stored || '').split('.');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = Buffer.from(await scryptAsync(password, salt, expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function needsDatabase(res) {
  if (mongoose.connection.readyState === 1) return false;
  res.status(503).json({ error: 'Sign-in needs the MongoDB database. Start MongoDB and try again.' });
  return true;
}

async function ensureDemoData(userId) {
  if (!await Learning.exists({ userId })) {
    await Learning.create({
      userId, title: 'JavaScript Event Loop · Demo guide', sourceType: 'topic', topicName: 'JavaScript',
      sourceLanguage: 'English', outputLanguage: 'English', generationMode: 'demo-sample',
      fallbackLabel: 'DEMO SAMPLE DATA · This is a topic guide, not a processed video.',
      summary: 'Demo guide: JavaScript runs synchronous work on the call stack and schedules asynchronous callbacks through task and microtask queues.',
      explanation: 'This sample illustrates how synchronous code, promises and queued callbacks are coordinated by the JavaScript runtime.',
      notes: ['Synchronous code runs on the call stack.', 'Promise callbacks use the microtask queue.', 'Queued work runs when the current stack is clear.'],
      keyPoints: ['The call stack runs current synchronous code.', 'Promise jobs use the microtask queue.', 'The event loop coordinates queued work.'],
      revisionPoints: ['Compare microtasks with task callbacks.', 'Trace a short program and write down output order.'],
      examples: [{ title: 'Promise callback order', code: 'console.log("start");\nPromise.resolve().then(() => console.log("promise"));\nconsole.log("end");', explanation: 'Synchronous logs run before the promise callback.' }],
      questions: ['What runs first: synchronous code or a promise callback?', 'When can a queued callback run?'],
      answers: ['Synchronous code runs first; promise callbacks run as microtasks after the current stack clears.', 'Queued work runs after the current synchronous stack is empty.'],
      quiz: [{ question: 'Which callback uses the microtask queue?', options: ['A resolved promise callback', 'A CSS selector', 'An HTML attribute', 'A database index'], answer: 0 }],
      flashcards: [{ front: 'Call stack', back: 'Runs the current synchronous JavaScript functions.' }, { front: 'Microtask queue', back: 'Queues promise jobs that run after the current stack clears.' }],
      chatHistory: [{ question: 'Why does the promise callback run after the final console.log?', answer: 'The current synchronous stack finishes before queued promise microtasks run. This is demo sample content.', mode: 'demo-sample', askedAt: new Date() }],
      finalizedAt: new Date(),
    });
  }

  if (!await Interview.exists({ userId, report: { $ne: null } })) {
    const questions = buildQuestions('JavaScript', 'Intermediate');
    const sampleAnswers = [
      'Synchronous code runs on the call stack; queued callbacks wait until the stack is clear, while promise jobs use the microtask queue.',
      'A closure keeps access to lexical scope variables after the outer function returns.',
      'An async function returns a promise and await pauses that function until the promise settles.',
      'I would reproduce the issue, inspect the event ordering, isolate the queued work, apply a focused change and verify the result with a test.',
      'Situation: a feature needed a reliable event flow. Task: I owned the investigation. Action: I traced the callbacks and added a regression test. Result: the behavior became predictable and I learned to test ordering explicitly.',
    ];
    const perQuestionScores = [86, 79, 78, 77, 70];
    await Interview.create({
      userId, role: 'Frontend Developer', topic: 'JavaScript', difficulty: 'Intermediate', voiceMode: false,
      questions, answers: sampleAnswers,
      report: {
        overallScore: 78, scoreStatus: 'evaluated', reviewRequiredCount: 0, evaluatedAnswerCount: 5,
        scores: { correctness: 80, relevance: 78, completeness: 76, problemSolving: 77, communication: 79 },
        strengths: ['Demo sample: explains the call stack and promise microtasks.', 'Demo sample: includes a verification step in the scenario answer.'],
        weaknesses: ['Demo sample: could compare task callbacks with microtasks in more detail.'],
        topicsToRevise: ['JavaScript event loop', 'Task and microtask ordering'],
        questionEvaluations: questions.map((question, index) => ({
          status: 'evaluated', score: perQuestionScores[index], scores: { correctness: perQuestionScores[index], relevance: 78, completeness: 76, problemSolving: 77, communication: 79 },
          question: question.question, answer: sampleAnswers[index], referenceAnswer: question.expectedAnswer,
          explanation: question.explanation, missingConcepts: [], feedback: 'Demo sample evaluation; not a real student score.',
        })),
        evaluationMethod: 'demo-sample',
        scoreFormula: 'Sample value for demonstration only; it was not calculated from a student response.',
        evaluationNote: 'DEMO SAMPLE DATA · Example report, not a real interview evaluation.',
      },
    });
  }
}

router.get('/me', attachUser, (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

router.post('/demo', async (req, res, next) => {
  try {
    if (needsDatabase(res)) return;
    const email = 'demo@prepai.local';
    let user = await User.findOne({ email });
    if (!user) {
      try {
        user = await User.create({
          name: 'Demo Student', email,
          passwordHash: await hashPassword(randomBytes(32).toString('hex')),
          phone: '000 000 0000', collegeName: 'PrepAI Demo Campus', profileComplete: true, demoMode: true,
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await User.findOne({ email });
      }
    }
    if (!user.demoMode || !user.profileComplete) {
      user.demoMode = true;
      user.profileComplete = true;
      await user.save();
    }
    await ensureDemoData(user._id);
    setSession(res, user._id);
    res.json({ user: publicUser(user), demo: true });
  } catch (error) { next(error); }
});

router.post('/signup', async (req, res, next) => {
  try {
    if (needsDatabase(res)) return;
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be 2 to 80 characters.' });
    if (!emailPattern.test(email) || email.length > 200) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8 to 128 characters.' });
    if (await User.findOne({ email })) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    const firstUser = await User.countDocuments() === 0;
    const user = await User.create({ name, email, passwordHash: await hashPassword(password), settings: { outputLanguage: 'English' } });
    if (firstUser) {
      await Promise.all([
        Learning.updateMany({ userId: { $exists: false } }, { $set: { userId: user._id } }),
        Interview.updateMany({ userId: { $exists: false } }, { $set: { userId: user._id } }),
      ]);
    }
    setSession(res, user._id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    if (needsDatabase(res)) return;
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!emailPattern.test(email) || !password) return res.status(400).json({ error: 'Enter your email and password.' });
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await passwordMatches(password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    setSession(res, user._id);
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/logout', (_req, res) => { clearSession(res); res.json({ ok: true }); });

module.exports = router;
