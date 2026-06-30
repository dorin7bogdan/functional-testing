import IClient from '../interface/iClient.js';
import GetRequestBase from './getRequestBase.js';

export default abstract class GetRequest extends GetRequestBase {
  
  constructor(client: IClient, protected readonly runId: number) {
    super(client);
  }
}
