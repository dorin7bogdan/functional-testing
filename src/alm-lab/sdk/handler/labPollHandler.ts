import Response from '../response/response.js';
import GetLabRunEntityDataRequest from '../request/getLabRunEntityDataRequest.js';
import PollAlmLabMgmtRunRequest from '../request/pollAlmLabMgmtRunRequest.js';
import JsonParser from '../util/jsonParser.js';
import EventLogHandler from './eventLogHandler.js';
import PollHandler from './pollHandler.js';
import IClient from '../interface/iClient.js';
import Logger from '../../../utils/logger.js';

const END_TIME = 'end-time';
const START_TIME = 'start-time';
const STATE = 'state';
const COMPLETED_SUCCESSFULLY = 'completed-successfully';
const RESERVATION_ID = 'reservation-id';
const logger = new Logger('LabPollHandler');

export default class LabPollHandler extends PollHandler {
  private eventLogHandler: EventLogHandler | null = null;

  constructor(client: IClient, entityId: number) {
    super(client, entityId);
  }

  protected override async doPoll(): Promise<boolean> {
    let ok = false;
    const res = await this.getRunEntityData();
    if (res.isOK) {
      this.setTimeslotId(res);
      this.eventLogHandler = new EventLogHandler(this.client, this.timeslotId);
      if (this.timeslotId) {
        ok = await super.doPoll();
      }
    } else {
      this.logPollingError(res);
    }
    return ok;
  }

  protected override async getResponse(): Promise<Response> {
    return await new PollAlmLabMgmtRunRequest(this.client, this.runId).execute();
  }

  protected override async logProgress(): Promise<void> {
    await this.eventLogHandler?.log();
  }

  protected override isFinished(response: Response): boolean {
    try {
      const xml = response.toString();
      const endTime = JsonParser.getAttrVal(xml, END_TIME);
      if (endTime.trim().length > 0) {
        const startTime = JsonParser.getAttrVal(xml, START_TIME);
        const currentRunState = JsonParser.getAttrVal(xml, STATE);
        logger.info(
          `Timeslot ${this.timeslotId} is [${currentRunState}].\nRun start time: [${startTime}], Run end time: [${endTime}]`
        );
        return true;
      }
      return false;
    } catch {
      logger.error(`Failed to parse response: ${response.toString()}`);
      return true;
    }
  }

  protected override logRunEntityResults(response: Response): boolean {
    try {
      const xml = response.toString();
      const state = JsonParser.getAttrVal(xml, STATE);
      const completedSuccessfully = JsonParser.getAttrVal(xml, COMPLETED_SUCCESSFULLY);
      logger.debug(`Run state of ${this.runId}: ${state}, Completed successfully: ${completedSuccessfully}`);
      return true;
    } catch {
      logger.error(`Failed to parse response: ${response.toString()}`);
      return false;
    }
  }

  protected override async getRunEntityResultsResponse(): Promise<Response> {
    return await new GetLabRunEntityDataRequest(this.client, this.runId).execute();
  }

  private setTimeslotId(runEntityResponse: Response): void {
    const tsId = this.getTimeslotId(runEntityResponse);
    logger.info(`Timeslot id: ${tsId}`);
    this.timeslotId = parseInt(tsId, 10);
  }

  private async getRunEntityData(): Promise<Response> {
    return await new GetLabRunEntityDataRequest(this.client, this.runId).execute();
  }

  private getTimeslotId(response: Response): string {
    try {
      return JsonParser.getAttrVal(response.toString(), RESERVATION_ID);
    } catch {
      logger.error(`Failed to parse response for timeslot ID: ${response.toString()}`);
      return '';
    }
  }
}
