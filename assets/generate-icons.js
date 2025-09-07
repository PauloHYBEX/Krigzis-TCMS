/*
  Icon generator: generate PNGs from SVG using sharp (if available), then build ICO via png-to-ico.
  Base SVG: assets/icon.svg

  Run: node assets/generate-icons.js
*/
const fs = require('fs');
const path = require('path');

async function ensurePngsFromSvg(baseSvg, outDir) {
  const fs = require('fs');
  // Prefer resvg (no native deps)
  try {
    const { Resvg } = require('@resvg/resvg-js');
    const svg = fs.readFileSync(baseSvg);
    const outputs = [
      { size: 256, out: path.join(outDir, 'icon-256.png') },
      { size: 512, out: path.join(outDir, 'icon-512.png') }
    ];
    for (const o of outputs) {
      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: o.size } });
      const pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      fs.writeFileSync(o.out, pngBuffer);
      console.log('[icons] wrote', o.out, pngBuffer.slice(0,8).toString('hex'));
    }
    // Also replace legacy names to ensure consistency
    fs.copyFileSync(path.join(outDir, 'icon-256.png'), path.join(outDir, 'icon.png'));
    fs.copyFileSync(path.join(outDir, 'icon-512.png'), path.join(outDir, 'icon@2x.png'));
    return true;
  } catch (e) {
    console.warn('[icons] Failed to rasterize SVG with resvg:', e?.message || e);
  }
  return false;
}

async function main() {
  let pngToIco;
  try {
    pngToIco = require('png-to-ico');
  } catch {
    console.error('Missing dependency: png-to-ico. Install with: npm i -D png-to-ico');
    process.exit(1);
  }

  const outDir = path.resolve(__dirname);
  const baseSvg = path.join(outDir, 'icon.svg');

  // Sempre tente regenerar PNGs a partir do SVG para garantir arquivos válidos
  if (fs.existsSync(baseSvg)) {
    await ensurePngsFromSvg(baseSvg, outDir);
  }

  const inputs = [path.join(outDir, 'icon-256.png')];
  if (fs.existsSync(path.join(outDir, 'icon-512.png'))) inputs.push(path.join(outDir, 'icon-512.png'));
  for (const p of inputs) {
    if (!fs.existsSync(p)) {
      console.error('[icons] Required PNG missing:', p);
      process.exit(1);
    }
  }
  const icoBuffer = await pngToIco(inputs);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), icoBuffer);
  console.log('[icons] ICO generated at', path.join(outDir, 'icon.ico'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



