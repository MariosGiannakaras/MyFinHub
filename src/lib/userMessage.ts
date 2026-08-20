const TECHNICAL_PATTERNS = [
  /\b[A-Z][A-Z0-9_]{3,}\b/,
  /\b(?:HTTP|JSON|SQL|PostgreSQL|Supabase|fetch|stack|trace|ECONN|ENOTFOUND|ETIMEDOUT)\b/i,
  /(?:TypeError|ReferenceError|SyntaxError|RangeError|AbortError)/,
  /\bat\s+[\w$.<>]+\s*\(/,
];

export function userErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message || message.length > 220 || TECHNICAL_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}

export function actionableMessage(whatHappened: string, nextStep?: string): string {
  return nextStep ? `${whatHappened} ${nextStep}` : whatHappened;
}
