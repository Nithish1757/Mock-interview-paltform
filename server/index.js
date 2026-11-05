const path = require('node:path');
const dotenv = require('dotenv');
const localEnvPath = path.join(__dirname, '../.env');
dotenv.config({ path: localEnvPath });
const express = require('express');
const mongoose = require('mongoose');
const api = require('./routes/api');
const authRoutes = require('./routes/auth');
const { requireUser } = require('./auth');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use((req, res, next) => {
  const origin = process.env.FRONTEND_ORIGIN;
  if (origin && req.headers.origin === origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Media-Mime, X-Media-Name, X-Media-Title, X-Output-Language, X-PrepAI-Source, X-PrepAI-Title, X-PrepAI-Name, X-PrepAI-Mime, X-PrepAI-Video-Language, X-PrepAI-Explanation-Language');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (_req, res) => res.json({ service: 'prepai', apiVersion: 3, ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/auth', authRoutes);
app.use('/api', requireUser, api);
app.use((error, _req, res, _next) => {
  console.error(`API error: ${error.message}`);
  const message = error.type === 'entity.too.large' || error.status === 413
    ? 'Request is too large. Media uploads are limited to 200 MB; paste a transcript or use a public YouTube link for larger sources.'
    : error.expose ? error.message : 'Something went wrong. Please try again.';
  res.status(error.status || 500).json({ error: message });
});

const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist, { index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html'), error => {
  if (error) res.status(404).send('Run the frontend dev server or build the client first.');
}));

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(port, host, () => console.log(`PrepAI API listening on http://${host}:${port}`));
server.timeout = 11 * 60 * 1000;
server.requestTimeout = 11 * 60 * 1000;
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      const health = await response.json();
      // Reuse only this API's explicit health signature. A different or older
      // service may return generic { ok, database } fields on the same port.
      if (health.service === 'prepai' && health.apiVersion === 3 && health.ok === true && typeof health.database === 'string') {
        console.log(`PrepAI API already running on port ${port}; reusing the existing service.`);
        process.exit(0);
      }
    } catch (healthError) { console.debug(`Occupied port does not expose PrepAI health: ${healthError.message}`); }
    console.error(`Port ${port} is already in use by another service. Set PORT to a free port; PrepAI did not start a duplicate server.`);
  } else console.error(`PrepAI API could not start: ${error.message}`);
  process.exitCode = 1;
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/prepai')
  .then(() => console.log('MongoDB connected'))
  .catch(error => console.error(`MongoDB connection failed: ${error.message}`));

process.on('SIGINT', () => server.close(() => { mongoose.disconnect().finally(() => process.exit(0)); }));
process.on('SIGTERM', () => server.close(() => { mongoose.disconnect().finally(() => process.exit(0)); }));
