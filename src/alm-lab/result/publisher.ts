import IClient from '../sdk/interface/iClient.js';
import GetRequest from '../sdk/request/getRequest.js';
import GetRunEntityNameRequest from '../sdk/request/getRunEntityNameRequest.js';
import Xml, { EntityMap } from '../sdk/util/xml.js';
import TestSuites from './testSuites.js';
import JUnitParser from './jUnitParser.js';
import Logger from '../../utils/logger.js';

const logger = new Logger('Publisher');

export default abstract class Publisher {
  protected constructor(
    protected readonly client: IClient,
    protected readonly entityId: number,
    protected readonly runId: number,
    protected readonly nameSuffix: string
  ) {}

  public async publish(url: string, domain: string, project: string): Promise<TestSuites | null> {
    const testSetRunsRequest = this.getRunEntityTestSetRunsRequest(this.client, this.runId);
    const response = await testSetRunsRequest.execute();
    const testInstanceRuns = this.getTestInstanceRun(response.data);
    const entityName = await this.getEntityName();

    if (testInstanceRuns.length > 0) {
      return new JUnitParser(this.entityId).toModel(testInstanceRuns, entityName, url, domain, project);
    }
    return null;
  }

  protected async getRunEntityName(): Promise<string> {
    const response = await new GetRunEntityNameRequest(this.client, this.nameSuffix, this.entityId).execute();
    return response.data ?? '';
  }

  protected getTestInstanceRun(responseData?: string): EntityMap[] {
    try {
      if (responseData?.trim()) {
        const entities = Xml.toEntities(responseData);
        if (entities.length > 0) {
          return entities;
        }
      }
      logger.info('Parse TestInstanceRuns from response XML got no result.');
    } catch (error: any) {
      logger.error(`Failed to parse TestInstanceRuns response XML. Exception: ${error?.message ?? error}`);
    }
    return [];
  }

  protected abstract getRunEntityTestSetRunsRequest(client: IClient, runId: number): GetRequest;
  protected abstract getEntityName(): Promise<string>;
}
