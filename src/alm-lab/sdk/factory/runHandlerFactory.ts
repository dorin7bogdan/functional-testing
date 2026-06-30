import { Constants, LabRunType } from '../constants.js';
import IClient from '../interface/iClient.js';
import BvsRunHandler from '../handler/bvsRunHandler.js';
import RunHandler from '../handler/runHandler.js';
import TestSetRunHandler from '../handler/testSetRunHandler.js';

export default class RunHandlerFactory {
  public create(client: IClient, runType: LabRunType, entityId: number): RunHandler {
    switch (runType) {
      case Constants.BVS:
        return new BvsRunHandler(client, entityId);
      case Constants.TEST_SET:
        return new TestSetRunHandler(client, entityId);
      default:
        throw new Error(`RunHandlerFactory: Run type ${runType} is Not Implemented`);
    }
  }
}
