import Logger from '../../../utils/logger.js';
import Response from '../response.js';
import IClient from '../interface/iClient.js';
import HandlerBase from './handlerBase.js';

const logger = new Logger('PollHandler');
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export default abstract class PollHandler extends HandlerBase {
  private readonly interval = 5000;

  protected constructor(client: IClient, entityId: number) {
    super(client, entityId);
  }

  public async poll(): Promise<boolean> {
    logger.info(`Start Polling... Run ID: ${this.runId}`);
    return await this.doPoll();
  }

  protected async doPoll(): Promise<boolean> {
    let ok = false;
    let failures = 0;

    while (failures < 3) {
      const res = await this.getResponse();
      if (res.isOK) {
        await this.logProgress();
        if (this.isFinished(res)) {
          ok = true;
          this.logRunEntityResults(await this.getRunEntityResultsResponse());
          break;
        } else {
          logger.info('Please wait ....');
        }
      } else {
        this.logPollingError(res);
        failures += 1;
      }
      await sleep(this.interval);
    }

    return ok;
  }

  protected abstract getRunEntityResultsResponse(): Promise<Response>;
  protected abstract logRunEntityResults(response: Response): boolean;
  protected abstract isFinished(response: Response): boolean;
  protected abstract getResponse(): Promise<Response>;
  protected abstract logProgress(): Promise<void>;

  protected logPollingError(res: Response): void {
    let err = 'Polling try failed. ';
    if (res.statusCode !== undefined) {
      err += `Status code: ${res.statusCode}`;
    }
    res.error && (err += `, Error: ${res.error}`);
    logger.error(err);
  }
}
