import IClient from '../interface/iClient.js';
import GetRequest from './getRequest.js';

export default class GetRunEntityNameRequest extends GetRequest {
  
  constructor(client: IClient, private readonly nameSuffix: string, entityId: number) {
    super(client, entityId);
  }

  protected override get suffix(): string {
    return this.nameSuffix;
  }
}
