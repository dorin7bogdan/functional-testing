import IClient from '../interface/iClient.js';
import RunHandler from './runHandler.js';

export default class BvsRunHandler extends RunHandler {
  constructor(client: IClient, entityId: number) {
    super(client, entityId);
  }

  protected get startSuffix(): string {
    return `procedures/${this.entityId}/startrunprocedure`;
  }

  public override getNameSuffix(): string {
    return `procedures/${this.entityId}`;
  }
}
