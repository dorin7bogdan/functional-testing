import { promises as fs } from 'fs';
import TestSuites from '../result/testSuites.js';
import LabPublisher from '../result/labPublisher.js';
import Args from './args.js';
import { Constants } from './constants.js';
import RunHandlerFactory from './factory/runHandlerFactory.js';
import PollHandlerFactory from './factory/pollHandlerFactory.js';
import PollHandler from './handler/pollHandler.js';
import RunHandler from './handler/runHandler.js';
import IClient from './interface/iClient.js';
import AuthManager from './auth/authManager.js';
import GetBvsRequest from './request/getBvsRequest.js';
import GetBvsTestSetsRequest from './request/getBvsTestSetsRequest.js';
import GetTestInstancesRequest from './request/getTestInstancesRequest.js';
import GetTestSetRequest from './request/getTestSetRequest.js';
import Response from './response.js';
import RunResponse from './runResponse.js';
import Xml from './util/xml.js';
import Logger from '../../utils/logger.js';
import { parse } from 'path';

type RunIdHandler = (runId: number) => void | Promise<void>;
const logger = new Logger('RunManager');
export default class RunManager {
  private readonly runHandler: RunHandler;
  private readonly pollHandler: PollHandler;
  private isLoggedIn = false;
  private readonly runIdHandlers: RunIdHandler[] = [];

  constructor(
    private readonly client: IClient,
    private readonly args: Args,
    private readonly fullPathReportName?: string
  ) {
    this.runHandler = new RunHandlerFactory().create(client, args.runType, args.entityId);
    this.pollHandler = new PollHandlerFactory().create(client, args.runType, args.entityId);
  }

  public onRunIdGenerated(handler: RunIdHandler): void {
    logger.debug('onRunIdGenerated: Adding a new runId handler');
    this.runIdHandlers.push(handler);
  }

  public async execute(): Promise<TestSuites | null> {
    let res: TestSuites | null = null;
    const authHandler = AuthManager.instance;
    this.isLoggedIn = await authHandler.authenticate(this.client);
    if (this.isLoggedIn) {
      if (await this.isValidBvsOrTestSet() && await this.start()) {
        if (await this.pollHandler.poll()) {
          res = await this.publish();
        }
      }
      await authHandler.logout(this.client);
      this.isLoggedIn = false;
    }
    return res;
  }

  private async publish(): Promise<TestSuites | null> {
    const publisher = new LabPublisher(
      this.client,
      this.args.entityId,
      this.runHandler.getRunId(),
      this.runHandler.getNameSuffix()
    );
    return await publisher.publish(this.args.serverUrl, this.args.domain, this.args.project);
  }

  private async start(): Promise<boolean> {
    logger.debug(`start ...`);
    let ok = false;
    const res = await this.runHandler.start(this.args.duration, this.args.envConfigId);
    if (this.isOk(res)) {
      const runResponse = this.runHandler.getRunResponse(res);
      await this.setRunId(runResponse);
      ok = runResponse.isOK;
    }
    await this.logReportUrl(ok);
    return ok;
  }

  private async logReportUrl(hasSucceeded: boolean): Promise<void> {
    if (hasSucceeded) {
      const reportUrl = await this.runHandler.reportUrl(this.args);
      logger.info(`${this.args.runType} run report for run id ${this.runHandler.getRunId()} is at: ${reportUrl}`);
      if (this.fullPathReportName) {
        try {
          await fs.appendFile(this.fullPathReportName, `[Report ${this.runHandler.getRunId()}](${reportUrl})\n`, { encoding: 'utf8' });
          logger.info(`Created the report URL file [${this.fullPathReportName}].`);
        } catch (error: any) {
          logger.error(error?.message ?? `${error}`);
        }
      }
    } else {
      const errMsg = `Failed to prepare timeslot for run. No entity of type ${this.args.runType} with id ${this.args.entityId} exists.`;
      const note = 'Note: You can run only functional test sets and build verification suites using this task. Check to make sure that the configured ID is valid (and that it is not a performance test ID).';
      logger.error(`${errMsg}\n${note}`);
    }
  }

  private async setRunId(runRes: RunResponse): Promise<void> {
    logger.debug(`setRunId: runRes=${runRes.toString()}`);
    if (!runRes.id || runRes.id === Constants.NO_RUN_ID) {
      logger.error(Constants.NO_RUN_ID);
      throw new Error(Constants.NO_RUN_ID);
    }
    const id = parseInt(runRes.id, 10);
    this.runHandler.setRunId(id);
    this.pollHandler.setRunId(id);
    logger.debug(`setRunId: runIdHandlers.length=${this.runIdHandlers.length}`);
    for (const handler of this.runIdHandlers) {
      await handler(id);
    }
  }

  private isOk(response: Response): boolean {
    logger.debug(`isOk: response=${response.toString()}`);
    if (response.isOK) {
      logger.info(`Executing ${this.args.runType} ID: ${this.args.entityId} in ${this.args.domain}/${this.args.project}`);
      return true;
    }

    if (!response.error?.trim()) {
      logger.error(`Failed to execute ${this.args.runType} ID: ${this.args.entityId}, ALM Server URL: ${this.args.serverUrl} (Response: ${response.statusCode})`);
    } else {
      logger.error(`Failed to start ${this.args.runType} ID: ${this.args.entityId}, ALM Server URL: ${this.args.serverUrl} (Error: ${response.error})`);
    }
    return false;
  }

  private async hasTestInstances(): Promise<boolean> {
    const res = await new GetTestInstancesRequest(this.client, this.args.entityId).execute();
    const ok = res.isOK && Xml.hasResults(res.toString());
    if (!ok) {
      logger.error(`The ${Constants.TESTSET} ${this.args.entityId} is empty!`);
    }
    return ok;
  }

  private async isExistingTestSet(): Promise<boolean> {
    const res = await new GetTestSetRequest(this.client, this.args.entityId).execute();
    return res.isOK && Xml.hasResults(res.toString());
  }

  private async isExistingBvs(): Promise<boolean> {
    const res = await new GetBvsRequest(this.client, this.args.entityId).execute();
    return res.isOK && Xml.hasResults(res.toString());
  }

  private async isValidBvsOrTestSet(): Promise<boolean> {
    if (this.args.runType === Constants.BVS) {
      if (await this.isExistingBvs()) {
        return await this.isValidBvs();
      }
      logger.error(`No ${Constants.BUILD_VERIFICATION_SUITE} could be found by ID ${this.args.entityId}.`);
      return false;
    }

    if (await this.isExistingTestSet()) {
      return await this.hasTestInstances();
    }
    logger.error(`No ${Constants.TESTSET} of functional type could be found by ID ${this.args.entityId}.\nNote: You can run only functional test sets and build verification suites using this task. Check to make sure that the configured ID is valid (and that it is not a performance test ID).`);
    return false;
  }

  private async getBvsTestSetsIds(): Promise<number[]> {
    const res = await new GetBvsTestSetsRequest(this.client, this.args.entityId).execute();
    if (!res || !res.isOK || !res.data) {
      return [];
    }
    return Xml.getTestSetIds(res.toString());
  }

  private async isValidBvs(): Promise<boolean> {
    const testSetIds = await this.getBvsTestSetsIds();
    let ok = testSetIds.length > 0;
    if (ok) {
      const res = await new GetTestInstancesRequest(this.client, testSetIds).execute();
      const nonEmptyTestSetIds = Xml.getTestSetIds(res.toString());
      const nonEmpty = new Set(nonEmptyTestSetIds);
      const emptyTestSetIds = testSetIds.filter(id => !nonEmpty.has(id));
      if (emptyTestSetIds.length > 0) {
        logger.error(`The ${Constants.BUILD_VERIFICATION_SUITE} ${this.args.entityId} is invalid. The following TestSets are empty: ${emptyTestSetIds.join(Constants.COMMA)}.`);
        ok = false;
      }
    } else {
      logger.error(`The ${Constants.BUILD_VERIFICATION_SUITE} ${this.args.entityId} is empty!`);
    }
    return ok;
  }
}
