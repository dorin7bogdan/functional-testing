import { Constants } from '../util/constants.js';
import IClient from '../interface/iClient.js';
import { WebHeaders } from '../response/response.js';
import GetRequest from './getRequest.js';

export default class GetLabRunEntityTestSetRunsRequest extends GetRequest {
  constructor(client: IClient, runId: number) {
    super(client, runId);
  }

  protected override get suffix(): string {
    return 'procedure-testset-instance-runs';
  }

  protected override get queryString(): string {
    return `query={procedure-run[${this.runId}]}&page-size=2000&fields=test-subtype,start-exec-time,test-config-name,duration,start-exec-date,testset-name,testcycl-id,status,run-id`;
  }

  protected override get headers(): WebHeaders {
    return {
      'Content-Type': Constants.APP_JSON,
      Accept: Constants.APP_JSON
    };
  }
}
