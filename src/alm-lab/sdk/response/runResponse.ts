import { Constants } from '../util/constants.js';
import Response from '../response/response.js';
import JsonParser from '../util/jsonParser.js';
import Logger from '../../../utils/logger.js';

const SUCCESS_STATUS = 'SuccessStaus';
const INFO = 'info';
const logger = new Logger('RunResponse');

export default class RunResponse {
  private readonly _status: string;
  private readonly _id: number;

  public constructor(response: Response) {
    const json = response.toString();
    this._status = JsonParser.getAttrVal(json, SUCCESS_STATUS);
    this._id = this.parseRunId(JsonParser.getAttrVal(json, INFO));
    logger.debug(`ctor: id=${this._id}, status="${this._status}"`);
    logger.debug(`ctor: typeof id="${typeof this._id}", typeof status="${typeof this._status}"`);
  }

  private parseRunId(runId: string): number {
    logger.debug(`parseRunId: runId="${runId}"`);
    const parsedRunId = runId ? parseInt(runId, 10) : 0;
    return isNaN(parsedRunId) ? 0 : parsedRunId;
  }

  public get id(): number {
    return this._id;
  }

  public get isOK(): boolean {
    const ok = this._status === Constants.ONE;
    logger.debug(`isOK: returning "${ok}"`);
    return ok;
  }
}
