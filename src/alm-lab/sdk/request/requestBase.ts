import Logger from '../../../utils/logger.js';
import { Constants } from '../util/constants.js';
import IClient from '../interface/iClient.js';
import Response, { WebHeaders } from '../response/response.js';

const logger = new Logger('RequestBase');
export default abstract class RequestBase {
  protected static readonly X_XSRF_TOKEN = 'X-XSRF-TOKEN';
  protected static readonly PROC_RUNS = 'procedure-runs';
    
  constructor(protected readonly client: IClient) {}

  public async execute(): Promise<Response> {
    try {
      return await this.perform();
    } catch (error: any) {
      const msg = error?.message ?? `${error}`;
      logger.error(msg);
      return new Response({ error: msg });
    }
  }

  protected abstract perform(): Promise<Response>;

  protected get suffix(): string {
    return '';
  }

  protected get headers(): WebHeaders {
    return {
       [RequestBase.X_XSRF_TOKEN]: this.client.xsrfTokenValue,
       Accept: Constants.APP_JSON
      };
  }

  protected get url(): string {
    return this.client.buildRestEndpoint(this.suffix);
  }
}
