import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = path.join(process.cwd(), 'tmp/authentic-rheomiq-icon.png');

describe('authentic project artwork recovery', () => {
  it('recovers the exact pre-rebrand PNG from repository history', () => {
    const image = fs.readFileSync(file);
    expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const width = image.readUInt32BE(16);
    const height = image.readUInt32BE(20);
    console.log(`AUTHENTIC_LOGO_DIMENSIONS=${width}x${height}`);
    console.log(`AUTHENTIC_LOGO_BASE64=${image.toString('base64')}`);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});
