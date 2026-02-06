/**
 * Courier Icon Generator
 *
 * Generates all Tauri-required icon sizes from the SVG source.
 * Uses sharp for high-quality SVG -> PNG conversion.
 *
 * Usage:
 *   node docs/brand/generate-icons.mjs
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const iconsDir = join(projectRoot, 'src-tauri', 'icons');
const brandDir = __dirname;

// Read the SVG source
const svgPath = join(brandDir, 'icon-simple.svg');
const svgBuffer = readFileSync(svgPath);

// Tauri v2 required icon sizes
const tauriIcons = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  // Windows Store logos
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

// Additional brand sizes
const brandIcons = [
  { name: 'icon-16.png', size: 16 },
  { name: 'icon-24.png', size: 24 },
  { name: 'icon-48.png', size: 48 },
  { name: 'icon-64.png', size: 64 },
  { name: 'icon-96.png', size: 96 },
  { name: 'icon-256.png', size: 256 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-1024.png', size: 1024 },
];

async function generatePng(svgBuf, size, outputPath) {
  await sharp(svgBuf, { density: Math.max(72, Math.round(72 * (size / 512) * 2)) })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function generateIco(svgBuf, outputPath) {
  // Generate ICO with multiple sizes embedded (16, 32, 48, 256)
  // sharp doesn't directly output ICO, so we'll create a 256x256 PNG
  // and use it. For a proper ICO, we generate the largest size.
  // Tauri's build process handles ICO generation from PNG, but we'll
  // provide the best quality 256x256 source.
  const sizes = [16, 32, 48, 256];
  const buffers = await Promise.all(
    sizes.map(size =>
      sharp(svgBuf, { density: Math.max(72, Math.round(72 * (size / 512) * 4)) })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .png()
        .toBuffer()
    )
  );

  // ICO file format
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = buffers.length;
  let offset = headerSize + dirEntrySize * numImages;

  // ICO header
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);         // reserved
  header.writeUInt16LE(1, 2);         // type: ICO
  header.writeUInt16LE(numImages, 4); // count

  // Directory entries
  const dirEntries = Buffer.alloc(dirEntrySize * numImages);
  for (let i = 0; i < numImages; i++) {
    const size = sizes[i];
    const off = dirEntrySize * i;
    dirEntries.writeUInt8(size === 256 ? 0 : size, off);     // width (0 = 256)
    dirEntries.writeUInt8(size === 256 ? 0 : size, off + 1); // height
    dirEntries.writeUInt8(0, off + 2);                         // color palette
    dirEntries.writeUInt8(0, off + 3);                         // reserved
    dirEntries.writeUInt16LE(1, off + 4);                      // color planes
    dirEntries.writeUInt16LE(32, off + 6);                     // bits per pixel
    dirEntries.writeUInt32LE(buffers[i].length, off + 8);      // size of image data
    dirEntries.writeUInt32LE(offset, off + 12);                // offset to image data
    offset += buffers[i].length;
  }

  const ico = Buffer.concat([header, dirEntries, ...buffers]);
  const { writeFileSync } = await import('fs');
  writeFileSync(outputPath, ico);
}

async function generateIcns(svgBuf, outputPath) {
  // Generate a high-res PNG for ICNS (macOS). Tauri's build handles
  // the actual ICNS packaging, but we provide the 512x512 and 1024x1024 source.
  // For a basic ICNS, we embed a 512x512 PNG in the ic09 chunk.
  const png512 = await sharp(svgBuf, { density: 144 })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();

  const png256 = await sharp(svgBuf, { density: 72 })
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();

  // ICNS format: magic + size, then type entries
  // ic08 = 256x256 PNG, ic09 = 512x512 PNG
  const ic08Type = Buffer.from('ic08');
  const ic08Size = Buffer.alloc(4);
  ic08Size.writeUInt32BE(8 + png256.length);

  const ic09Type = Buffer.from('ic09');
  const ic09Size = Buffer.alloc(4);
  ic09Size.writeUInt32BE(8 + png512.length);

  const totalSize = 8 + (8 + png256.length) + (8 + png512.length);
  const header = Buffer.from('icns');
  const fileSize = Buffer.alloc(4);
  fileSize.writeUInt32BE(totalSize);

  const icns = Buffer.concat([
    header, fileSize,
    ic08Type, ic08Size, png256,
    ic09Type, ic09Size, png512,
  ]);

  const { writeFileSync } = await import('fs');
  writeFileSync(outputPath, icns);
}

async function main() {
  console.log('');
  console.log('============================================');
  console.log('  Courier Icon Generator');
  console.log('============================================');
  console.log('');
  console.log(`  Source:  ${svgPath}`);
  console.log(`  Output:  ${iconsDir}`);
  console.log(`  Brand:   ${brandDir}`);
  console.log('');

  // Ensure directories exist
  if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

  // Generate Tauri icons
  console.log('  Generating Tauri icons...');
  for (const icon of tauriIcons) {
    const outPath = join(iconsDir, icon.name);
    await generatePng(svgBuffer, icon.size, outPath);
    console.log(`    + ${icon.name} (${icon.size}x${icon.size})`);
  }

  // Generate ICO
  console.log('  Generating icon.ico...');
  await generateIco(svgBuffer, join(iconsDir, 'icon.ico'));
  console.log('    + icon.ico (16, 32, 48, 256)');

  // Generate ICNS
  console.log('  Generating icon.icns...');
  await generateIcns(svgBuffer, join(iconsDir, 'icon.icns'));
  console.log('    + icon.icns (256, 512)');

  // Generate brand icons
  console.log('  Generating brand icons...');
  for (const icon of brandIcons) {
    const outPath = join(brandDir, icon.name);
    await generatePng(svgBuffer, icon.size, outPath);
    console.log(`    + ${icon.name} (${icon.size}x${icon.size})`);
  }

  console.log('');
  console.log('============================================');
  console.log('  Done! All icons generated.');
  console.log('============================================');
  console.log('');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
