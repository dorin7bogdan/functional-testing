import { Constants, LabRunType } from '../constants.js';
import LabPollHandler from '../handler/labPollHandler.js';
import PollHandler from '../handler/pollHandler.js';
import IClient from '../interface/iClient.js';

export default class PollHandlerFactory {
  public create(client: IClient, runType: LabRunType, entityId: string): PollHandler {
    if (runType === Constants.BVS || runType === Constants.TEST_SET) {
      return new LabPollHandler(client, entityId);
    }
    throw new Error('PollHandlerFactory: Unrecognized run type');
  }
}
