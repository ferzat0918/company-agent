#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(ROOT, '../..');
const ASSETS = path.join(ROOT, 'assets');

// Read env vars from the project-root .env (single source of truth)
const envFile = path.join(PROJECT_ROOT, '.env');
const env = Object.fromEntries(
  (await fs.readFile(envFile, 'utf8'))
    .split('\n').filter(Boolean).map(l => l.split('=').map(s => s.trim()))
);
const TOKEN = env.FIGMA_TOKEN;
const FILE_KEY = env.FIGMA_FILE_KEY;
if (!TOKEN || !FILE_KEY) throw new Error('Missing FIGMA_TOKEN or FIGMA_FILE_KEY in project root .env');

const headers = { 'X-Figma-Token': TOKEN };

async function api(url) {
  const res = await fetch(`https://api.figma.com/v1${url}`, { headers });
  if (!res.ok) throw new Error(`API ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return buf.length;
}

async function exportNodes(nodeIds, format, scale = 1) {
  const ids = nodeIds.join(',');
  const params = new URLSearchParams({ ids, format });
  if (format === 'png' && scale !== 1) params.set('scale', String(scale));
  if (format === 'svg') params.set('svg_simplify_stroke', 'true');
  const data = await api(`/images/${FILE_KEY}?${params}`);
  if (data.err) throw new Error(`Export failed: ${data.err}`);
  return data.images;
}

const sanitize = s => s.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);

async function main() {
  console.log('━━━ Stage 1: file structure ━━━');
  const file = await api(`/files/${FILE_KEY}?depth=2`);
  console.log(`File: ${file.name}  (last modified ${file.lastModified})`);

  const page = file.document.children[0];
  const topFrames = page.children.filter(n => n.type === 'FRAME');
  console.log(`Top-level frames: ${topFrames.length}`);

  const manifest = {
    file: { key: FILE_KEY, name: file.name, lastModified: file.lastModified },
    exportedAt: new Date().toISOString(),
    logo: {},
    frames: [],
    imageFills: {},
  };

  console.log('\n━━━ Stage 2: LOGO as SVG ━━━');
  // Frame 1 contains the canonical LOGO grouping (X + UMX vectors)
  const logoNodes = {
    'logo-full':       '1:9',   // Frame 1 — whole composition (X + UMX)
    'logo-symbol-X':   '2:17',  // X figure only
    'logo-wordmark':   '2:13',  // UMX wordmark group
  };
  const svgUrls = await exportNodes(Object.values(logoNodes), 'svg');
  for (const [name, id] of Object.entries(logoNodes)) {
    const url = svgUrls[id];
    if (!url) { console.log(`  ✗ ${name} (${id}) — no URL`); continue; }
    const dest = path.join(ASSETS, 'logo', `${name}.svg`);
    const size = await downloadTo(url, dest);
    console.log(`  ✓ ${name}.svg  (${id}, ${size} bytes)`);
    manifest.logo[name] = { nodeId: id, file: `assets/logo/${name}.svg`, bytes: size };
  }

  console.log('\n━━━ Stage 3: all top-level frames as PNG @2x ━━━');
  // Export in batches of 10 to stay friendly with API
  const batchSize = 10;
  for (let i = 0; i < topFrames.length; i += batchSize) {
    const batch = topFrames.slice(i, i + batchSize);
    const urls = await exportNodes(batch.map(f => f.id), 'png', 2);
    for (const f of batch) {
      const url = urls[f.id];
      if (!url) { console.log(`  ✗ ${f.name} (${f.id}) — no URL`); continue; }
      const fileName = `${sanitize(f.name)}_${f.id.replace(':', '-')}.png`;
      const dest = path.join(ASSETS, 'frames', fileName);
      const size = await downloadTo(url, dest);
      console.log(`  ✓ ${fileName}  (${size} bytes)`);
      manifest.frames.push({ nodeId: f.id, name: f.name, file: `assets/frames/${fileName}`, bytes: size });
    }
  }

  console.log('\n━━━ Stage 4: embedded image fills ━━━');
  const imgs = await api(`/files/${FILE_KEY}/images`);
  const imageMap = imgs.meta?.images || {};
  console.log(`Embedded images: ${Object.keys(imageMap).length}`);
  let i = 0;
  for (const [hash, url] of Object.entries(imageMap)) {
    i++;
    const dest = path.join(ASSETS, 'frames', `_fill_${String(i).padStart(2, '0')}_${hash.slice(0, 8)}.png`);
    try {
      const size = await downloadTo(url, dest);
      console.log(`  ✓ fill ${i}/${Object.keys(imageMap).length}  ${hash.slice(0, 8)}  (${size} bytes)`);
      manifest.imageFills[hash] = { file: path.relative(ROOT, dest).replace(/\\/g, '/'), bytes: size };
    } catch (e) {
      console.log(`  ✗ fill ${hash.slice(0, 8)}: ${e.message}`);
    }
  }

  await fs.writeFile(path.join(ASSETS, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n━━━ done ━━━');
  console.log(`Manifest: assets/manifest.json`);
  console.log(`LOGO:     ${Object.keys(manifest.logo).length} SVGs`);
  console.log(`Frames:   ${manifest.frames.length} PNGs`);
  console.log(`Fills:    ${Object.keys(manifest.imageFills).length} PNGs`);
}

main().catch(e => { console.error('\n✗ FAILED:', e.message); process.exit(1); });
