const { createHmac, randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const { User } = require('./models/Record');

const cookieName = 'prepai_session';
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('Set SESSION_SECRET before running PrepAI in production.');
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const sessionAge = 7 * 24 * 60 * 60;

function getSessionId(req) {
  try {
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`));
    if (!cookie) return null;
    const [userId, expires, signature] = decodeURIComponent(cookie.slice(cookieName.length + 1)).split('.');
    if (!userId || !expires || !signature || Number(expires) < Date.now()) return null;
    const expected = createHmac('sha256', sessionSecret).update(`${userId}.${expires}`).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !require('node:crypto').timingSafeEqual(a, b)) return null;
    return userId;
  } catch { return null; }
}

function setSession(res, userId) {
  const expires = Date.now() + sessionAge * 1000;
  const payload = `${userId}.${expires}`;
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(`${payload}.${signature}`)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionAge}${secure}`);
}

function clearSession(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, phone: user.phone || '', collegeName: user.collegeName || '', profileComplete: Boolean(user.profileComplete), settings: user.settings || { outputLanguage: 'English' } };
}

async function attachUser(req, _res, next) {
  try {
    const id = getSessionId(req);
    req.user = id && mongoose.connection.readyState === 1 ? await User.findById(id) : null;
    next();
  } catch (error) { next(error); }
}

async function requireUser(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'MongoDB is unavailable. Start the database and try again.' });
    const id = getSessionId(req);
    req.user = id ? await User.findById(id) : null;
    if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
    if (!req.user.profileComplete && !(req.path === '/profile' && req.method === 'PUT')) return res.status(403).json({ error: 'Complete your profile to continue.' });
    req.userId = req.user._id;
    next();
  } catch (error) { next(error); }
}

module.exports = { attachUser, clearSession, getSessionId, publicUser, requireUser, setSession };
