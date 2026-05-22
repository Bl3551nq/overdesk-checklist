/**
 * generate-icons.js
 * Converts assets/icon.svg → PNGs in build/
 *
 * The SVG is portrait (2160×2682). We render it to a square canvas
 * with slight padding so the logo fills the taskbar/dock icon properly.
 *
 * electron-builder reads build/icon.png (512px) and auto-generates:
 *   - .ico  (Windows) with embedded 16/24/32/48/64/128/256px frames
 *   - .icns (macOS)   with all required sizes
 */

const { Resvg } = require('@resvg/resvg-js')
const fs   = require('fs')
const path = require('path')

const ASSETS = path.join(__dirname, '..', 'assets')
const BUILD  = path.join(__dirname, '..', 'build')

fs.mkdirSync(BUILD, { recursive: true })

const svgBuffer = fs.readFileSync(path.join(ASSETS, 'icon.svg'))

/**
 * Render SVG to a square PNG at given size.
 * We render at height=size so the portrait SVG fills vertically,
 * giving a naturally centred logo.
 */
function render(size, outFile) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: { mode: 'height', value: size },
    background: 'transparent',
  })
  const rendered = resvg.render()
  const png = rendered.asPng()
  fs.writeFileSync(path.join(BUILD, outFile), png)
  const w = rendered.width, hh = rendered.height
  console.log(`  ✓  build/${outFile}  (${w}×${hh} → target ${size}px)`)
}

console.log('\n⬡  Generating Overdesk icons…\n')
render(512, 'icon.png')      // → .ico and .icns source
render(256, 'icon-256.png')  // Windows taskbar hi-DPI
render(32,  'icon-32.png')   // tray source
render(16,  'icon-16.png')   // tray fallback
console.log('\n   Done.\n')
