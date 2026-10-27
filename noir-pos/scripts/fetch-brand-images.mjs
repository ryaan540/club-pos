import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public/drinks');
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const brandOf = (n) => n.replace(/\b\d+\s?(ml|ltr|l)\b/gi, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
const file = (s) => path.join(outDir, `${s}.jpg`);

const src = fs.readFileSync(path.join(root, 'src/data.js'), 'utf8');
const start = src.indexOf('export const SEED_PRODUCTS');
const block = src.slice(start, src.indexOf('];', start));
const names = [...block.matchAll(/name:\s*["']([^"']+)["']/g)].map((m) => m[1]);

async function lookup(brand) {
  const url = 'https://world.openfoodfacts.org/cgi/search.pl?' + new URLSearchParams({
    search_terms: brand, search_simple: 1, action: 'process', json: 1, page_size: 10,
    fields: 'product_name,brands,image_front_url',
  });
  const res = await fetch(url, { headers: { 'User-Agent': 'ClubPOS/1.0 (you@example.com)' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const word = brand.toLowerCase().split(' ')[0];
  const hit = ((await res.json()).products || []).find((h) =>
    h.image_front_url && `${h.product_name} ${h.brands}`.toLowerCase().includes(word));
  return hit?.image_front_url || null;
}

const brandCache = new Map();
async function brandImage(brand) {
  const key = slug(brand);
  if (brandCache.has(key)) return brandCache.get(key);
  let buf = null;
  if (fs.existsSync(file(key))) buf = fs.readFileSync(file(key));
  else {
    try {
      const url = await lookup(brand);
      if (url) {
        const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (r.ok && (r.headers.get('content-type') || '').startsWith('image/')) buf = Buffer.from(await r.arrayBuffer());
      }
    } catch (e) { console.log('  error:', e.message); }
    await new Promise((r) => setTimeout(r, 700));
  }
  brandCache.set(key, buf);
  return buf;
}

const missing = [];
for (const name of names) {
  const target = file(slug(name));
  if (fs.existsSync(target)) { console.log('Have   ', name); continue; }
  const buf = await brandImage(brandOf(name));
  if (buf) { fs.writeFileSync(target, buf); console.log('Saved  ', name); }
  else { console.log('Missing', name); missing.push(`${slug(name)}.jpg`); }
}

fs.writeFileSync(path.join(outDir, 'MISSING.txt'), missing.join('\n') || 'none');
console.log(`\n${missing.length} of ${names.length} missing. See public/drinks/MISSING.txt`);
