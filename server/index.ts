import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupStore, readStore, writeStore } from './storage.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'RheomIQ' }));
app.get('/api/data', async (_req, res) => {
  try { res.set('cache-control', 'no-store').json(await readStore()); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Data read failed' }); }
});
app.put('/api/data', async (req, res) => {
  try { res.json(await writeStore(req.body, req.header('if-match') || undefined)); }
  catch (error) {
    const e = error as Error & { code?: string };
    res.status(e.code === 'REVISION_CONFLICT' ? 409 : 500).json({ error: e.message });
  }
});
app.post('/api/import', async (req, res) => {
  try { res.json(await writeStore(req.body, undefined, true)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Import failed' }); }
});
app.post('/api/backup', async (_req, res) => {
  try { res.json({ path: await backupStore() }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : 'Backup failed' }); }
});

const serveDist = process.argv.includes('--serve-dist') || process.env.NODE_ENV === 'production';
if (serveDist) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '..', 'dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.RHEOMIQ_PORT || process.env.PORT || 4317);
app.listen(port, '127.0.0.1', () => console.log(`RheomIQ server: http://127.0.0.1:${port}`));
