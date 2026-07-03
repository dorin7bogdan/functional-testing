import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config/config.js';
import { ExitCode } from '../ft/ExitCode.js';
import Logger from '../utils/logger.js';
import TestSuites from './result/testSuites.js';
import Args from './sdk/util/args.js';
import { Constants, LabRunType } from './sdk/util/constants.js';
import Credentials from './sdk/util/credentials.js';
import RestClient from './sdk/client/restClient.js';
import RunManager from './sdk/runManager.js';

const logger = new Logger('AlmLabManager');

export default class AlmLabManager {
  private runIdFilePath?: string;
  public constructor(private readonly xmlResFileName: string) {
    logger.debug(`ctor() ...`);
  }
  public async run(): Promise<{ exitCode: ExitCode, runIdFilePath: string, rptUrlFileName: string }> {
    logger.debug(`run() ...`);
    const resultsFilePath = path.join(config.runnerWsPath, this.xmlResFileName);
    const runMgr = this.getRunManager();
    const { hasResults, rptUrlFileName } = await this.runLab(resultsFilePath, runMgr);
    const exitCode = hasResults ? ExitCode.Passed : ExitCode.Failed;
    logger.debug(`run: ExitCode: ${exitCode}`);
    return { exitCode, runIdFilePath: this.runIdFilePath ?? '', rptUrlFileName };
  }

  private async runLab(resultsFilePath: string, runMgr: RunManager): Promise<{ hasResults: boolean, rptUrlFileName: string }> {
    logger.debug(`runLab() ...`);
    const { testSuites, rptUrlFileName } = await runMgr.execute();
    if (await this.saveResults(resultsFilePath, testSuites)) {
      return { hasResults: testSuites?.items.some((suite) => suite.testCases.length > 0) === true, rptUrlFileName };
    }
    return { hasResults: false, rptUrlFileName };
  }

  private getRunManager(): RunManager {
    const c = config.almLab;
    if (!c) {
      throw new Error('Missing alm-lab configuration');
    }

    const runType = this.resolveRunType(c.testSetId, c.bvsId);
    const entityId = runType === Constants.BVS ? c.bvsId : c.testSetId;

    const args = new Args(
      c.serverUrl,
      runType,
      entityId,
      c.domain,
      c.project,
      c.duration,
      c.envConfigId
    );

    const cred = c.isSSO ?
      new Credentials(true, c.clientId, c.apiKeySecret) :
      new Credentials(false, c.username, c.password);

    const client = new RestClient(args.serverUrl, cred, args.domain, args.project);

    const runManager = new RunManager(client, args);
    runManager.onRunIdGenerated(async (runId: number) => {
      this.runIdFilePath = await this.runIdGenerated(runId);
    });
    return runManager;
  }

  private resolveRunType(almTestSetID?: number, almBVSID?: number): LabRunType {
    if (Number.isInteger(almTestSetID) && almTestSetID! > 0) {
      return Constants.TEST_SET;
    }
    if (Number.isInteger(almBVSID) && almBVSID! > 0) {
      return Constants.BVS;
    }
    throw new Error('Either "almTestSetId" or "almBvsId" must be a positive integer');
  }

  private async runIdGenerated(runId: number): Promise<string> {
    logger.debug(`runIdGenerated: "${runId}"`);
    if (!runId) {
      return '';
    }
    try {
      /*const runIdFilePath = path.join(config.runnerWsPath, `${runId}.runid`);
      logger.debug(`runIdGenerated: Creating [${runIdFilePath}] ...`);
      await fs.writeFile(runIdFilePath, '', { encoding: 'utf8' });
      return runIdFilePath;*/
    } catch (error) {
      logger.warn(`Error creating the file "${runId}.runid": ${error}`);
    }
    return '';
  }

  private async saveResults(filePath: string, testSuites: TestSuites | null): Promise<boolean> {
    logger.debug(`saveResults: "${filePath}"`);
    if (!testSuites) {
      return false;
    }
    try {
      const xml = testSuites.toXML();
      logger.debug(`saveResults: writing file ...`);
      await fs.writeFile(filePath, xml, { encoding: 'utf8' });
      return true;
    } catch (error) {
      logger.error(`Failed to save ALM Lab results to "${filePath}": ${error}`);
      return false;
    }
  }
}