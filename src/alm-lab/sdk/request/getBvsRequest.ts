import IClient from '../interface/iClient.js';
import GetRequestBase from './getRequestBase.js';

export default class GetBvsRequest extends GetRequestBase {
  
  constructor(client: IClient, private readonly bvsId: string) {
    super(client);
  }

  protected override get suffix(): string {
    return 'procedures';
  }

  protected override get queryString(): string {
    return `query={id[${this.bvsId}]}&fields=id,name&page-size=1`;
  }
}
