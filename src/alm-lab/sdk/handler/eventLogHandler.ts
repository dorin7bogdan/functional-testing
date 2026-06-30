import Logger from '../../../utils/logger.js';
import Response from '../response.js';
import IClient from '../interface/iClient.js';
import EventLogRequest from '../request/eventLogRequest.js';
import Xml, { EntityMap } from '../util/xml.js';
import HandlerBase from './handlerBase.js';

const CREATION_TIME = 'creation-time';
const DESCRIPTION = 'description';
const ID = 'id';
const logger = new Logger('EventLogHandler');

export default class EventLogHandler extends HandlerBase {
  private lastRead = -1;

  constructor(
    client: IClient,
    private readonly runTimeslotId: number) {
      super(client, runTimeslotId);
  }

  public async log(): Promise<boolean> {
    let eventLog: Response | null = null;
    try {
      eventLog = await this.getEventLog();
      const entities = Xml.toEntities(eventLog.toString());
      for (const currEntity of entities) {
        if (this.isNew(currEntity)) {
          logger.info(`${currEntity[CREATION_TIME]}:${currEntity[DESCRIPTION]}`);
        }
      }
      return true;
    } catch (error: any) {
      logger.error(
        `Failed to print Event Log: ${eventLog?.toString() ?? ''} (run id: ${this.runId}, reservation id: ${this.runTimeslotId}). Cause: ${error?.message ?? error}`
      );
      return false;
    }
  }

  private isNew(currEntity: EntityMap): boolean {
    if (!currEntity || !(ID in currEntity)) {
      throw new Error('Current entity is null or does not contain the [id] key');
    }
    const currEvent = Number.parseInt(currEntity[ID], 10);
    if (Number.isNaN(currEvent)) {
      throw new Error(`Current entity has an invalid [id]: ${currEntity[ID]}`);
    }

    if (currEvent > this.lastRead) {
      this.lastRead = currEvent;
      return true;
    }
    return false;
  }

  private async getEventLog(): Promise<Response> {
    return await new EventLogRequest(this.client, this.runTimeslotId).execute();
  }
}
