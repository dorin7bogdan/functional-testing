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
const REPORT_URL_TXT = 'report-url.txt';

export default class AlmLabManager {
  private _runIdFilePath: string | null = null;
  private readonly _rptUrlFilePath: string;
  public get runIdFilePath(): string | null {
    return this._runIdFilePath;
  }
  public get rptUrlFilePath(): string {
    return this._rptUrlFilePath;
  }
  public constructor(private readonly xmlResFileName: string) {
    logger.debug(`ctor() ...`);
    this._rptUrlFilePath = path.join(config.runnerWsPath, REPORT_URL_TXT);
  }
  public async run(): Promise<ExitCode> {
    logger.debug(`run() ...`);
    const resultsFilePath = path.join(config.runnerWsPath, this.xmlResFileName);
    const runMgr = this.getRunManager();
    const hasResults = await this.runLab(resultsFilePath, runMgr);
    const exitCode = hasResults ? ExitCode.Passed : ExitCode.Failed;
    logger.debug(`run: ExitCode: ${exitCode}`);
    return exitCode;
  }

  private async runLab(resultsFilePath: string, runMgr: RunManager): Promise<boolean> {
    logger.debug(`runLab() ...`);
    const testSuites = await runMgr.execute();
    if (await this.saveResults(resultsFilePath, testSuites)) {
      return testSuites?.items.some((suite) => suite.testCases.length > 0) === true;
    }
    return false;
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

    const runManager = new RunManager(client, args, this._rptUrlFilePath);
    runManager.onRunIdGenerated(async (runId: number) => {
      await this.runIdGenerated(runId);
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

  public async runIdGenerated(runId: number): Promise<void> {
    logger.debug(`runIdGenerated: "${runId}"`);
    if (!runId) {
      return;
    }
    this._runIdFilePath = path.join(config.runnerWsPath, `${runId}.runid`);
    try {
      logger.debug(`runIdGenerated: Creating [${this._runIdFilePath}] ...`);
      await fs.writeFile(this._runIdFilePath, '', { encoding: 'utf8' });
    } catch (error) {
      logger.warn(`Error creating the run ID file [${this._runIdFilePath}]: ${error}`);
    }
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