import Logger from '../../../utils/logger.js';
import IClient from '../interface/iClient.js';
import PostRequest from './postRequest.js';

const DURATION = 'duration';
const VUDS_MODE = 'vudsMode';
const RESERVATION_ID = 'reservationId';
const MINUS_ONE = '-1';
const VALUE_SET_ID = 'valueSetId';
const logger = new Logger('StartRunEntityRequest');

export default class StartRunEntityRequest extends PostRequest {
  constructor(client: IClient, private readonly reqSuffix: string, runId: string, private readonly duration: string, private readonly envConfigId: string) {
    logger.debug(`ctor: reqSuffix=${reqSuffix}, runId=${runId}, duration=${duration}, envConfigId=${envConfigId}`);
    super(client, runId);
  }

  protected override get dataFields(): Array<[string, string]> {
    const fields: Array<[string, string]> = [
      [DURATION, this.duration],
      [VUDS_MODE, 'false'],
      [RESERVATION_ID, MINUS_ONE]
    ];
    if (this.envConfigId?.trim()) {
      fields.push([VALUE_SET_ID, this.envConfigId]);
    }
    return fields;
  }

  protected override get suffix(): string {
    return this.reqSuffix;
  }
}
