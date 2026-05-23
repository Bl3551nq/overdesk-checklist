/**
 * generate-icons.js
 * SVG (portrait 2160×2682) → square PNGs with the logo centred and padded.
 * electron-builder converts build/icon.png (512px) into:
 *   Windows → .ico  (16 / 32 / 48 / 64 / 128 / 256px frames)
 *   macOS   → .icns (all required sizes)
 */

const { Resvg } = require('@resvg/resvg-js')
const fs        = require('fs')
const path      = require('path')

const ASSETS = path.join(__dirname, '..', 'assets')
const BUILD  = path.join(__dirname, '..', 'build')
fs.mkdirSync(BUILD, { recursive: true })

const svgData   = fs.readFileSync(path.join(ASSETS, 'icon.svg'))
const svgBase64 = svgData.toString('base64')

// SVG natural dimensions
const SVG_W = 2160
const SVG_H = 2682
const ASPECT = SVG_W / SVG_H   // ≈ 0.806 (portrait)

/**
 * Render the SVG centred in a square canvas of `size` px.
 * padPct = fraction of size used as padding on each side (default 10%).
 */
function renderSquare(size, outFile, padPct = 0.10) {
  const logoW  = Math.round(size * (1 - padPct * 2))
  const logoH  = Math.round(logoW / ASPECT)
  const offsetX = Math.round((size - logoW) / 2)
  const offsetY = Math.round((size - logoH) / 2)

  // Embed original SVG as base64 image inside a square wrapper SVG
  const wrapper = `<svg xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <image href="data:image/svg+xml;base64,${svgBase64}"
      x="${offsetX}" y="${offsetY}"
      width="${logoW}" height="${logoH}"/>
  </svg>`

  const resvg = new Resvg(Buffer.from(wrapper), {
    fitTo: { mode: 'width', value: size },
    background: 'transparent',
  })
  const png = resvg.render().asPng()
  fs.writeFileSync(path.join(BUILD, outFile), png)
  console.log(`  ✓  build/${outFile}  (${size}×${size})`)
}

console.log('\n⬡  Generating Overdesk icons…\n')
renderSquare(512, 'icon.png')       // → .ico + .icns master
renderSquare(256, 'icon-256.png')   // Windows hi-DPI taskbar
renderSquare(32,  'icon-32.png')    // tray icon
renderSquare(16,  'icon-16.png')    // tray small
console.log('\n   Done.\n')
