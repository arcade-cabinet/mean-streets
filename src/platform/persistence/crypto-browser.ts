function getCrypto(): Crypto {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return globalThis.crypto;
  }
  throw new Error('Browser crypto shim requires globalThis.crypto.getRandomValues');
}

export function randomFillSync<T extends ArrayBufferView>(array: T): T {
  getCrypto().getRandomValues(array as unknown as Uint8Array<ArrayBuffer>);
  return array;
}

export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

export default {
  randomBytes,
  randomFillSync,
};
