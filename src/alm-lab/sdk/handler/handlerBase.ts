import IClient from '../interface/iClient.js';

export default abstract class HandlerBase {
  protected runId = '';
  protected timeslotId = '';

  protected constructor(
    protected readonly client: IClient,
    protected readonly entityId: string,
    runId?: string) {
      if (runId) {
        this.runId = runId;
      }
  }

  public getEntityId(): string {
    return this.entityId;
  }

  public getRunId(): string {
    return this.runId;
  }

  public setRunId(value: string): void {
    this.runId = value;
  }
}
