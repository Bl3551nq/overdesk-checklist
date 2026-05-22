/**
 * generate-icons.js
 * Converts assets/icon.svg → multiple PNGs in build/
 * electron-builder uses build/icon.png (512px) to auto-generate .ico (Windows)
 * and .icns (macOS) — the .ico embeds 16/32/48/256px frames automatically.
 */

const { Resvg } = require('@resvg/resvg-js')
const fs   = require('fs')
const path = require('path')

const ASSETS = path.join(__dirname, '..', 'assets')
const BUILD  = path.join(__dirname, '..', 'build')

fs.mkdirSync(BUILD, { recursive: true })

const svgBuffer = fs.readFileSync(path.join(ASSETS, 'icon.svg'))

function render(size, outFile) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent',
  })
  const png = resvg.render().asPng()
  fs.writeFileSync(path.join(BUILD, outFile), png)
  console.log(`  ✓  build/${outFile}  (${size}×${size})`)
}

console.log('\n⬡  Generating Overdesk icons…\n')

// 512px — electron-builder's source for ICO (multi-frame) and ICNS
render(512, 'icon.png')

// 256px — Windows taskbar high-DPI
render(256, 'icon-256.png')

// 32px — tray icon source (nativeImage resizes at runtime)
render(32, 'icon-32.png')

// 16px — tray fallback
render(16, 'icon-16.png')

console.log('\n   Done.\n')
