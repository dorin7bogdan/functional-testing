import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config/config.js';
import { ExitCode } from '../ft/ExitCode.js';
import Logger from '../utils/logger.js';
import { getTimestamp } from '../utils/utils.js';
import TestSuites from './result/testSuites.js';
import Args from './sdk/args.js';
import { Constants, LabRunType } from './sdk/constants.js';
import Credentials from './sdk/credentials.js';
import RestClient from './sdk/restClient.js';
import RunManager from './sdk/runManager.js';

const logger = new Logger('AlmLabManager');
const DEFAULT_REPORT_FILE_NAME = 'report.md'; // TODO review if this is OK

export default class AlmLabManager {
  public static async run(): Promise<ExitCode> {
    const resultsFileName = `results_${getTimestamp()}.xml`;
    const resultsFilePath = path.join(config.runnerWsPath, resultsFileName);
    const runMgr = this.getRunManager(config.runnerWsPath);
    const hasResults = await this.runLab(resultsFilePath, runMgr);
    return hasResults ? ExitCode.Passed : ExitCode.Failed;
  }

  private static async runLab(resultsFilePath: string, runMgr: RunManager): Promise<boolean> {
    const testSuites = await runMgr.execute();
    if (await this.saveResults(resultsFilePath, testSuites)) {
      return testSuites?.items.some((suite) => suite.testCases.length > 0) === true;
    }
    return false;
  }

  private static getRunManager(reportPath: string): RunManager {
    const c = config.almLab;
    if (!c) {
      throw new Error('Missing alm-lab configuration');
    }

    const runType = this.resolveRunType(c.testSetId, c.bvsId);
    const entityId = runType === Constants.BVS ? c.bvsId : c.testSetId;

    const args = new Args(
      c.serverUrl,
      runType,
      `${entityId}`,
      c.domain,
      c.project,
      `${c.timeout}`,
      `${c.envConfigId}`
    );

    const cred = c.isSSO ?
      new Credentials(true, c.clientId, c.apiKeySecret) :
      new Credentials(false, c.username, c.password);

    const client = new RestClient(args.serverUrl, cred, args.domain, args.project);

    const runManager = new RunManager(client, args, path.join(reportPath, DEFAULT_REPORT_FILE_NAME));
    runManager.onRunIdGenerated(async (runId: string) => {
      await this.onRunIdGenerated(reportPath, runId);
    });
    return runManager;
  }

  private static resolveRunType(almTestSetID?: number, almBVSID?: number): LabRunType {
    if (Number.isInteger(almTestSetID) && almTestSetID! > 0) {
      return Constants.TEST_SET;
    }
    if (Number.isInteger(almBVSID) && almBVSID! > 0) {
      return Constants.BVS;
    }
    throw new Error('Either "almTestSetId" or "almBvsId" must be a positive integer');
  }

  private static async onRunIdGenerated(reportPath: string, runId: string): Promise<void> {
    logger.debug(`onRunIdGenerated: ${runId}`);
    if (!runId) {
      return;
    }
    const runIdFilePath = path.join(reportPath, `${runId}.runid`);
    try {
      await fs.writeFile(runIdFilePath, '', { encoding: 'utf8' });
    } catch (error) {
      logger.warn(`Error creating the run ID file [${runIdFilePath}]: ${error}`);
    }
  }

  private static async saveResults(filePath: string, testSuites: TestSuites | null): Promise<boolean> {
    logger.debug(`saveResults: "${filePath}"`);
    if (!testSuites) {
      return false;
    }
    try {
      const xml = testSuites.toXML();
      await fs.writeFile(filePath, xml, { encoding: 'utf8' });
      return true;
    } catch (error) {
      logger.error(`Failed to save ALM Lab results to "${filePath}": ${error}`);
      return false;
    }
  }
}