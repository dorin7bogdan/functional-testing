import { ResxAccessLevel } from '../resxAccessLevel.js';
import Response from '../response.js';
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
