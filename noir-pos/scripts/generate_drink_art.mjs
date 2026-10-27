import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_PRODUCTS } from "../src/data.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(scriptDir, "../public/drinks");
const drinkCategories = new Set(["Beer", "Spirits", "Wine", "Soft Drinks"]);
const palette = {
  Beer: ["#d8a647", "#70451e"],
  Spirits: ["#a9b7a2", "#33433c"],
  Wine: ["#bd7180", "#542c3a"],
  "Soft Drinks": ["#68c2bd", "#205765"],
};

function slugify(value) {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

function labelLines(value) {
  const words = value.split(/\s+/);
  if (words.length < 2 || value.length < 14) return [value, ""];
  let first = "";
  let second = "";
  for (const word of words) {
    if (!first || first.length + word.length < 14) first = `${first} ${word}`.trim();
    else second = `${second} ${word}`.trim();
  }
  return [first, second];
}

function makeArt(product) {
  const [accent, shade] = palette[product.category];
  const isCan = product.category === "Soft Drinks" || /can|cider|snap|horse/i.test(product.name);
  const bottle = product.category === "Wine" ? "MATURED POUR" : product.category === "Spirits" ? "HOUSE POUR" : "COLD SERVE";
  const [lineOne, lineTwo] = labelLines(product.name);
  const silhouette = isCan
    ? `<rect x="141" y="76" width="118" height="254" rx="20" fill="url(#pack)" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/><path d="M150 91h100M150 315h100" stroke="#ffffff" stroke-opacity=".55" stroke-width="4"/><path d="M155 80h90" stroke="#0b0b0f" stroke-opacity=".35" stroke-width="4"/>`
    : `<path d="M169 68h62v42l20 23v172q0 26-25 26h-52q-25 0-25-26V133l20-23z" fill="url(#pack)" stroke="#ffffff" stroke-opacity=".5" stroke-width="2"/><path d="M171 86h58M171 99h58" stroke="#ffffff" stroke-opacity=".45" stroke-width="3"/>`;
  const labelX = isCan ? 153 : 151;
  const labelWidth = isCan ? 94 : 98;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="${escapeXml(product.name)} ${escapeXml(product.category)} packshot">
  <defs><linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#252530"/><stop offset="1" stop-color="#0b0b0f"/></linearGradient><linearGradient id="pack" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${shade}"/><stop offset=".28" stop-color="${accent}"/><stop offset=".55" stop-color="${shade}"/><stop offset=".82" stop-color="${accent}"/><stop offset="1" stop-color="${shade}"/></linearGradient><linearGradient id="label" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f3eee2"/><stop offset="1" stop-color="#d6cdb8"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#back)"/><path d="M0 330h400" stroke="#ffffff" stroke-opacity=".08"/><path d="M96 346h208" stroke="#000000" stroke-opacity=".5" stroke-width="12" stroke-linecap="round"/>
  ${silhouette}
  <rect x="${labelX}" y="174" width="${labelWidth}" height="94" rx="8" fill="url(#label)" stroke="#ffffff" stroke-opacity=".65"/>
  <path d="M${labelX + 8} 184h${labelWidth - 16}" stroke="${accent}" stroke-width="3"/>
  <text x="200" y="204" text-anchor="middle" fill="#25232a" font-family="Plus Jakarta Sans,Arial,sans-serif" font-size="8" font-weight="700" letter-spacing="1">NOIR · ${escapeXml(product.category.toUpperCase())}</text>
  <text x="200" y="225" text-anchor="middle" fill="#17161b" font-family="Plus Jakarta Sans,Arial,sans-serif" font-size="${lineOne.length > 12 ? 11 : 14}" font-weight="800">${escapeXml(lineOne)}</text>
  ${lineTwo ? `<text x="200" y="241" text-anchor="middle" fill="#17161b" font-family="Plus Jakarta Sans,Arial,sans-serif" font-size="11" font-weight="800">${escapeXml(lineTwo)}</text>` : ""}
  <text x="200" y="256" text-anchor="middle" fill="#514b43" font-family="DM Mono,monospace" font-size="8" letter-spacing="1">${escapeXml(product.sub || bottle).toUpperCase()}</text>
  <path d="M${isCan ? 157 : 166} 121v118" stroke="#ffffff" stroke-opacity=".25" stroke-width="4" stroke-linecap="round"/>
  <text x="200" y="375" text-anchor="middle" fill="#c6c6d0" fill-opacity=".72" font-family="DM Mono,monospace" font-size="9" letter-spacing="2">NOIR · NAIROBI</text>
</svg>`;
}

await mkdir(outputDir, { recursive: true });
const uniqueProducts = new Map();
for (const product of SEED_PRODUCTS) {
  if (drinkCategories.has(product.category)) uniqueProducts.set(slugify(product.name), product);
}

for (const [slug, product] of uniqueProducts) {
  await writeFile(path.join(outputDir, `${slug}.svg`), makeArt(product));
}

console.log(`Generated ${uniqueProducts.size} local drink illustrations in ${outputDir}`);
