const express = require('express');
const { promisify } = require('node:util');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const mongoose = require('mongoose');
const { User, Learning, Interview } = require('../models/Record');
const { attachUser, clearSession, publicUser, setSession } = require('../auth');

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

router.get('/me', attachUser, (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

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
