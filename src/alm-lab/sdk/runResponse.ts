import { Constants } from './constants.js';
import Response from './response.js';
import Xml from './util/xml.js';

const SUCCESS_STATUS = 'SuccessStaus';
const INFO = 'info';

export default class RunResponse {
  private successStatus = '';
  private runId = '';

  public initialize(response: Response): void {
    const xml = response.toString();
    this.successStatus = Xml.getAttributeValue(xml, SUCCESS_STATUS);
    this.runId = this.parseRunId(Xml.getAttributeValue(xml, INFO));
  }

  private parseRunId(runIdResponse: string): string {
    return runIdResponse?.trim() ? runIdResponse : Constants.NO_RUN_ID;
  }

  public getRunId(): string {
    return this.runId;
  }

  public hasSucceeded(): boolean {
    return this.successStatus === Constants.ONE;
  }
}
