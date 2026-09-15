import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function canonicalURL(value) {
  let u; try { u = new URL(value); } catch { throw new Error('Tautan YouTube tidak valid.'); }
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port) throw new Error('Tautan YouTube tidak valid.');
  let id;
  if (u.hostname === 'youtu.be') id = u.pathname.split('/')[1];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else if (/^\/(shorts|embed|live)\//.test(u.pathname)) id = u.pathname.split('/')[2];
  }
  if (!/^[\w-]{11}$/.test(id || '')) throw new Error('Tautan YouTube tidak valid.');
  return 'https://www.youtube.com/watch?v=' + id;
}
export function safeError(error) {
  const s = String(error);
  if (/format.*not available/i.test(s)) return 'Kualitas ini tidak tersedia. Pilih kualitas lain.';
  if (/private|unavailable|not available|removed|members-only/i.test(s)) return 'Video tidak tersedia atau aksesnya dibatasi.';
  if (/sign in|bot|403|429|captcha|confirm/i.test(s)) return 'YouTube membatasi akses dari server ini. Coba lagi nanti atau hubungi pemilik server.';
  if (/timed? ?out|timeout/i.test(s)) return 'Proses melewati batas waktu. Coba video yang lebih pendek.';
  return 'Video gagal diproses. Coba kualitas lain atau periksa tautannya.';
}
export function summarize(info, maxDuration) {
  if (info.is_live || info.live_status === 'is_live' || info.live_status === 'is_upcoming') throw new Error('Siaran langsung belum didukung.');
  if (!Number.isFinite(info.duration) || info.duration <= 0 || info.duration > maxDuration) throw new Error('Video harus berdurasi maksimal ' + Math.floor(maxDuration / 60) + ' menit.');
  const formats = info.formats || [];
  const audio = formats.filter(f => f.ext === 'm4a' && f.vcodec === 'none').sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];
  const qualities = [1080, 720, 480, 360].flatMap(height => {
    const f = formats.filter(f => f.ext === 'mp4' && f.vcodec !== 'none' && f.height === height).sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
    if (!f) return [];
    const videoBytes = f.filesize || f.filesize_approx, audioBytes = audio?.filesize || audio?.filesize_approx;
    return [{ height, bytes: videoBytes && (f.acodec !== 'none' || audioBytes) ? videoBytes + (f.acodec === 'none' ? audioBytes : 0) : null }];
  });
  return { id: info.id, title: String(info.title || 'Video YouTube'), channel: String(info.channel || info.uploader || ''), duration: info.duration, qualities };
}
export function signature(secret, id, expires) { return createHmac('sha256', secret).update(id + ':' + expires).digest('hex'); }
export function validSignature(secret, id, expires, sig, now = Date.now() / 1000) {
  if (!/^[a-f0-9]{32}$/.test(id) || !/^\d+$/.test(String(expires)) || !/^[a-f0-9]{64}$/.test(sig || '')) return false;
  if (Number(expires) <= now || Number(expires) > now + 310) return false;
  return timingSafeEqual(Buffer.from(signature(secret, id, expires)), Buffer.from(sig));
}
const BASE_ARGS = ['--ignore-config', '--no-playlist', '--no-warnings', '--no-cache-dir', '--js-runtimes', 'node', '--socket-timeout', '20', '--retries', '2', '--fragment-retries', '2'];
export function downloadArgs(url, format, quality, directory, maxBytes) {
  if (!['MP3', 'MP4'].includes(format) || ![360, 480, 720, 1080].includes(quality)) throw new Error('Format atau kualitas tidak valid.');
  const args = [...BASE_ARGS, '--newline', '--progress', '--progress-template', 'download:SOFTLOAD:%(progress._percent_str)s', '--max-filesize', String(maxBytes), '-o', path.join(directory, 'media.%(ext)s')];
  if (format === 'MP3') args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '192K');
  else args.push('-f', 'bv[ext=mp4][height<=' + quality + ']+ba[ext=m4a]/b[ext=mp4][height<=' + quality + ']', '--merge-output-format', 'mp4');
  return [...args, '--', canonicalURL(url)];
}
function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  try { if (process.platform === 'win32') child.kill('SIGKILL'); else process.kill(-child.pid, 'SIGKILL'); } catch {}
}
function run(args, { timeout = 45000, onLine, onChild } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    onChild?.(child);
    let stdout = '', stderr = '', pending = '', overflow = false, expired = false;
    const timer = setTimeout(() => { expired = true; stopProcess(child); }, timeout);
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 8 * 1024 * 1024) { overflow = true; stopProcess(child); return; }
      pending += chunk; const lines = pending.split(/\r?\n/); pending = lines.pop(); lines.forEach(line => onLine?.(line));
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (expired) reject(new Error('timeout'));
      else if (overflow) reject(new Error('output limit'));
      else if (code !== 0) reject(new Error(stderr || 'Processing failed'));
      else resolve(stdout);
    });
  });
}
export async function createService(config = {}) {
  const secret = config.secret || process.env.BACKEND_SECRET || '';
  const publicBase = config.publicBase || process.env.PUBLIC_BASE_URL || '';
  if (secret.length < 32) throw new Error('BACKEND_SECRET must contain at least 32 characters.');
  if (!/^https:\/\/[^/]+\/?$/.test(publicBase)) throw new Error('PUBLIC_BASE_URL must be an HTTPS origin.');
  const root = path.resolve(config.dataDir || process.env.DATA_DIR || './data');
  const maxConcurrent = Number(process.env.MAX_CONCURRENT || 2), maxDuration = Number(process.env.MAX_DURATION || 1800);
  const maxBytes = Number(process.env.MAX_FILE_MB || 250) * 1048576, maxJobSeconds = Number(process.env.MAX_JOB_SECONDS || 1200);
  await fs.mkdir(root, { recursive: true });
  // A single service instance owns this directory. Jobs do not survive a restart.
  for (const name of await fs.readdir(root)) if (/^[a-f0-9]{32}$/.test(name)) await fs.rm(path.join(root, name), { recursive: true, force: true });
  const jobs = new Map(), clients = new Map();
  let active = 0, infos = 0;
  const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
  const clean = async () => {
    for (const [id, job] of jobs) if (!['processing', 'queued'].includes(job.status) && job.expires < Date.now() / 1000) {
      jobs.delete(id); await fs.rm(path.join(root, id), { recursive: true, force: true }).catch(() => {});
    }
    for (const [key, entry] of clients) if (entry.until < Date.now()) clients.delete(key);
  };
  const cleaner = setInterval(() => { clean().catch(console.error); }, 60000); cleaner.unref();
  function rate(key, limit) {
    const now = Date.now(); let entry = clients.get(key);
    if (!entry || entry.until < now) { entry = { until: now + 60000, count: 0 }; clients.set(key, entry); }
    return ++entry.count <= limit && clients.size <= 10000;
  }
  async function info(url, job) {
    const raw = await run([...BASE_ARGS, '--dump-single-json', '--skip-download', '--', canonicalURL(url)], { onChild: child => { if (job) { job.child = child; if (job.cancelled) stopProcess(child); } } });
    return summarize(JSON.parse(raw), maxDuration);
  }
  async function processJob(job, body) {
    const directory = path.join(root, job.id);
    let guard;
    try {
      job.status = 'processing'; job.message = 'Membaca informasi video...';
      const metadata = await info(body.url, job);
      if (job.cancelled) throw new Error('cancelled');
      if (body.format === 'MP4' && !metadata.qualities.some(q => q.height === body.quality)) throw new Error('format not available');
      await fs.mkdir(directory);
      guard = setInterval(async () => {
        try {
          const files = await fs.readdir(directory);
          const sizes = await Promise.all(files.map(f => fs.stat(path.join(directory, f)).then(s => s.size).catch(() => 0)));
          if (sizes.reduce((a, b) => a + b, 0) > maxBytes * 3) { job.limit = true; stopProcess(job.child); }
        } catch {}
      }, 1000);
      job.message = 'Mengunduh media...';
      await run(downloadArgs(body.url, body.format, body.quality, directory, maxBytes), {
        timeout: maxJobSeconds * 1000,
        onChild: child => { job.child = child; if (job.cancelled) stopProcess(child); },
        onLine: line => {
          const match = line.match(/SOFTLOAD:\s*([\d.]+)%/);
          if (match) { job.progress = Math.min(100, Number(match[1])); job.message = 'Mengunduh bagian media...'; }
          else if (/Merger|ExtractAudio|ffmpeg|Fixup/.test(line)) { job.progress = null; job.message = 'Menyatukan atau mengonversi media...'; }
        }
      });
      if (job.cancelled) throw new Error('cancelled');
      const filename = 'media.' + body.format.toLowerCase();
      const stat = await fs.stat(path.join(directory, filename));
      if (!stat.size || stat.size > maxBytes) { job.limit = true; throw new Error('file limit'); }
      job.status = 'ready'; job.message = 'Berkas siap disimpan.'; job.progress = 100;
      job.file = filename; job.title = metadata.title; job.bytes = stat.size;
      // Remove intermediate fragments while retaining only the completed file.
      for (const name of await fs.readdir(directory)) if (name !== filename) await fs.rm(path.join(directory, name), { force: true });
    } catch (error) {
      job.status = job.cancelled ? 'cancelled' : 'failed';
      job.message = job.cancelled ? 'Proses dibatalkan.' : job.limit ? 'Berkas melebihi batas ukuran server.' : safeError(error);
      await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    } finally {
      clearInterval(guard); job.child = null; job.expires = Date.now() / 1000 + 3600; active--;
    }
  }
  async function bodyJSON(req) {
    let data = '';
    for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 4096) throw new Error('Request too large'); }
    return JSON.parse(data);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      if (u.pathname === '/healthz' && req.method === 'GET') return json(res, 200, { ok: true });
      const fileMatch = u.pathname.match(/^\/files\/([a-f0-9]{32})$/);
      if (fileMatch && req.method === 'GET') {
        const id = fileMatch[1];
        if (!validSignature(secret, id, u.searchParams.get('expires'), u.searchParams.get('sig'))) return json(res, 403, { error: 'Tautan kedaluwarsa. Klik Simpan berkas kembali dari web.' });
        const job = jobs.get(id);
        if (!job || job.status !== 'ready' || job.expires < Date.now() / 1000) return json(res, 410, { error: 'Berkas kedaluwarsa. Proses video kembali.' });
        const filename = path.join(root, id, job.file);
        const stat = await fs.stat(filename);
        res.writeHead(200, { 'Content-Type': job.file.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4', 'Content-Length': stat.size, 'Content-Disposition': 'attachment; filename="softload-' + id.slice(0, 8) + path.extname(job.file) + '"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
        const stream = createReadStream(filename); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); return stream.pipe(res);
      }
      const received = Buffer.from(String(req.headers.authorization || '')), expected = Buffer.from('Bearer ' + secret);
      if (received.length !== expected.length || !timingSafeEqual(received, expected)) return json(res, 401, { error: 'Akses ditolak.' });
      if (u.pathname === '/health' && req.method === 'GET') return json(res, 200, { ok: true });
      const client = String(req.headers['x-softload-client'] || 'unknown').slice(0, 64);
      if (u.pathname === '/info' && req.method === 'POST') {
        if (!rate('info:' + client, 12) || infos >= 2) return json(res, 429, { error: 'Terlalu banyak permintaan. Coba sebentar lagi.' });
        let body; try { body = await bodyJSON(req); body.url = canonicalURL(body.url); } catch { return json(res, 400, { error: 'Tautan tidak valid.' }); }
        infos++;
        try { return json(res, 200, await info(body.url)); }
        catch (error) { return json(res, 422, { error: /maksimal|Siaran/.test(error.message) ? error.message : safeError(error) }); }
        finally { infos--; }
      }
      if (u.pathname === '/jobs' && req.method === 'POST') {
        let body;
        try { body = await bodyJSON(req); body.url = canonicalURL(body.url); downloadArgs(body.url, body.format, body.quality, root, maxBytes); }
        catch { return json(res, 400, { error: 'Tautan, format, atau kualitas tidak valid.' }); }
        if (!rate('job:' + client, 4) || active >= maxConcurrent || jobs.size >= 30) return json(res, 429, { error: 'Server sedang penuh. Coba kembali sebentar.' });
        const id = randomBytes(16).toString('hex');
        const job = { id, status: 'queued', message: 'Menunggu proses...', progress: null, expires: Date.now() / 1000 + 3600 };
        jobs.set(id, job); active++;
        processJob(job, body).catch(console.error);
        return json(res, 202, { id });
      }
      const match = u.pathname.match(/^\/jobs\/([a-f0-9]{32})(\/link)?$/);
      if (match) {
        const job = jobs.get(match[1]);
        if (!job || job.expires < Date.now() / 1000) return json(res, 404, { error: 'Proses tidak ditemukan atau telah kedaluwarsa.' });
        if (req.method === 'DELETE' && !match[2]) {
          if (['processing', 'queued'].includes(job.status)) { job.cancelled = true; stopProcess(job.child); }
          return json(res, 200, { ok: true });
        }
        if (req.method === 'GET' && match[2]) {
          if (job.status !== 'ready') return json(res, 409, { error: 'Berkas belum siap.' });
          const expires = Math.min(Math.floor(Date.now() / 1000) + 300, Math.floor(job.expires));
          const link = publicBase.replace(/\/$/, '') + '/files/' + job.id + '?expires=' + expires + '&sig=' + signature(secret, job.id, expires);
          return json(res, 200, { url: link });
        }
        if (req.method === 'GET') return json(res, 200, { id: job.id, status: job.status, progress: job.progress, message: job.message, expires: job.expires });
      }
      return json(res, 404, { error: 'Endpoint tidak ditemukan.' });
    } catch { if (!res.headersSent) json(res, 500, { error: 'Server gagal memproses permintaan.' }); else res.destroy(); }
  });
  server.requestTimeout = 60000;
  server.on('close', () => { clearInterval(cleaner); for (const job of jobs.values()) { job.cancelled = true; stopProcess(job.child); } });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const command of ['yt-dlp', 'ffmpeg', 'ffprobe']) {
    const result = spawnSync(command, [command === 'yt-dlp' ? '--version' : '-version'], { stdio: 'ignore' });
    if (result.error || result.status !== 0) throw new Error(command + ' is not installed or cannot run.');
  }
  const server = await createService();
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('Softload backend listening.'));
  for (const event of ['SIGTERM', 'SIGINT']) process.on(event, () => { server.close(); setTimeout(() => process.exit(0), 1500).unref(); });
}


  

                                                                             