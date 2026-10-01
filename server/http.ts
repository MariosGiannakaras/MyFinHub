import crypto from 'node:crypto';

export class ApiError extends Error {
  status: number;
  code: string;
  expose: boolean;
  constructor(status: number, code: string, message: string, expose = true) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

function firstHeader(value: unknown): string {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

export function requestHeader(req: any, name: string): string {
  return firstHeader(req?.headers?.[name.toLowerCase()]);
}

export function requestQueryValue(req:any,name:string):string{
  const query=req&&typeof req==='object'?(req as {query?:unknown}).query:undefined;
  if(!query||typeof query!=='object'||Array.isArray(query))return '';
  const value=(query as Record<string,unknown>)[name];
  return typeof value==='string'?value.trim():'';
}

function boundedContentLength(req:any,maxBytes:number):number|null{
  const raw=requestHeader(req,'content-length').trim();
  if(!raw)return null;
  if(!/^\d+$/.test(raw))throw new ApiError(400,'INVALID_CONTENT_LENGTH','Invalid Content-Length header.');
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<0)throw new ApiError(400,'INVALID_CONTENT_LENGTH','Invalid Content-Length header.');
  if(value>maxBytes)throw new ApiError(413,'PAYLOAD_TOO_LARGE','Request is too large.');
  return value;
}

export function safeErrorDiagnostic(error:unknown):string{
  const raw=error instanceof Error?error.message:String(error);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi,'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[REDACTED_JWT]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/gi,'[REDACTED_SUPABASE_KEY]')
    .replace(/\b\d{13,19}\b/g,'[REDACTED_NUMBER]')
    .slice(0,512);
}

export function sendJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store, max-age=0');
  res.setHeader('pragma', 'no-cache');
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res: any, allowed: string[]) {
  res.setHeader('allow', allowed.join(', '));
  sendJson(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
}

export function assertSameOrigin(req: any) {
  const site = requestHeader(req, 'sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    throw new ApiError(403, 'CROSS_SITE_REQUEST', 'Cross-site request blocked.');
  }

  const origin = requestHeader(req, 'origin');
  if (!origin) {
    if (site === 'same-origin' || site === 'none') return;
    throw new ApiError(403, 'ORIGIN_REQUIRED', 'Request origin is required.');
  }

  const forwardedHost = requestHeader(req, 'x-forwarded-host');
  const host = forwardedHost || requestHeader(req, 'host');
  const forwardedProto = requestHeader(req, 'x-forwarded-proto');
  const proto = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  if (!host) throw new ApiError(403, 'ORIGIN_INVALID', 'Request origin is invalid.');

  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { throw new ApiError(403, 'ORIGIN_INVALID', 'Request origin is invalid.'); }

  if (parsed.host !== host || parsed.protocol !== `${proto}:`) {
    throw new ApiError(403, 'ORIGIN_MISMATCH', 'Cross-origin request blocked.');
  }
}

export async function readJsonBody<T = unknown>(req: any, maxBytes = 5 * 1024 * 1024): Promise<T> {
  const contentType = requestHeader(req, 'content-type').toLowerCase();
  if (contentType && !contentType.startsWith('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected application/json.');
  }

  boundedContentLength(req,maxBytes);

  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
    try { return (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) as T; }
    catch { throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON payload.'); }
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try { return (raw ? JSON.parse(raw) : {}) as T; }
  catch { throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON payload.'); }
}

export function copyBoundedBinaryValue(value:unknown,maxBytes:number):Buffer{
  let buffer:Buffer;
  if(Buffer.isBuffer(value))buffer=Buffer.from(value);
  else if(value instanceof Uint8Array)buffer=Buffer.from(value);
  else if(typeof value==='string')buffer=Buffer.from(value,'utf8');
  else throw new ApiError(400,'INVALID_BINARY_BODY','Invalid binary payload.');
  if(buffer.byteLength>maxBytes)throw new ApiError(413,'PAYLOAD_TOO_LARGE','Request is too large.');
  return buffer;
}

export async function readBinaryBody(req:any,maxBytes:number):Promise<Buffer>{
  boundedContentLength(req,maxBytes);

  const body=req&&typeof req==='object'?(req as {body?:unknown}).body:undefined;
  if(body!==undefined)return copyBoundedBinaryValue(body,maxBytes);

  const chunks:Buffer[]=[];
  let total=0;
  for await(const chunk of req as AsyncIterable<unknown>){
    const buffer=copyBoundedBinaryValue(chunk,maxBytes);
    total+=buffer.byteLength;
    if(total>maxBytes)throw new ApiError(413,'PAYLOAD_TOO_LARGE','Request is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks,total);
}

export async function handleApi(res: any, fn: (requestId: string) => Promise<void> | void) {
  const requestId = crypto.randomUUID();
  res.setHeader('x-request-id', requestId);
  try {
    await fn(requestId);
  } catch (error) {
    const apiError = error instanceof ApiError
      ? error
      : new ApiError(500, 'INTERNAL_ERROR', 'Unexpected server error.', false);

    if (!(error instanceof ApiError) || apiError.status >= 500) {
      console.error('[RheomIQ API]', {
        requestId,
        code: apiError.code,
        message: safeErrorDiagnostic(error),
      });
    }

    const message = apiError.expose ? apiError.message : 'Unexpected server error.';
    sendJson(res, apiError.status, { error: message, code: apiError.code, requestId });
  }
}
