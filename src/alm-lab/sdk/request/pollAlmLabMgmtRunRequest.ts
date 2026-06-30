import IClient from '../interface/iClient.js';
import GetRequest from './getRequest.js';
import RequestBase from './requestBase.js';

export default class PollAlmLabMgmtRunRequest extends GetRequest {
  constructor(client: IClient, runId: number) {
    super(client, runId);
  }

  protected override get suffix(): string {
    return `${RequestBase.PROC_RUNS}/${this.runId}`;
  }
}
