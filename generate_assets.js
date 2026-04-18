// Tiny script to generate placeholder PNG assets for Flappy Bird
// Uses raw PNG encoding (no dependencies)

const fs = require('fs');
const path = require('path');

function createPNG(width, height, pixelCallback) {
    // Minimal PNG encoder
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    function crc32(buf) {
        let c = 0xFFFFFFFF;
        const table = [];
        for (let n = 0; n < 256; n++) {
            let v = n;
            for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
            table[n] = v;
        }
        for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function chunk(type, data) {
        const typeBuf = Buffer.from(type);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const crcData = Buffer.concat([typeBuf, data]);
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crc32(crcData));
        return Buffer.concat([len, typeBuf, data, crcBuf]);
    }

    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    // Raw image data (filter byte + RGBA per pixel per row)
    const raw = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        raw[y * (1 + width * 4)] = 0; // no filter
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = pixelCallback(x, y, width, height);
            const offset = y * (1 + width * 4) + 1 + x * 4;
            raw[offset] = r;
            raw[offset + 1] = g;
            raw[offset + 2] = b;
            raw[offset + 3] = a;
        }
    }

    // Compress with zlib
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(raw);

    const iend = Buffer.alloc(0);

    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', iend)
    ]);
}

const assetsDir = path.join(__dirname, 'assets');

// Bird: 34x24 yellow circle-ish bird
const bird = createPNG(34, 24, (x, y, w, h) => {
    const cx = w / 2, cy = h / 2;
    const rx = w / 2 - 1, ry = h / 2 - 1;
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const dist = dx * dx + dy * dy;
    if (dist > 1) return [0, 0, 0, 0];
    // Eye
    if ((x - 22) ** 2 + (y - 8) ** 2 < 9) return [0, 0, 0, 255];
    if ((x - 22) ** 2 + (y - 7) ** 2 < 4) return [255, 255, 255, 255];
    // Beak
    if (x > 24 && y > 10 && y < 18 && x < 34) return [255, 140, 0, 255];
    // Body
    return [255, 220, 50, 255];
});
fs.writeFileSync(path.join(assetsDir, 'bird.png'), bird);

// Pipe: 52x320 green rectangle
const pipe = createPNG(52, 320, (x, y, w, h) => {
    // Darker edges
    if (x < 3 || x >= w - 3) return [50, 130, 50, 255];
    // Highlight stripe
    if (x > 8 && x < 14) return [120, 220, 120, 255];
    return [80, 180, 80, 255];
});
fs.writeFileSync(path.join(assetsDir, 'pipe.png'), pipe);

// Ground: 336x112 brown/green strip
const ground = createPNG(336, 112, (x, y, w, h) => {
    if (y < 15) return [100, 200, 80, 255]; // grass
    if (y < 20) return [80, 160, 60, 255]; // grass shadow
    // Sandy ground with texture
    const shade = ((x + y * 3) % 7 < 2) ? 20 : 0;
    return [210 - shade, 180 - shade, 120 - shade, 255];
});
fs.writeFileSync(path.join(assetsDir, 'ground.png'), ground);

// Background: 288x512 sky gradient
const bg = createPNG(288, 512, (x, y, w, h) => {
    const t = y / h;
    // Sky blue gradient
    const r = Math.round(78 + t * 60);
    const g = Math.round(192 + t * 30);
    const b = Math.round(220 + t * 20);
    // Simple clouds
    const cloudY1 = 80, cloudY2 = 150;
    if (Math.abs(y - cloudY1) < 20 && Math.sin(x * 0.05) > 0.3) return [255, 255, 255, 200];
    if (Math.abs(y - cloudY2) < 15 && Math.cos(x * 0.04 + 1) > 0.2) return [255, 255, 255, 180];
    return [r, g, Math.min(b, 255), 255];
});
fs.writeFileSync(path.join(assetsDir, 'bg.png'), bg);

console.log('Assets generated in assets/');
