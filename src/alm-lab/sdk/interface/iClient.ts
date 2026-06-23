import Credentials from '../credentials.js';
import Response, { WebHeaders } from '../response.js';
import { ResxAccessLevel } from '../resxAccessLevel.js';

export default interface IClient {
  httpGet(
    url: string,
    headers?: WebHeaders,
    resxAccessLevel?: ResxAccessLevel,
    query?: string
  ): Promise<Response>;

  httpPost(
    url: string,
    headers?: WebHeaders,
    body?: string,
    resxAccessLevel?: ResxAccessLevel
  ): Promise<Response>;

  httpPut(
    url: string,
    headers?: WebHeaders,
    body?: string,
    resxAccessLevel?: ResxAccessLevel
  ): Promise<Response>;

  buildRestEndpoint(suffix: string): string;
  buildWebUIEndpoint(suffix: string): string;

  readonly serverUrl: string;
  readonly credentials: Credentials;
  readonly xsrfTokenValue: string;
}
