import sharp from 'sharp'

function makeSvg(size) {
  const fontSize = Math.round(size * 0.32)
  const letterSpacing = Math.round(size * 0.04)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="#1a3a5c"/>
  <text
    x="50%" y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-size="${fontSize}"
    font-weight="bold"
    letter-spacing="${letterSpacing}"
    fill="#ffffff"
  >KH</text>
</svg>`
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(makeSvg(size)))
    .png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ icon-${size}.png`)
}
