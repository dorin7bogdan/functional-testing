import IClient from '../interface/iClient.js';
import GetRequest from './getRequest.js';

export default class EventLogRequest extends GetRequest {
  private readonly requestSuffix: string;

  constructor(client: IClient, timeslotId: string) {
    super(client, timeslotId);
    this.requestSuffix = `event-log-reads?query={context["*Timeslot: ${timeslotId};*"]}&fields=id,event-type,creation-time,action,description`;
  }

  protected override get suffix(): string {
    return this.requestSuffix;
  }
}
