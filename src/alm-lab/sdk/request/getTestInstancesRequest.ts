import IClient from '../interface/iClient.js';
import GetRequestBase from './getRequestBase.js';

const OR = ' OR ';

export default class GetTestInstancesRequest extends GetRequestBase {
  private readonly testSetIds: string;

  constructor(client: IClient, testsetIds: string | number[]) {
    super(client);
    this.testSetIds = Array.isArray(testsetIds) ? testsetIds.join(OR) : testsetIds;
  }

  protected override get suffix(): string {
    return 'test-instances';
  }

  protected override get queryString(): string {
    return `query={cycle-id[${this.testSetIds}]}&fields=cycle-id&page-size=max`;
  }
}
