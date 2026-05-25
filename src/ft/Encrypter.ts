import { randomBytes, createCipheriv, createHmac } from 'crypto';

/** Single-use: create once, encrypt all values, pass key to launcher, then discard it. */
export default class Encrypter {
  private readonly _keyBase64: string;

  constructor() {
    // 64 bytes -> 32 AES + 32 HMAC
    this._keyBase64 = randomBytes(64).toString('base64');
  }

  /** 
   * The full 64-byte base64 key (32 AES + 32 HMAC).
   * Treat as a secret — pass to the launcher once via stdin, then discard.
   * Never log this value.
   */
  public get key(): string {
    return this._keyBase64;
  }

  public encrypt(text: string): string {
    const key = Buffer.from(this._keyBase64, 'base64');

    const aesKey = key.subarray(0, 32);
    const hmacKey = key.subarray(32);

    const iv = randomBytes(16);

    const cipher = createCipheriv('aes-256-cbc', aesKey, iv);

    const ciphertext = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);

    const data = Buffer.concat([iv, ciphertext]);

    const hmac = createHmac('sha256', hmacKey)
      .update(data)
      .digest();

    return Buffer.concat([data, hmac]).toString('base64');
  }
}
