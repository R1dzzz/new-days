// Post-build: inject the real file list into dist/sw.js so the app works offline after the first visit.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const dist = new URL('../dist/', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f !== 'sw.js') files.push('./' + relative(dist, p).split('\\').join('/'));
  }
})(dist);
files.push('./');
const hash = createHash('sha1');
for (const f of files.sort()) if (f !== './') hash.update(readFileSync(join(dist, f)));
const sw = readFileSync(join(dist, 'sw.js'), 'utf8').replace('__VERSION__', hash.digest('hex').slice(0, 10)).replace('__PRECACHE__', JSON.stringify(files));
writeFileSync(join(dist, 'sw.js'), sw);
console.log(`sw.js: precaching ${files.length} files`);
