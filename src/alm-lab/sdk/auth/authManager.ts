import IClient from '../interface/iClient.js';
import IAuthenticator from '../interface/iAuthenticator.js';
import ApiKeyAuthenticator from './apiKeyAuthenticator.js';
import RestAuthenticator from './restAuthenticator.js';

export default class AuthManager {
  private readonly restAuthenticator: IAuthenticator;
  private readonly apiKeyAuthenticator: IAuthenticator;

  private constructor() {
    this.restAuthenticator = new RestAuthenticator();
    this.apiKeyAuthenticator = new ApiKeyAuthenticator();
  }

  public static readonly instance: AuthManager = new AuthManager();

  public async authenticate(client: IClient): Promise<boolean> {
    const auth = client.credentials.isSSO ? this.apiKeyAuthenticator : this.restAuthenticator;
    return await auth.login(client);
  }

  public async logout(client: IClient): Promise<void> {
    const auth = client.credentials.isSSO ? this.apiKeyAuthenticator : this.restAuthenticator;
    await auth.logout(client);
  }
}
