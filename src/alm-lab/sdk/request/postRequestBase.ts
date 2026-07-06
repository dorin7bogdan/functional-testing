import { Constants } from '../util/constants.js';
import { ResxAccessLevel } from '../util/resxAccessLevel.js';
import Response, { WebHeaders } from '../response/response.js';
import RequestBase from './requestBase.js';

export default abstract class PostRequestBase extends RequestBase {
  protected override get headers(): WebHeaders {
    return {
      'Content-Type': Constants.APP_XML,
      Accept: Constants.APP_JSON,
      [RequestBase.X_XSRF_TOKEN]: this.client.xsrfTokenValue
    };
  }

  protected override async perform(): Promise<Response> {
    return await this.client.httpPost(
      this.url,
      this.headers,
      this.xmlData,
      ResxAccessLevel.PROTECTED
    );
  }

  protected get dataFields(): Array<[string, string]> {
    return [];
  }

  private get xmlData(): string {
   const fields = this.dataFields
      .map(([k, v]) => `<Field Name="${k}"><Value>${v}</Value></Field>`)
      .join('');
    return `<Entity><Fields>${fields}</Fields></Entity>`;
  }
}
