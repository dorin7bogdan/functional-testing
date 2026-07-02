import { ResxAccessLevel } from '../util/resxAccessLevel.js';
import Response from '../response/response.js';
import RequestBase from './requestBase.js';

export default abstract class GetRequestBase extends RequestBase {
  protected get queryString(): string {
    return '';
  }

  protected override async perform(): Promise<Response> {
    return await this.client.httpGet(
      this.url,
      this.headers,
      ResxAccessLevel.PROTECTED,
      this.queryString
    );
  }
}
