import { toPrismaBytes } from './prisma-bytes';

describe('toPrismaBytes', () => {
  it('copies binary content into an ArrayBuffer-backed Uint8Array', () => {
    const source = Buffer.from([0, 17, 128, 255]);
    const result = toPrismaBytes(source);

    expect(Array.from(result)).toEqual([0, 17, 128, 255]);
    expect(result).not.toBe(source);
    expect(result.buffer).toBeInstanceOf(ArrayBuffer);
  });
});
