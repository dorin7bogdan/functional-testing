export type WebHeaders = Record<string, string>;

export default class Response {
  public readonly headers?: WebHeaders;
  public readonly data?: string;
  public readonly error?: string;
  public readonly statusCode?: number;

  constructor(init: Partial<Response> = {}) {
    Object.assign(this, init);
  }

  public get isOK(): boolean {
    return !this.error && [200, 201, 202].includes(this.statusCode ?? 0);
  }

  public toString(): string {
    return this.data ?? '';
  }
}
