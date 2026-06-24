import Args from '../args.js';
import IClient from '../interface/iClient.js';
import Response from '../response.js';
import RunResponse from '../runResponse.js';
import StartRunEntityRequest from '../request/startRunEntityRequest.js';
import HandlerBase from './handlerBase.js';
import Logger from '../../../utils/logger.js';

const logger = new Logger('RunHandler');

export default abstract class RunHandler extends HandlerBase {
  protected abstract get startSuffix(): string;
  public abstract getNameSuffix(): string;

  protected constructor(client: IClient, entityId: string) {
    logger.debug(`ctor: entityId=${entityId}`);
    super(client, entityId);
  }

  public async start(duration: string, envConfigId: string): Promise<Response> {
    logger.debug(`start: duration=${duration}, envConfigId=${envConfigId}`);
    return await new StartRunEntityRequest(this.client, this.startSuffix, this.entityId, duration, envConfigId).execute();
  }

  public async reportUrl(args: Args): Promise<string> {
    return `${args.serverUrl.replace(/[\\/]+$/, '')}/ui/?redirected&p=${args.domain}/${args.project}&execution-report#!/test-set-report/${this.runId}`;
  }

  public getRunResponse(response: Response): RunResponse {
    const runResponse = new RunResponse();
    runResponse.initialize(response);
    return runResponse;
  }
}
