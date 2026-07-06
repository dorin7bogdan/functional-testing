import { promises as fs } from 'fs';
import TestSuites from '../result/testSuites.js';
import LabPublisher from '../result/labPublisher.js';
import Args from './util/args.js';
import { Constants } from './util/constants.js';
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
import Response from './response/response.js';
import RunResponse from './response/runResponse.js';
import JsonParser from './util/jsonParser.js';
import Logger from '../../utils/logger.js';
import path from 'path';
import { config } from '../../config/config.js';

type RunIdHandler = (runId: number) => void | Promise<void>;
const logger = new Logger('RunManager');
export default class RunManager {
  private readonly runHandler: RunHandler;
  private readonly pollHandler: PollHandler;
  private isLoggedIn = false;
  private readonly runIdHandlers: RunIdHandler[] = [];

  constructor(
    private readonly client: IClient,
    private readonly args: Args
  ) {
    this.runHandler = new RunHandlerFactory().create(client, args.runType, args.entityId);
    this.pollHandler = new PollHandlerFactory().create(client, args.runType, args.entityId);
  }

  public onRunIdGenerated(handler: RunIdHandler): void {
    logger.debug('onRunIdGenerated: Adding a new runId handler');
    this.runIdHandlers.push(handler);
  }

  public async execute(): Promise<{ testSuites: TestSuites | null, rptUrlFileName: string }> {
    logger.debug(`execute: ...`);
    let testSuites: TestSuites | null = null;
    let rptUrlFileName = "";
    let isOK = false;
    const authHandler = AuthManager.instance;
    this.isLoggedIn = await authHandler.authenticate(this.client);
    if (this.isLoggedIn) {
      if (await this.isValidBvsOrTestSet()) {
        ({ isOK, rptUrlFileName } = await this.start());
        if (isOK) {
          if (await this.pollHandler.poll()) {
            testSuites = await this.publish();
          }
        }
      }
      await authHandler.logout(this.client);
      this.isLoggedIn = false;
    }
    return { testSuites, rptUrlFileName };
  }

  private async publish(): Promise<TestSuites | null> {
    logger.debug(`publish ...`);
    const publisher = new LabPublisher(
      this.client,
      this.args.entityId,
      this.runHandler.getRunId(),
      this.runHandler.getNameSuffix()
    );
    return await publisher.publish(this.args.serverUrl, this.args.domain, this.args.project);
  }

  private async start(): Promise<{ isOK: boolean, rptUrlFileName: string }> {
    logger.debug(`start ...`);
    let isOK = false;
    const res = await this.runHandler.start(this.args.duration, this.args.envConfigId);
    if (this.isOK(res)) {
      const runResponse = this.runHandler.getRunResponse(res);
      await this.setRunId(runResponse);
      isOK = runResponse.isOK;
    }
    const rptUrlFileName = await this.logReportUrl(isOK);
    return { isOK, rptUrlFileName };
  }

  private async logReportUrl(hasSucceeded: boolean): Promise<string> {
    logger.debug(`logReportUrl: hasSucceeded=${hasSucceeded}`);
    if (hasSucceeded) {
      const reportUrl = await this.runHandler.reportUrl(this.args);
      const runId = this.runHandler.getRunId();
      logger.info(`${this.args.runType} run report for run id ${runId} is at: ${reportUrl}`);
      try {
        const rptUrlFileName = `run-id-${runId}-report-url.txt`;
        const rptUrlFilePath = path.join(config.runnerWsPath, rptUrlFileName);
        await fs.appendFile(rptUrlFilePath, `[Report ${runId}](${reportUrl})\n`, { encoding: 'utf8' });
        logger.info(`Created the report URL file "${rptUrlFileName}".`);
        return rptUrlFileName;
      } catch (error: any) {
        logger.error(error?.message ?? `${error}`);
      }
    } else {
      const errMsg = `Failed to prepare timeslot for run. No entity of type ${this.args.runType} with id ${this.args.entityId} exists.`;
      const note = 'Note: You can run only functional test sets and build verification suites using this task. Check to make sure that the configured ID is valid (and that it is not a performance test ID).';
      logger.error(`${errMsg}\n${note}`);
    }
    return "";
  }

  private async setRunId(runRes: RunResponse): Promise<void> {
    logger.debug(`setRunId: id=${runRes.id}, status="${runRes.isOK}"`);
    const id = runRes.id;
    if (!id) {
      logger.error(Constants.NO_RUN_ID);
      throw new Error(Constants.NO_RUN_ID);
    }
    this.runHandler.setRunId(id);
    this.pollHandler.setRunId(id);
    logger.debug(`setRunId: runIdHandlers.length=${this.runIdHandlers.length}`);
    for (const handler of this.runIdHandlers) {
      await handler(id);
    }
  }

  private isOK(response: Response): boolean {
    const isOK = response.isOK;
    logger.debug(`isOK: ${isOK}, statusCode=${response.statusCode}`);
    if (isOK) {
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
    const ok = res.isOK && JsonParser.hasResults(res.toString());
    if (!ok) {
      logger.error(`The ${Constants.TESTSET} ${this.args.entityId} is empty!`);
    }
    return ok;
  }

  private async isExistingTestSet(): Promise<boolean> {
    const res = await new GetTestSetRequest(this.client, this.args.entityId).execute();
    return res.isOK && JsonParser.hasResults(res.toString());
  }

  private async isExistingBvs(): Promise<boolean> {
    const res = await new GetBvsRequest(this.client, this.args.entityId).execute();
    return res.isOK && JsonParser.hasResults(res.toString());
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
    return JsonParser.getTestSetIds(res.toString());
  }

  private async isValidBvs(): Promise<boolean> {
    const testSetIds = await this.getBvsTestSetsIds();
    let ok = testSetIds.length > 0;
    if (ok) {
      const res = await new GetTestInstancesRequest(this.client, testSetIds).execute();
      const nonEmptyTestSetIds = JsonParser.getTestSetIds(res.toString());
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
