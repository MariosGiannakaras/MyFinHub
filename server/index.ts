import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { accessTokenAal, beginTotpEnrollment, challengeTotp, clearSessionCookies, getTotpFactors, requireSession, revokeSession, setSessionCookies, signInWithPassword, verifyTotp } from './auth.js';
import { handleCardVaultRequest } from './cardVaultHandler.js';
import { ApiError, assertSameOrigin, handleApi, methodNotAllowed, requestHeader, sendJson } from './http.js';
import { backupStore, DATA_SOURCE, isOwner, readStore, writeMutableState, writeStore } from './storage.js';
import { parseMutableWrite } from './stateValidation.js';
import { isAuthRejection } from './upstream.js';
import { validateFinanceData } from './validation.js';
import { MAX_FINANCE_DOCUMENT_BYTES } from '../src/lib/limits.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: MAX_FINANCE_DOCUMENT_BYTES, strict: true }));
app.use((error: any, _req: any, res: any, next: any) => {
  if (error?.type === 'entity.too.large') {
    void handleApi(res, async () => { throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.'); });
    return;
  }
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    void handleApi(res, async () => { throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON payload.'); });
    return;
  }
  next(error);
});

async function requireFinanceSession(req: any, res: any) {
  const session = await requireSession(req, res);
  if (!(await isOwner(session.accessToken))) {
    clearSessionCookies(req, res);
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  }
  if (accessTokenAal(session.accessToken) !== 'aal2') {
    throw new ApiError(403, 'MFA_REQUIRED', 'Verification required.');
  }
  return session;
}

app.get('/api/health', (req, res) => void handleApi(res, async () => sendJson(res, 200, { ok: true, app: 'RheomIQ' })));

app.post('/api/auth/login', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || email.length > 254 || !email.includes('@') || password.length < 8 || password.length > 512) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  let tokens;
  try {
    tokens = await signInWithPassword(email, password);
  } catch (error) {
    if (isAuthRejection(error)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    throw error;
  }
  if (!tokens.access_token || !tokens.refresh_token || !(await isOwner(tokens.access_token))) {
    await revokeSession(tokens.access_token);
    clearSessionCookies(req, res);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  setSessionCookies(req, res, tokens);
  const factors = await getTotpFactors(tokens.access_token);
  const hasVerifiedTotp = factors.some(factor => factor.status === 'verified');
  const aal2 = accessTokenAal(tokens.access_token) === 'aal2';
  sendJson(res, 200, {
    authenticated: aal2,
    email: tokens.user?.email || email,
    mfaRequired: !aal2 && hasVerifiedTotp,
    mfaEnrollmentRequired: !aal2 && !hasVerifiedTotp,
  });
}));

app.get('/api/auth/session', (req, res) => void handleApi(res, async () => {
  const session = await requireSession(req, res);
  if (!(await isOwner(session.accessToken))) {
    clearSessionCookies(req, res);
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  }
  const factors = await getTotpFactors(session.accessToken);
  const hasVerifiedTotp = factors.some(factor => factor.status === 'verified');
  const aal2 = accessTokenAal(session.accessToken) === 'aal2';
  sendJson(res, 200, {
    authenticated: aal2,
    email: session.user.email || null,
    mfaRequired: !aal2 && hasVerifiedTotp,
    mfaEnrollmentRequired: !aal2 && !hasVerifiedTotp,
  });
}));

app.post('/api/auth/mfa/enroll', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const session = await requireSession(req, res);
  if (!(await isOwner(session.accessToken))) {
    clearSessionCookies(req, res);
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  }
  const enrollment = await beginTotpEnrollment(session.accessToken);
  sendJson(res, 200, { factorId: enrollment.id, qrCode: enrollment.totp!.qr_code!, secret: enrollment.totp!.secret! });
}));

app.post('/api/auth/mfa/verify', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const requestedFactorId = typeof req.body?.factorId === 'string' ? req.body.factorId.trim() : '';
  if (!/^\d{6}$/.test(code)) throw new ApiError(401, 'INVALID_MFA_CODE', 'Invalid verification code.');
  const session = await requireSession(req, res);
  if (!(await isOwner(session.accessToken))) {
    clearSessionCookies(req, res);
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
  }
  const factors = requestedFactorId ? [] : await getTotpFactors(session.accessToken);
  const factorId = requestedFactorId || factors.find(item => item.status === 'verified')?.id;
  if (!factorId) throw new ApiError(401, 'MFA_NOT_CONFIGURED', 'Verification is unavailable.');
  try {
    const challenge = await challengeTotp(session.accessToken, factorId);
    const tokens = await verifyTotp(session.accessToken, factorId, challenge.id, code);
    if (!tokens.access_token || !tokens.refresh_token || accessTokenAal(tokens.access_token) !== 'aal2' || !(await isOwner(tokens.access_token))) {
      throw new Error('MFA verification did not produce an owner AAL2 session.');
    }
    setSessionCookies(req, res, tokens);
    sendJson(res, 200, { authenticated: true, email: tokens.user?.email || session.user.email || null });
  } catch (error) {
    if (isAuthRejection(error)) throw new ApiError(401, 'INVALID_MFA_CODE', 'Invalid verification code.');
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'INVALID_MFA_CODE', 'Invalid verification code.');
  }
}));

app.post('/api/auth/logout', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  try { const session = await requireSession(req, res); await revokeSession(session.accessToken); } catch { /* idempotent */ }
  clearSessionCookies(req, res);
  sendJson(res, 200, { authenticated: false });
}));

app.get('/api/data', (req, res) => void handleApi(res, async () => {
  const session = await requireFinanceSession(req, res);
  sendJson(res, 200, await readStore(session.accessToken));
}));

app.put('/api/data', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const session = await requireFinanceSession(req, res);
  const body = parseMutableWrite(req.body);
  sendJson(res, 200, await writeMutableState(body.state, body.updatedAt, requestHeader(req, 'if-match'), session.accessToken));
}));

app.all('/api/card-secrets', (req, res) => void handleCardVaultRequest(req, res));

app.post('/api/import', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const session = await requireFinanceSession(req, res);
  if (requestHeader(req, 'x-rheomiq-confirm-import') !== 'replace') throw new ApiError(400, 'IMPORT_CONFIRMATION_REQUIRED', 'Import confirmation is required.');
  validateFinanceData(req.body);
  sendJson(res, 200, await writeStore(req.body, undefined, true, session.accessToken));
}));

app.post('/api/backup', (req, res) => void handleApi(res, async () => {
  assertSameOrigin(req);
  const session = await requireFinanceSession(req, res);
  sendJson(res, 200, { path: await backupStore(session.accessToken) });
}));

app.all('/api/{*splat}', (_req, res) => methodNotAllowed(res, []));

const serveDist = process.argv.includes('--serve-dist') || process.env.NODE_ENV === 'production';
if (serveDist) {
  const configuredDist = process.env.RHEOMIQ_DIST_DIR?.trim();
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = configuredDist ? path.resolve(configuredDist) : path.resolve(here, '..', 'dist');
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.RHEOMIQ_PORT || process.env.PORT || 4317);
const host = process.env.RHEOMIQ_HOST || '127.0.0.1';
if (!process.env.VERCEL) {
  const listener = app.listen(port, host, () => {
    const address = listener.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    const origin = `http://${host}:${actualPort}`;
    if (process.env.RHEOMIQ_DESKTOP === '1') console.log(`RHEOMIQ_DESKTOP_READY=${origin}`);
    console.log(`RheomIQ server: ${origin} (${DATA_SOURCE})`);
  });
}

export default app;
