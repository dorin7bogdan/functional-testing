export default class Credentials {
  constructor(
    public readonly isSSO: boolean,
    public readonly usernameOrClientId: string,
    public readonly passwordOrSecret: string) {
    if (!usernameOrClientId?.trim()) {
      throw new Error('Missing username / clientId.');
    }
    if (isSSO && !passwordOrSecret?.trim()) {
      throw new Error('Missing Api Key Secret.');
    }
  }
}
