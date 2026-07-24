/**
 * Creates an owned ArrayBuffer-backed byte array for Prisma `Bytes` fields.
 *
 * Node.js `Buffer` may be typed with `ArrayBufferLike`, while Prisma's generated
 * create input expects a plain Uint8Array. Copying at the persistence boundary
 * keeps the image pipeline Buffer-based and gives Prisma the exact binary type
 * it owns and stores.
 */
export function toPrismaBytes(content: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(content);
}
