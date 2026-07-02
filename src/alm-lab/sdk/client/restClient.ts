import { randomUUID, createHash } from 'crypto';
import { Constants } from '../util/constants.js';
import Credentials from '../util/credentials.js';
import Response, { WebHeaders } from '../response/response.js';
import { ResxAccessLevel, resxAccessHeaderName } from '../util/resxAccessLevel.js';
import IClient from '../interface/iClient.js';
import Logger from '../../../utils/logger.js';

const logger = new Logger('RestClient');
const SET_COOKIE = 'set-cookie';
const XSRF_TOKEN = 'XSRF-TOKEN';

const appendSuffix = (base: string, suffix: string): string => {
  const normalizedBase = base.replace(/[\\/]+$/, '');
  const normalizedSuffix = suffix.replace(/^[\\/]+/, '');
  return `${normalizedBase}/${normalizedSuffix}`;
};

const md5 = (value: string): string => {
  return createHash('md5').update(value, 'utf8').digest('hex').toUpperCase();
};

const headersToObject = (headers: Headers): WebHeaders => {
  const values: WebHeaders = {};
  headers.forEach((v, k) => {
    values[k] = v;
  });
  return values;
};

export default class RestClient implements IClient {
  private readonly cookies: Map<string, string> = new Map();
  private readonly restPrefix: string;
  private readonly webUiPrefix: string;
  public readonly xsrfTokenValue: string;

  constructor(
    public readonly serverUrl: string,
    public readonly credentials: Credentials,
    private readonly domain: string,
    private readonly project: string
  ) {
    logger.debug(`RestClient ctor: "${serverUrl}", domain: "${domain}", project: "${project}"`);
    this.restPrefix = appendSuffix(this.serverUrl, `rest/domains/${this.domain}/projects/${this.project}`);
    this.webUiPrefix = appendSuffix(this.serverUrl, `webui/alm/${this.domain}/${this.project}`);

    this.xsrfTokenValue = randomUUID();
    this.cookies.set(XSRF_TOKEN, this.xsrfTokenValue);
  }

  public buildRestEndpoint(suffix: string): string {
    return appendSuffix(this.restPrefix, suffix);
  }

  public buildWebUIEndpoint(suffix: string): string {
    return appendSuffix(this.webUiPrefix, suffix);
  }

  public async httpGet(url: string, headers?: WebHeaders,
    resxAccessLevel: ResxAccessLevel = ResxAccessLevel.PUBLIC,
    query = ''): Promise<Response> {
    try {
      if (query.trim().length > 0) {
        url += `?${query}`;
      }
      logger.debug(`GET ${url}`);
      const reqHeaders = this.decorateRequestHeaders(headers, resxAccessLevel);
      //logger.debug(`HEADERS: ${JSON.stringify(headersToObject(reqHeaders))}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: reqHeaders
      });
      this.updateCookies(response.headers);
      const data = await response.text();
      logger.debug(`RESPONSE: ${data}`);

      if (!response.ok) {
        const err = data || response.statusText || `HTTP ${response.status}`;
        logger.error(err);
        return new Response({ error: err, statusCode: response.status, headers: headersToObject(response.headers) });
      }

      return new Response({ data, headers: headersToObject(response.headers), statusCode: response.status });
    } catch (error: any) {
      const err = error?.message ?? `${error}`;
      return new Response({ error: err });
    }
  }

  public async httpPost(url: string, headers?: WebHeaders, body?: string,
                        resxAccessLevel: ResxAccessLevel = ResxAccessLevel.PUBLIC): Promise<Response> {
    try {
      logger.debug(`POST ${url}`);
      const hdrs = this.decorateRequestHeaders(headers, resxAccessLevel);
      //logger.debug(`HEADERS: ${JSON.stringify(headersToObject(hdrs))}`);
      logger.debug(`BODY: ${body}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: hdrs,
        body: body ?? ''
      });
      this.updateCookies(response.headers);
      const data = await response.text();
      logger.debug(`RESPONSE: ${data}`);
      if (!response.ok) {
        const err = data || response.statusText || `HTTP ${response.status}`;
        logger.error(err);
        return new Response({ error: err, statusCode: response.status, headers: headersToObject(response.headers) });
      }

      return new Response({ data, headers: headersToObject(response.headers), statusCode: response.status });
    } catch (error: any) {
      const err = error?.message ?? `${error}`;
      logger.error(err);
      return new Response({ error: err });
    }
  }

  public async httpPut(
    url: string,
    headers?: WebHeaders,
    body?: string,
    resxAccessLevel: ResxAccessLevel = ResxAccessLevel.PUBLIC
  ): Promise<Response> {
    return await Promise.resolve(new Response());
  }

  private decorateRequestHeaders(headers: WebHeaders | undefined, resxAccessLevel: ResxAccessLevel): Headers {
    const reqHeaders = new Headers(headers);
    const accessHeader = resxAccessHeaderName(resxAccessLevel);
    if (accessHeader) {
      reqHeaders.set(accessHeader, md5(this.credentials.usernameOrClientId));
    }

    const cookieText = this.getCookiesAsString();
    if (cookieText.length > 0) {
      reqHeaders.set('Cookie', cookieText);
    }
    return reqHeaders;
  }

  private getCookiesAsString(): string {
    return Array.from(this.cookies.entries())
      .map(([key, val]) => `${key}${Constants.EQUAL}${val}${Constants.SEMICOLON}`)
      .join('');
  }

  private updateCookies(headers: Headers): void {
    const maybeHeaders = headers as Headers & { getSetCookie?: () => string[] };
    const rawCookies = typeof maybeHeaders.getSetCookie === 'function'
      ? maybeHeaders.getSetCookie()
      : this.splitSetCookieHeader(headers.get(SET_COOKIE));

    for (const cookie of rawCookies) {
      const firstPart = cookie.split(';', 1)[0];
      const equalIdx = firstPart.indexOf(Constants.EQUAL);
      if (equalIdx <= 0) {
        continue;
      }
      const key = firstPart.substring(0, equalIdx).trim();
      const val = firstPart.substring(equalIdx + 1).trim();
      if (key) {
        this.cookies.set(key, val);
      }
    }
  }

  private splitSetCookieHeader(headerValue: string | null): string[] {
    if (!headerValue) {
      return [];
    }
    return headerValue.split(/,(?=\s*[^;=]+=[^;]+)/);
  }
}
