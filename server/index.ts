import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearSessionCookies, requireSession, revokeSession, setSessionCookies, signInWithPassword } from './auth.js';
import { ApiError, assertSameOrigin, handleApi, methodNotAllowed, requestHeader, sendJson } from './http.js';
import { backupStore, DATA_SOURCE, isOwner, readStore, writeStore } from './storage.js';
import { validateFinanceData } from './validation.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb', strict: true }));

app.get('/api/health', (req, res) => void handleApi(res, async () => sendJson(res, 200, { ok: true, app: 'RheomIQ' })));

app.post('/api/auth/login', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || email.length > 254 || !email.includes('@') || password.length < 8 || password.length > 512) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  let tokens;
  try { tokens = await signInWithPassword(email, password); }
  catch { throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'); }
  if (!tokens.access_token || !tokens.refresh_token || !(await isOwner(tokens.access_token))) {
    await revokeSession(tokens.access_token);
    clearSessionCookies(req, res);
    throw new ApiError(403, 'NOT_OWNER', 'This account is not authorized for RheomIQ.');
  }
  setSessionCookies(req, res, tokens);
  sendJson(res, 200, { authenticated: true, email: tokens.user?.email || email });
}));

app.get('/api/auth/session', (req, res) => void handleApi(res, async () => {
  const session = await requireSession(req, res);
  if (!(await isOwner(session.accessToken))) {
    clearSessionCookies(req, res);
    throw new ApiError(403, 'NOT_OWNER', 'This account is not authorized for RheomIQ.');
  }
  sendJson(res, 200, { authenticated: true, email: session.user.email || null });
}));

app.post('/api/auth/logout', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  try { const session = await requireSession(req, res); await revokeSession(session.accessToken); } catch { /* idempotent */ }
  clearSessionCookies(req, res);
  sendJson(res, 200, { authenticated: false });
}));

app.get('/api/data', (req, res) => void handleApi(res, async () => {
  const session = await requireSession(req, res);
  sendJson(res, 200, await readStore(session.accessToken));
}));

app.put('/api/data', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const session = await requireSession(req, res);
  validateFinanceData(req.body);
  sendJson(res, 200, await writeStore(req.body, requestHeader(req, 'if-match') || undefined, false, session.accessToken));
}));

app.post('/api/import', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const session = await requireSession(req, res);
  if (requestHeader(req, 'x-rheomiq-confirm-import') !== 'replace') throw new ApiError(400, 'IMPORT_CONFIRMATION_REQUIRED', 'Import confirmation is required.');
  validateFinanceData(req.body);
  sendJson(res, 200, await writeStore(req.body, undefined, true, session.accessToken));
}));

app.post('/api/backup', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const session = await requireSession(req, res);
  sendJson(res, 200, { path: await backupStore(session.accessToken) });
}));

app.all('/api/{*splat}', (_req, res) => methodNotAllowed(res, []));

const serveDist = process.argv.includes('--serve-dist') || process.env.NODE_ENV === 'production';
if (serveDist) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '..', 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.RHEOMIQ_PORT || process.env.PORT || 4317);
const host = process.env.RHEOMIQ_HOST || '127.0.0.1';
if (!process.env.VERCEL) app.listen(port, host, () => console.log(`RheomIQ server: http://${host}:${port} (${DATA_SOURCE})`));

export default app;
