/**
 * generate-icons.js
 * Converts assets/icon.svg → build/icon.png (512px)
 * electron-builder then auto-generates .ico (Windows) and .icns (macOS) from it.
 * Also emits build/icon-32.png for use as tray icon reference.
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
  const rendered = resvg.render()
  const png = rendered.asPng()
  fs.writeFileSync(path.join(BUILD, outFile), png)
  console.log(`  ✓  build/${outFile}  (${size}×${size})`)
}

console.log('\n⬡  Generating Overdesk icons…\n')
render(512, 'icon.png')    // app icon — electron-builder uses this for ICO + ICNS
render(32,  'icon-32.png') // tray source (nativeImage resizes at runtime)
console.log('\n   Done.\n')
