// Copies the AMB web build into www/ for Capacitor. The web app is the single
// source of truth; the Android app never carries its own copy in git.
import fs from 'fs'; import path from 'path'; import url from 'url';
const here = path.dirname(url.fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../anthonys-music-box');
const dst = path.resolve(here, '../www');
const skip = new Set(['_headers', 'netlify.toml', 'README.txt', 'sw.js']);
fs.rmSync(dst, { recursive: true, force: true });
(function copy(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    if (e.name.startsWith('.') || skip.has(e.name)) continue;
    const s = path.join(a, e.name), d = path.join(b, e.name);
    e.isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
})(src, dst);
console.log('Copied web app to', dst);
