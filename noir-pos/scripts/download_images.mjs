import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.resolve(__dirname, '../src/assets/products');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

import('../src/data.js').then(mod => {
  const products = mod.SEED_PRODUCTS;
  const alcoholCats = new Set(['Spirits','Beer','Wine']);
  const tasks = products.filter(p => alcoholCats.has(p.category)).map(async p => {
    try {
      const url = p.image;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed ${res.status}`);
      const dest = path.join(assetsDir, `${p.id}.jpg`);
      const fileStream = fs.createWriteStream(dest);
      await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
      });
      console.log('Saved', dest);
    } catch (err) {
      console.error('Error', p.id, p.name, err.message);
    }
  });
  return Promise.all(tasks);
}).then(() => console.log('Done')).catch(err => { console.error(err); process.exit(1); });
