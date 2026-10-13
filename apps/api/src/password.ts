export function fitsBcrypt(value: string): boolean {
  return Buffer.byteLength(value, 'utf8') <= 72;
}
