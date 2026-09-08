import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const table = Array.from({ length: 256 }, (_, i) => { let n = i; for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
const crc = bytes => { let n = 0xffffffff; for (const b of bytes) n = table[(n ^ b) & 255] ^ (n >>> 8); return (n ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const size = Buffer.alloc(4); size.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(body)); return Buffer.concat([size, body, checksum]); }
function png(size, maskable) {
  const data = Buffer.alloc((size * 4 + 1) * size), scale = size / 64;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / scale, py = y / scale, zoom = maskable ? .82 : 1;
    const dx = (px - 32) / zoom, dy = (py - 32) / zoom;
    const radius = Math.hypot(dx, dy);
    const mark = radius > 15 && radius < 20 && !(dx > 9 && Math.abs(dy) < 13);
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    const color = mark ? [41, 41, 41] : [251, 251, 251];
    data.set([...color, 255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync('public/icons', { recursive: true });
for (const size of [180, 192, 512]) writeFileSync(`public/icons/icon-${size}.png`, png(size, false));
writeFileSync('public/icons/icon-512-maskable.png', png(512, true));
console.log('Clearance icons generated.');
