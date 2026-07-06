import Logger from '../../../utils/logger.js';
import { Constants } from '../util/constants.js';
import { WebHeaders } from '../response/response.js';
import IAuthenticator from '../interface/iAuthenticator.js';
import IClient from '../interface/iClient.js';

const USERNAME = 'Username';
const IS_AUTH_ENDPOINT = 'rest/is-authenticated';
const AUTH_ENDPOINT = 'authentication-point/authenticate';
const LOGOUT_ENDPOINT = 'authentication-point/logout';
const SESSION_ENDPOINT = 'rest/site-session';
const LOGGED_OUT_SUCCESSFULLY = 'Logged Out Successfully.';
const CHECK_IF_AUTHENTICATED = 'Check if is authenticated ...';
const logger = new Logger('RestAuthenticator');

const appendSuffix = (base: string, suffix: string): string => {
  const normalizedBase = base.replace(/[\\/]+$/, '');
  const normalizedSuffix = suffix.replace(/^[\\/]+/, '');
  return `${normalizedBase}/${normalizedSuffix}`;
};

const getTagValue = (json: string, tagName: string): string | undefined => {
  try {
    const obj = JSON.parse(json);
    return obj[tagName]?.toString();
  } catch {
    return undefined;
  }
};

export default class RestAuthenticator implements IAuthenticator {
  public async login(client: IClient): Promise<boolean> {
    const username = client.credentials.usernameOrClientId;
    const password = client.credentials.passwordOrSecret;

    try {
      const isAuthenticated = await this.isAuthenticated(client, username);
      if (isAuthenticated) {
        return true;
      }

      let ok = await this.authenticate(client, username, password);
      if (ok) {
        ok = await this.appendQCSessionCookies(client);
      }
      return ok;
    } catch (error: any) {
      logger.error(error?.message ?? `${error}`);
      return false;
    }
  }

  public async logout(client: IClient): Promise<boolean> {
    let isLoggedOut = false;
    if (client) {
      const response = await client.httpGet(appendSuffix(client.serverUrl, LOGOUT_ENDPOINT));
      isLoggedOut = response.isOK;
      if (isLoggedOut) {
        logger.info(LOGGED_OUT_SUCCESSFULLY);
      }
    }
    return isLoggedOut;
  }

  private async appendQCSessionCookies(client: IClient): Promise<boolean> {
    logger.info('Creating session...');
    const headers: WebHeaders = {
      'Content-Type': Constants.APP_JSON,
      Accept: Constants.APP_JSON
    };

    const res = await client.httpPost(
      appendSuffix(client.serverUrl, SESSION_ENDPOINT),
      headers,
      "{session-parameters: {client-type: \"\"}}"
    );
    const ok = res.isOK;
    logger.info(ok ? 'Session created.' : `Cannot append QCSession cookies. Error: ${res.error}`);
    return ok;
  }

  private async authenticate(client: IClient, username: string, password: string): Promise<boolean> {
    const headers: WebHeaders = {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`, 'ascii').toString('base64')}`
    };
    const response = await client.httpGet(appendSuffix(client.serverUrl, AUTH_ENDPOINT), headers);

    const ok = response.isOK;
    logger.info(
      ok
        ? `Logged in successfully to ALM Server ${client.serverUrl}`
        : `Login to ALM Server at ${client.serverUrl} failed. Status Code: ${response.statusCode}`
    );
    return ok;
  }

  private async isAuthenticated(client: IClient, username: string): Promise<boolean> {
    let ok = false;
    logger.info(CHECK_IF_AUTHENTICATED);
    const url = appendSuffix(client.serverUrl, IS_AUTH_ENDPOINT);
    const res = await client.httpGet(url, { Accept: Constants.APP_JSON });

    if (res.isOK) {
      const json = res.data ?? '';
      logger.debug(json);
      try {
        const uname = getTagValue(json, USERNAME);
        if (uname === username) {
          ok = true;
        } else {
          logger.error(`Username mismatch: Expected: ${username}, Received: ${uname ?? ''}`);
        }
      } catch (error: any) {
        logger.error(error?.message ?? `${error}`);
      }
      logger.info(`Is Authenticated = ${ok}`);
    }
    return ok;
  }
}
