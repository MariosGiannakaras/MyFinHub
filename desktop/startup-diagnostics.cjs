'use strict';

const MAX_DIAGNOSTIC_CHARS = 4096;
const OMIT_DETAIL_CODES = new Set(['BACKEND_STOPPED']);

class StartupError extends Error {
  constructor(code, stage, message, detail = '', cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'StartupError';
    this.code = String(code || 'DESKTOP_STARTUP_FAILED');
    this.stage = String(stage || 'startup');
    this.detail = String(detail || '');
  }
}

function sanitizeDiagnosticText(value, explicitSecrets = []) {
  let text = String(value ?? '');
  for (const secret of explicitSecrets) {
    const token = String(secret || '');
    if (token) text = text.split(token).join('[redacted]');
  }
  text = text
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9._-]+\b/gi, '[supabase-key-redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[jwt-redacted]')
    .replace(/\b[a-f0-9]{64}\b/gi, '[64-hex-redacted]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim();
  if (text.length > MAX_DIAGNOSTIC_CHARS) text = `${text.slice(0, MAX_DIAGNOSTIC_CHARS)}…`;
  return text;
}

function appendDiagnostic(current, value, explicitSecrets = []) {
  const addition = sanitizeDiagnosticText(value, explicitSecrets);
  if (!addition) return sanitizeDiagnosticText(current, explicitSecrets);
  const combined = current ? `${current}\n${addition}` : addition;
  return combined.length > MAX_DIAGNOSTIC_CHARS
    ? combined.slice(combined.length - MAX_DIAGNOSTIC_CHARS)
    : combined;
}

function toStartupError(error, fallback = {}) {
  if (error instanceof StartupError) return error;
  const detail = error instanceof Error ? error.message : String(error || 'Unknown startup error.');
  return new StartupError(
    fallback.code || 'DESKTOP_STARTUP_FAILED',
    fallback.stage || 'startup',
    fallback.message || 'Το MyFinHub δεν μπόρεσε να ολοκληρώσει την εκκίνηση.',
    detail,
    error instanceof Error ? error : null,
  );
}

function publicStartupFailure(error, explicitSecrets = []) {
  const normalized = toStartupError(error);
  const detail = OMIT_DETAIL_CODES.has(normalized.code)
    ? 'Η υπηρεσία είχε ήδη ξεκινήσει. Μεταγενέστερο runtime output παραλείπεται σκόπιμα από τα διαγνωστικά.'
    : normalized.detail;
  return Object.freeze({
    code: normalized.code,
    stage: normalized.stage,
    message: sanitizeDiagnosticText(normalized.message, explicitSecrets),
    detail: sanitizeDiagnosticText(detail, explicitSecrets),
    timestamp: new Date().toISOString(),
  });
}

function startupDiagnosticText(failure, version = '') {
  if (!failure) return '';
  return [
    `MyFinHub ${version || 'desktop'} startup diagnostic`,
    `Code: ${failure.code || 'DESKTOP_STARTUP_FAILED'}`,
    `Stage: ${failure.stage || 'startup'}`,
    `Time: ${failure.timestamp || new Date().toISOString()}`,
    `Message: ${failure.message || 'Startup failed.'}`,
    failure.detail ? `Detail: ${failure.detail}` : '',
    'Secrets, tokens and card-vault key material are intentionally redacted.',
  ].filter(Boolean).join('\n');
}

module.exports = {
  MAX_DIAGNOSTIC_CHARS,
  StartupError,
  sanitizeDiagnosticText,
  appendDiagnostic,
  toStartupError,
  publicStartupFailure,
  startupDiagnosticText,
};
