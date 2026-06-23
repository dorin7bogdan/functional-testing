import IClient from '../interface/iClient.js';
import GetRequestBase from './getRequestBase.js';

export default class GetTestSetRequest extends GetRequestBase {
  
  constructor(client: IClient, private readonly testSetId: string) {
    super(client);
  }

  protected override get suffix(): string {
    return 'test-sets';
  }

  protected override get queryString(): string {
    return `query={id[${this.testSetId}];subtype-id["hp.sse.test-set.process"]}&fields=id,name&page-size=1`;
  }
}
