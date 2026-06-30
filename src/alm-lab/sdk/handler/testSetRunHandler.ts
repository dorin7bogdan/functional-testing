import IClient from '../interface/iClient.js';
import RunHandler from './runHandler.js';

export default class TestSetRunHandler extends RunHandler {
  constructor(client: IClient, entityId: number) {
    super(client, entityId);
  }

  protected get startSuffix(): string {
    return `test-sets/${this.entityId}/startruntestset`;
  }

  public override getNameSuffix(): string {
    return `test-sets/${this.entityId}`;
  }
}
