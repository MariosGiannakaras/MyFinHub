import { readStore, writeStore } from '../server/storage.js';

async function readBody(req: any) {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function send(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') return send(res, 200, await readStore());
    if (req.method === 'PUT') {
      const expected = Array.isArray(req.headers?.['if-match']) ? req.headers['if-match'][0] : req.headers?.['if-match'];
      return send(res, 200, await writeStore(await readBody(req), expected || undefined));
    }
    res.setHeader('allow', 'GET, PUT');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    const e = error as Error & { code?: string };
    return send(res, e.code === 'REVISION_CONFLICT' ? 409 : 500, { error: e.message || 'Data request failed' });
  }
}
