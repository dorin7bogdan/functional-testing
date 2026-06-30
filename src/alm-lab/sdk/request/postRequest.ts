import IClient from '../interface/iClient.js';
import PostRequestBase from './postRequestBase.js';

export default abstract class PostRequest extends PostRequestBase {
  constructor(client: IClient, protected readonly runId: number) {
    super(client);
  }
}
