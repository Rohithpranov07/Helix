const sharp = require('sharp');
const fs = require('fs');

async function processImage() {
  const metadata = await sharp('public/img1.png').metadata();
  console.log(`Image dimensions: ${metadata.width}x${metadata.height}`);
  
  const w = metadata.width;
  const h = metadata.height;
  
  // Approximate grid divisions based on visually inspecting the image
  // Gap is roughly 2-3% of width/height
  // The layout:
  // Card 0 (Laptop): x: 0 to ~48%, y: 0 to ~66%
  // Card 1 (Shield): x: ~50% to 100%, y: 0 to ~32%
  // Card 2 (DNA): x: ~50% to ~74%, y: ~34% to ~66%
  // Card 3 (CPU): x: ~76% to 100%, y: ~34% to ~66%
  // Card 4 (N wave): x: 0 to ~48%, y: ~68% to 100%
  // Card 5 (Y shape): x: ~50% to ~74%, y: ~68% to 100%
  // Card 6 (Cube): x: ~76% to 100%, y: ~68% to 100%
  
  const gapX = Math.round(w * 0.02);
  const gapY = Math.round(h * 0.02);
  
  const col1W = Math.round(w * 0.485);
  const col2W = Math.round(w * 0.24);
  const col3W = w - col1W - col2W - 2 * gapX;
  
  const row1H = Math.round(h * 0.32);
  const row2H = Math.round(h * 0.32);
  const row3H = h - row1H - row2H - 2 * gapY;
  
  const regions = [
    { name: 'card0.png', left: 0, top: 0, width: col1W, height: row1H + gapY + row2H },
    { name: 'card1.png', left: col1W + gapX, top: 0, width: w - (col1W + gapX), height: row1H },
    { name: 'card2.png', left: col1W + gapX, top: row1H + gapY, width: col2W, height: row2H },
    { name: 'card3.png', left: col1W + gapX + col2W + gapX, top: row1H + gapY, width: w - (col1W + gapX + col2W + gapX), height: row2H },
    { name: 'card4.png', left: 0, top: row1H + gapY + row2H + gapY, width: col1W, height: row3H },
    { name: 'card5.png', left: col1W + gapX, top: row1H + gapY + row2H + gapY, width: col2W, height: row3H },
    { name: 'card6.png', left: col1W + gapX + col2W + gapX, top: row1H + gapY + row2H + gapY, width: w - (col1W + gapX + col2W + gapX), height: row3H }
  ];
  
  for (const r of regions) {
    await sharp('public/img1.png')
      .extract({ left: r.left, top: r.top, width: r.width, height: r.height })
      .toFile(`public/${r.name}`);
    console.log(`Saved ${r.name}`);
  }
}

processImage().catch(console.error);
