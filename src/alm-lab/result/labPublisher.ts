import IClient from '../sdk/interface/iClient.js';
import GetLabRunEntityTestSetRunsRequest from '../sdk/request/getLabRunEntityTestSetRunsRequest.js';
import GetRequest from '../sdk/request/getRequest.js';
import Xml from '../sdk/util/xml.js';
import Publisher from './publisher.js';
import Logger from '../../utils/logger.js';

const NAME = 'name';
const logger = new Logger('LabPublisher');

export default class LabPublisher extends Publisher {
  constructor(client: IClient, entityId: number, runId: number, nameSuffix: string) {
    super(client, entityId, runId, nameSuffix);
  }

  protected override async getEntityName(): Promise<string> {
    let name = 'Unnamed Entity';
    try {
      const response = await this.getRunEntityName();
      if (response.trim()) {
        name = Xml.getAttributeValue(response, NAME) || name;
      } else {
        logger.error('Failed to get Entity name. Empty response.');
      }
    } catch (error: any) {
      logger.error(error?.message ?? `${error}`);
    }
    return name;
  }

  protected override getRunEntityTestSetRunsRequest(client: IClient, runId: number): GetRequest {
    return new GetLabRunEntityTestSetRunsRequest(client, runId);
  }
}
