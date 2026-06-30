import IClient from '../interface/iClient.js';

export default abstract class HandlerBase {
  protected runId = 0;
  protected timeslotId = 0;

  protected constructor(
    protected readonly client: IClient,
    protected readonly entityId: number,
    runId?: number) {
      if (runId) {
        this.runId = runId;
      }
  }

  public getEntityId(): number {
    return this.entityId;
  }

  public getRunId(): number {
    return this.runId;
  }

  public setRunId(value: number): void {
    this.runId = value;
  }
}
