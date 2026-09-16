import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  constructor() {
    this.value = ''; this.children = []; this.style = {}; this.textContent = '';
    const classes = new Set();
    this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, enabled) {
      const on = enabled === undefined ? !classes.has(c) : enabled;
      if (on) classes.add(c); else classes.delete(c);
      return on;
    } };
  }
  setAttribute() {}
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  querySelector() { return this.paragraph ||= new Element(); }
  focus() {}
}
test('UI reads metadata, creates a real API job, shows returned progress, and records ready files', async () => {
  const elements = new Map(), storage = new Map(), calls = [];
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const context = vm.createContext({
    document: { getElementById: get, createElement: () => new Element(), body: new Element() },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) },
    URL, AbortController, console, setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, options) => {
      const op = new URL(url, 'https://softload.example').searchParams.get('op'); calls.push(op);
      const data = {
        health: { ok: true },
        info: { title: 'My video', channel: 'My channel', duration: 10, qualities: [{ height: 720, bytes: 1024 }] },
        create: { id: 'a'.repeat(32) },
        status: { status: 'ready', progress: 100, message: 'Ready', expires: Date.now() / 1000 + 3600 }
      };
      return { ok: true, status: 200, json: async () => data[op] };
    }
  });
  vm.runInContext(readFileSync(new URL('../public/app.js', import.meta.url), 'utf8'), context);
  get('url').value = 'https://youtu.be/abcdefghijk';
  await vm.runInContext('inspect()', context);
  assert.equal(get('vtitle').textContent, 'My video');
  assert.equal(get('opts').classList.contains('show'), true);
  await vm.runInContext("start('MP4')", context);
  // Allow the asynchronous status response to complete.
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(calls.includes('create')); assert.ok(calls.includes('status'));
  assert.equal(get('done').classList.contains('show'), true);
  assert.equal(get('saveFile').href, '/api/softload?op=file&id=' + 'a'.repeat(32));
  assert.equal(JSON.parse(storage.get('softload-history'))[0].title, 'My video');
  get('clearHistory').onclick();
  assert.equal(JSON.parse(storage.get('softload-history')).length, 0);
});

 
                              