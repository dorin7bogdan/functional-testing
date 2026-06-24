import { Constants } from './constants.js';
import Response from './response.js';
import Xml from './util/xml.js';

const SUCCESS_STATUS = 'SuccessStaus';
const INFO = 'info';

export default class RunResponse {
  private _status = '';
  private _id = '';

  public initialize(response: Response): void {
    const xml = response.toString();
    this._status = Xml.getAttributeValue(xml, SUCCESS_STATUS);
    this._id = this.parseRunId(Xml.getAttributeValue(xml, INFO));
  }

  private parseRunId(runId: string): string {
    return runId?.trim() ? runId : Constants.NO_RUN_ID;
  }

  public get id(): string {
    return this._id;
  }

  public get isOK(): boolean {
    return this._status === Constants.ONE;
  }
}
