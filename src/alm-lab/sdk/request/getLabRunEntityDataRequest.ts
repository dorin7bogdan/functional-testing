import IClient from '../interface/iClient.js';
import GetRequest from './getRequest.js';
import RequestBase from './requestBase.js';

export default class GetLabRunEntityDataRequest extends GetRequest {
  constructor(client: IClient, runId: string) {
    super(client, runId);
  }

  protected override get suffix(): string {
    return `${RequestBase.PROC_RUNS}/${this.runId}`;
  }
}
