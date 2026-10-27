import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const photoDir = path.join(root, 'drink-photos');
const outDir = path.join(root, 'public/drinks');
fs.mkdirSync(photoDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const brandOf = (n) => n.replace(/\b\d+\s?(ml|ltr|l)\b/gi, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

const src = fs.readFileSync(path.join(root, 'src/data.js'), 'utf8');
const start = src.indexOf('export const SEED_PRODUCTS');
const block = src.slice(start, src.indexOf('];', start));
const names = [...block.matchAll(/name:\s*["']([^"']+)["']/g)].map((m) => m[1]);

const photos = new Map();
for (const f of fs.readdirSync(photoDir)) {
  if (/\.(jpe?g|png|webp)$/i.test(f)) photos.set(slug(f.replace(/\.[^.]+$/, '')), path.join(photoDir, f));
}

if (process.argv.includes('--list')) {
  const brands = [...new Set(names.map((n) => slug(brandOf(n))))];
  console.log('Save one photo per brand, named like this (jpg, png or webp):\n');
  brands.forEach((b) => console.log(`  ${b}.jpg${photos.has(b) ? '   <- have it' : ''}`));
  process.exit(0);
}

const used = new Set();
const missing = [];
let copied = 0;
for (const name of names) {
  const productKey = slug(name);
  const brandKey = slug(brandOf(name));
  const noCan = slug(brandOf(name).replace(/\s+can$/i, ''));
  const hit = [productKey, brandKey, noCan].find((k) => photos.has(k));
  if (!hit) { missing.push(name); continue; }
  fs.copyFileSync(photos.get(hit), path.join(outDir, `${productKey}.jpg`));
  used.add(hit);
  copied++;
  console.log('Copied ', `${hit} -> ${productKey}.jpg`);
}

const unmatched = [...photos.keys()].filter((k) => !used.has(k));
console.log(`\n${copied} drinks now have your photos.`);
if (unmatched.length) console.log('Photos that matched no drink (check the spelling):', unmatched.join(', '));
console.log(`${missing.length} drinks still use the placeholder art.`);
