import Logger from '../../../utils/logger.js';
import { Constants } from '../util/constants.js';
import { WebHeaders } from '../response/response.js';
import IAuthenticator from '../interface/iAuthenticator.js';
import IClient from '../interface/iClient.js';

const APIKEY_LOGIN_API = 'rest/oauth2/login';
const ALM_CLIENT_TYPE = 'ALM-CLIENT-TYPE';
const logger = new Logger('ApiKeyAuthenticator');

const appendSuffix = (base: string, suffix: string): string => {
  const normalizedBase = base.replace(/[\\/]+$/, '');
  const normalizedSuffix = suffix.replace(/^[\\/]+/, '');
  return `${normalizedBase}/${normalizedSuffix}`;
};

export default class ApiKeyAuthenticator implements IAuthenticator {
  public async login(client: IClient): Promise<boolean> {
    const clientId = client.credentials.usernameOrClientId;
    const secret = client.credentials.passwordOrSecret;
    const body = JSON.stringify({ clientId, secret });
    const headers: WebHeaders = {
      [ALM_CLIENT_TYPE]: "",
      'Content-Type': Constants.APP_JSON,
      Accept: Constants.APP_JSON
    };

    logger.info('Start login to ALM server with APIkey...');

    const res = await client.httpPost(appendSuffix(client.serverUrl, APIKEY_LOGIN_API), headers, body);
    const ok = res.isOK;
    logger.info(
      ok
        ? `Logged in successfully to ALM Server ${client.serverUrl}`
        : `Login to ALM Server at ${client.serverUrl} failed. Status Code: [${res.statusCode}]`
    );
    return ok;
  }

  public async logout(_client: IClient): Promise<boolean> {
    return await Promise.resolve(true);
  }
}
