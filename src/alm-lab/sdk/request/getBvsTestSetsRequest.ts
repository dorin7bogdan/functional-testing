import IClient from '../interface/iClient.js';
import GetRequestBase from './getRequestBase.js';

export default class GetBvsTestSetsRequest extends GetRequestBase {
  
  constructor(client: IClient, private readonly bvsId: string) {
    super(client);
  }

  protected override get suffix(): string {
    return 'procedure-testsets';
  }

  protected override get queryString(): string {
    return `query={parent-id[${this.bvsId}]}&fields=cycle-id&page-size=max`;
  }
}
