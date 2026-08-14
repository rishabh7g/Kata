#!/usr/bin/env node
// Regenerates the manifest's raster app icons into public/icons/.
//
//   node scripts/generate-icons.mjs
//
// The Kata mark (design/assets/kata-mark.svg) is three axis-aligned squares on
// the ground colour from design/tokens.json — both are read here, so the icons
// stay derived from the design package instead of restating its geometry or its
// hexes. Squares on integer coordinates need no antialiasing, so the PNGs are
// written directly (zlib + CRC32, no dependency and no rasterizer on the host);
// the output is deterministic, which keeps a re-run out of the diff.
//
// `any` icons are the mark full-bleed. The maskable icon draws the same mark at
// MASKABLE_SCALE so every pixel of it sits inside the 80%-diameter safe circle
// a platform mask may crop to (design/README.md § Assets).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const markPath = join(repoRoot, 'design/assets/kata-mark.svg');
const tokensPath = join(repoRoot, 'design/tokens.json');
const iconsDir = join(repoRoot, 'public/icons');

const MASKABLE_SCALE = 0.6;

const ICONS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: MASKABLE_SCALE },
  { file: 'apple-touch-icon-180.png', size: 180, scale: 1 },
  { file: 'favicon-32.png', size: 32, scale: 1 },
];

/** Reads the mark's viewBox and its solid rects. */
function readMark(svg) {
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg);
  if (viewBox === null) throw new Error('kata-mark.svg has no viewBox');
  const [minX, minY, width, height] = viewBox[1].trim().split(/\s+/).map(Number);

  const rects = [...svg.matchAll(/<rect\b[^>]*>/g)].map((match) => {
    const attr = (name) => {
      const found = new RegExp(`${name}="([^"]+)"`).exec(match[0]);
      if (found === null) throw new Error(`<rect> is missing ${name}`);
      return found[1];
    };
    return {
      x: Number(attr('x')),
      y: Number(attr('y')),
      width: Number(attr('width')),
      height: Number(attr('height')),
      fill: attr('fill'),
    };
  });
  if (rects.length === 0) throw new Error('kata-mark.svg has no rects');

  return { minX, minY, width, height, rects };
}

function toRgb(hex) {
  const match = /^#([\da-f]{6})$/i.exec(hex.trim());
  if (match === null) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Paints the mark into a size × size RGB buffer. */
function paint(mark, background, size, scale) {
  const pixels = new Uint8Array(size * size * 3);
  for (let index = 0; index < size * size; index += 1) {
    pixels.set(background, index * 3);
  }

  const unit = (size * scale) / mark.width;
  const inset = (size - size * scale) / 2;

  for (const rect of mark.rects) {
    const colour = toRgb(rect.fill);
    const left = Math.round((rect.x - mark.minX) * unit + inset);
    const top = Math.round((rect.y - mark.minY) * unit + inset);
    const right = Math.round((rect.x - mark.minX + rect.width) * unit + inset);
    const bottom = Math.round((rect.y - mark.minY + rect.height) * unit + inset);

    for (let y = Math.max(0, top); y < Math.min(size, bottom); y += 1) {
      for (let x = Math.max(0, left); x < Math.min(size, right); x += 1) {
        pixels.set(colour, (y * size + x) * 3);
      }
    }
  }

  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

/** Encodes an RGB buffer as an 8-bit truecolour PNG. */
function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour, no alpha
  // bytes 10–12 stay 0: deflate, adaptive filtering, no interlace

  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    // Filter type 0 (none) — flat colour compresses fine without prediction.
    raw[y * (stride + 1)] = 0;
    raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mark = readMark(readFileSync(markPath, 'utf8'));
const background = toRgb(JSON.parse(readFileSync(tokensPath, 'utf8')).color.bg);

mkdirSync(iconsDir, { recursive: true });
for (const icon of ICONS) {
  const png = encodePng(paint(mark, background, icon.size, icon.scale), icon.size);
  writeFileSync(join(iconsDir, icon.file), png);
  const digest = createHash('sha256').update(png).digest('hex').slice(0, 12);
  console.log(`${icon.file}  ${icon.size}px  ${png.length} bytes  sha256:${digest}`);
}
