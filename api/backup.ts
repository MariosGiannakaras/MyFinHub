import { backupStore } from '../server/storage.js';

export default async function handler(req: any, res: any) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('allow', 'POST');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  try {
    res.statusCode = 200;
    res.end(JSON.stringify({ path: await backupStore() }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Backup failed' }));
  }
}
