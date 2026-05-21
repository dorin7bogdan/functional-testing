import { randomBytes, createCipheriv, createHmac } from 'crypto';

export default class Encrypter {
  private readonly _keyBase64: string;

  constructor() {
    // 64 bytes -> 32 AES + 32 HMAC
    this._keyBase64 = randomBytes(64).toString('base64');
  }

  /** Key to send via stdin or env */
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
