import IClient from './iClient.js';

export default interface IAuthenticator {
  login(client: IClient): Promise<boolean>;
  logout(client: IClient): Promise<boolean>;
}
