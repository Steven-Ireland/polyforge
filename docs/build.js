import { readdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join, basename } from 'path';

const examplesDir = join(import.meta.dirname, '..', 'examples');
const docsDir = import.meta.dirname;

// Find all .pf files that have a matching .glb
const pfFiles = readdirSync(examplesDir)
  .filter(f => f.endsWith('.pf'))
  .filter(f => readdirSync(examplesDir).includes(f.replace('.pf', '.glb')))
  .sort();

const cards = pfFiles.map(pf => {
  const name = pf.replace('.pf', '');
  const glb = name + '.glb';
  const source = readFileSync(join(examplesDir, pf), 'utf-8').trim();

  // Extract model name from first line: model "Name" {
  const match = source.match(/^model\s+"([^"]+)"/);
  const title = match ? match[1] : name;

  // Copy .glb to docs/
  copyFileSync(join(examplesDir, glb), join(docsDir, glb));

  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div class="card">
      <div class="card-header">
        <h2>${title}</h2>
        <span>${pf}</span>
      </div>
      <model-viewer src="${glb}" auto-rotate camera-controls touch-action="pan-y" shadow-intensity="0.4" environment-image="neutral"></model-viewer>
      <div class="code-panel">
        <pre><code>${escaped}</code></pre>
      </div>
    </div>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PolyForge Examples</title>
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"><\/script>
  <style>
    :root {
      --bg: #0f1117;
      --card: #1a1d27;
      --border: #2a2d3a;
      --text: #e0e0e8;
      --dim: #888899;
      --accent: #7c9bf5;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      text-align: center;
      padding: 3rem 1rem 2rem;
    }
    header h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    header p {
      color: var(--dim);
      margin-top: 0.5rem;
      font-size: 0.95rem;
    }
    header a { color: var(--accent); text-decoration: none; }
    header a:hover { text-decoration: underline; }
    .gallery {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem 4rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(520px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .card-header {
      padding: 1rem 1.25rem 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .card-header h2 { font-size: 1.1rem; font-weight: 600; }
    .card-header span { font-size: 0.8rem; color: var(--dim); }
    model-viewer {
      width: 100%;
      height: 320px;
      background: #13151d;
      --poster-color: transparent;
    }
    .code-panel {
      border-top: 1px solid var(--border);
      max-height: 240px;
      overflow-y: auto;
    }
    .code-panel::-webkit-scrollbar { width: 6px; }
    .code-panel::-webkit-scrollbar-track { background: transparent; }
    .code-panel::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    pre {
      margin: 0;
      padding: 1rem 1.25rem;
      font-size: 0.78rem;
      line-height: 1.5;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      color: #c8ccd8;
    }
    @media (max-width: 560px) {
      .gallery { grid-template-columns: 1fr; }
      model-viewer { height: 260px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>PolyForge Examples</h1>
    <p>Low-poly 3D models defined in the <a href="https://github.com/Steven-Ireland/polyforge">PolyForge DSL</a></p>
  </header>
  <div class="gallery">
${cards}
  </div>
</body>
</html>
`;

writeFileSync(join(docsDir, 'index.html'), html);
console.log(`Built docs with ${pfFiles.length} examples: ${pfFiles.join(', ')}`);
