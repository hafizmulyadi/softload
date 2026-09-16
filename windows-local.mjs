import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/softload.js';
const root = path.dirname(fileURLToPath(import.meta.url));
process.env.SOFTLOAD_LOCAL = '1';
process.env.BACKEND_URL = 'http://127.0.0.1:8080';
if (!process.env.BACKEND_SECRET) throw new Error('Jalankan Setup-Windows.ps1 dahulu.');
const child = spawn(process.execPath, [path.join(root, 'backend/server.mjs')], {
  windowsHide: true, stdio: 'inherit',
  env: { ...process.env, PORT: '8080', HOST: '127.0.0.1', PUBLIC_BASE_URL: 'http://127.0.0.1:8080', DATA_DIR: path.join(root, 'backend/data'), YTDLP_PATH: path.join(root, 'backend/tools/yt-dlp.exe') }
});
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8081');
  try {
    if (url.pathname === '/api/softload') {
      req.query = Object.fromEntries(url.searchParams);
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 4096) { res.writeHead(413).end(); return; } }
      req.body = body || undefined;
      return await handler(req, res);
    }
    const file = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js' }[url.pathname];
    if (!file || req.method !== 'GET') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(path.join(root, 'public', file)));
  } catch { if (!res.headersSent) res.writeHead(500); res.end('Layanan lokal gagal merespons.'); }
});
let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true; server.close();
  if (child.pid && child.exitCode === null) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  process.exit(code);
}
child.on('error', error => { console.error(error.message); stop(1); });
child.on('exit', code => { if (!stopping) stop(code || 1); });
server.on('error', error => { console.error(error.message); stop(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
try {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch('http://127.0.0.1:8080/health', { headers: { Authorization: 'Bearer ' + process.env.BACKEND_SECRET }, signal: AbortSignal.timeout(1000) }); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Backend belum siap. Periksa port 8080 dan dependensi.');
  server.listen(8081, '127.0.0.1', () => console.log('Buka http://127.0.0.1:8081 - tekan Ctrl+C untuk berhenti.'));
} catch (error) { console.error(error.message); stop(1); }

 
 
                                                                                                                                               