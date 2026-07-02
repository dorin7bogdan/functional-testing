/*
 * Copyright 2026 Open Text.
 *
 * The only warranties for products and services of Open Text and
 * its affiliates and licensors (“Open Text”) are as may be set forth
 * in the express warranty statements accompanying such products and services.
 * Nothing herein should be construed as constituting an additional warranty.
 * Open Text shall not be liable for technical or editorial errors or
 * omissions contained herein. The information contained herein is subject
 * to change without notice.
 *
 * Except as specifically indicated otherwise, this document contains
 * confidential information and a valid license is required for possession,
 * use or copying. If this work is provided to the U.S. Government,
 * consistent with FAR 12.211 and 12.212, Commercial Computer Software,
 * Computer Software Documentation, and Technical Data for Commercial Items are
 * licensed to the U.S. Government under vendor's standard commercial license.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { setOutput } from '@actions/core';
import { context } from '@actions/github';
import { config } from './config/config.js';
import Logger from './utils/logger.js';
import * as path from 'path';
import GitHubClient from './client/githubClient.js';
import { ExitCode } from './ft/ExitCode.js';
import FtTestExecuter from './ft/FtTestExecuter.js';
import * as fs from 'fs-extra';
import JUnitParser from './reporting/JUnitParser.js';
import { RunType } from './dto/RunType.js';
import { checkoutRepo } from './utils/utils.js';
import AlmLabManager from './alm-lab/almLabManager.js';

const logger: Logger = new Logger('eventHandler');
const JUNIT_RES_XML = 'junit-results.xml';

export const handleCurrentEvent = async (): Promise<void> => {
  logger.info('BEGIN handleEvent ...');

  if (config.logLevel === 2) {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith('GITHUB_') || key.startsWith('RUNNER_')) {
        logger.debug(`${key}=${value}`);
      }
    }
  }

  const event = context.payload;
  const eventName = context.eventName ?? event.name;

  logger.debug("context:", context);
  logger.info(`eventType = ${eventName}`);

  const ref: string | undefined = event.ref;
  let branch: string | undefined;
  if (ref && ref.startsWith('refs/heads/')) {
    branch = ref.slice(11);  // 'refs/heads/' has 11 characters
  } else {
    branch = event.repository?.default_branch ?? event.repository?.master_branch;
  }
  if (!branch) {
    throw new Error('Could not determine branch name!');
  }

  logger.info(`Current repository URL: ${config.repoUrl}`);

  const workDir = process.cwd(); //.env.GITHUB_WORKSPACE || '.';
  logger.info(`Working directory: ${workDir}`);

  let testOrTestSetPaths: string[] = [];
  const runType = config.runType;
  switch (runType) {
    case RunType.FS:
      await checkoutRepo(workDir);
      testOrTestSetPaths = await validateAndGetTestPaths();
      break;
    case RunType.FSParallel:
      throw new Error(`Not yet implemented, runType: ${runType}`);
    case RunType.ALM:
      validateAlmProps();
      testOrTestSetPaths = config.alm!.testSets;
      break;
    case RunType.ALMLab:
      validateAlmLabProps();
      break;
    default:
      throw new Error(`Unsupported runType: ${runType}`);
  }
  const exitCode = await run();
  const status = ExitCode[exitCode] ?? ExitCode[ExitCode.Unknown];

  setOutput('exitCode', `${exitCode}`);
  setOutput('status', status);

  logger.info(`END handleEvent. ExitCode=${exitCode}, Status=${status}`);
  // END of handleCurrentEvent function - the rest are helper functions

  if (exitCode !== ExitCode.Passed && config.failIfNotPassed) {
    throw new Error(`FT run finished with status="${status}", exitCode=${exitCode}`);
  }

  async function run(): Promise<ExitCode> {
    logger.debug(`BEGIN run: ...`);
    const filesToCleanup: string[] = [];
    let reportPaths: string[] = [];
    let exitCode = ExitCode.Unknown;
    try {
      if ([RunType.FS, RunType.ALM].includes(runType)) {
        const { propsFileName, xmlResFileName, encryptionKey } = await FtTestExecuter.preProcess(runType, testOrTestSetPaths);
        filesToCleanup.push(propsFileName, xmlResFileName);
        exitCode = await FtTestExecuter.process(propsFileName, encryptionKey);
        reportPaths = await buildJUnitReport(xmlResFileName);
        filesToCleanup.push(JUNIT_RES_XML);
        await uploadArtifacts(propsFileName, xmlResFileName, JUNIT_RES_XML, reportPaths);
      } else if (runType === RunType.ALMLab) {
        const { propsFileName, xmlResFileName } = await FtTestExecuter.preProcess(runType);
        filesToCleanup.push(propsFileName, xmlResFileName);
        const almLabMgr = new AlmLabManager(xmlResFileName);
        exitCode = await almLabMgr.run();
        filesToCleanup.push(almLabMgr.rptUrlFilePath);
        almLabMgr.runIdFilePath && filesToCleanup.push(almLabMgr.runIdFilePath);
        //TODO buildJUnitReport + uploadArtifacts
        await uploadArtifacts(propsFileName, xmlResFileName);
      }
      logger.info(`END run: ExitCode=${exitCode}.`);
      return exitCode;
    } catch (error) {
      logger.error(`run: ${error}`);
      return ExitCode.Unknown;
    } finally {
      if (config.cleanupTestRunFiles) {
        await cleanupReportFolders(reportPaths);
        await cleanupTempFiles(filesToCleanup.filter((f): f is string => f !== undefined));
      }
      logger.debug(`END run.`);
    }
  }
};

const sanitizeArtifactSegment = (segment: string): string => {
  return segment
    .replace(/[\s\\/:"*?<>|]+/g, '-')  // replace invalid/whitespace chars
    .replace(/-+/g, '-');              // collapse consecutive hyphens
}

const resolveRptArtifactNames = (reportPaths: string[]): Map<string, string> => {
  // Pattern: .../folderX/TestName/ReportX  =>  second-to-last segment is TestName
  // Split and sanitize all path segments upfront for each path
  const segments = reportPaths.map(p => {
    const parts = p.split(/[/\\]/).map(sanitizeArtifactSegment).filter(s => s.length > 0);
    // testName is second-to-last, ancestors are all segments before it (closest first)
    const testNameIdx = parts.length >= 2 ? parts.length - 2 : parts.length - 1;
    const testName = parts[testNameIdx];
    const ancestors = parts.slice(0, testNameIdx).reverse(); // closest ancestor first
    return { p, testName, ancestors };
  });

  // Iteratively build the shortest unique prefix for each path:
  // Start with just testName, keep prepending the next ancestor until all names are unique
  const artifactNames = new Map<string, string>(segments.map(s => [s.p, s.testName]));

  for (let depth = 0; ; depth++) {
    // Group paths by their current candidate name
    const nameToPath = new Map<string, string[]>();
    for (const [p, name] of artifactNames) {
      const group = nameToPath.get(name) ?? [];
      group.push(p);
      nameToPath.set(name, group);
    }

    // Find paths that still share a name with another path
    const stillDuplicated = new Set<string>();
    for (const paths of nameToPath.values()) {
      if (paths.length > 1) {
        paths.forEach(p => stillDuplicated.add(p));
      }
    }

    if (stillDuplicated.size === 0) {
      break; // All names are unique — done
    }

    // For still-duplicated paths, try prepending the next ancestor
    let anyAncestorAvailable = false;
    for (const { p, ancestors } of segments) {
      if (!stillDuplicated.has(p)) continue;
      if (depth < ancestors.length) {
        anyAncestorAvailable = true;
        artifactNames.set(p, `${ancestors[depth]}_${artifactNames.get(p)}`);
      }
    }

    if (!anyAncestorAvailable) {
      // Paths are truly identical — append [1], [2], ... as last resort
      const baseNameIndex = new Map<string, number>();
      for (const p of stillDuplicated) {
        const baseName = artifactNames.get(p)!;
        const idx = (baseNameIndex.get(baseName) ?? 0) + 1;
        baseNameIndex.set(baseName, idx);
        artifactNames.set(p, `${baseName}[${idx}]`);
      }
      break;
    }
  }

  return artifactNames;
}

const uploadArtifacts = async (propsFileName: string, xmlResFileName: string, junitResFileName: string = "", reportPaths: string[] = []) => {
  logger.debug(`uploadArtifacts: "${propsFileName}", "${xmlResFileName}", reportPaths=${reportPaths.length} ...`);

  await Promise.all([
    uploadArtifact(propsFileName, "props-txt"),
    uploadArtifact(xmlResFileName, "summary-results-xml"),
    uploadArtifact(junitResFileName, "junit-results-xml")
  ]);
  if (reportPaths.length) {
    if (config.archiveReportsAsSingleArtifact) {
      logger.debug(`uploadArtifacts: Archiving all reports as a single artifact "ft-reports" ...`);
      await GitHubClient.uploadArtifacts(config.runnerWsPath, reportPaths, "ft-reports")
    } else {
      const rptArtifactNames = resolveRptArtifactNames(reportPaths);
      logger.debug(`uploadArtifacts: Archiving all reports as individual artifacts ...`);
      await Promise.all([
        ...reportPaths.map(p =>
          uploadArtifact(p, `${rptArtifactNames.get(p)!}`)
        )
      ]);
    }
  }
}

const uploadArtifact = async (fileName: string, artifactName: string) => {
  fileName && await GitHubClient.uploadArtifact(config.runnerWsPath, fileName, artifactName);
}

const cleanupTempFiles = async (fileNames: string[]) => {
  logger.debug(`cleanupTempFiles: ${fileNames.join(', ')} ...`);
  await Promise.all(fileNames.map(async (fileName) => {
    if (fileName) {
      const fullPathFile = path.join(config.runnerWsPath, fileName);
      try {
        await fs.promises.rm(fullPathFile, { force: true });
        logger.debug(`cleanupTempFiles: Deleted "${fileName}"`);
      } catch (error) {
        logger.warn(`cleanupTempFiles: Failed to delete "${fullPathFile}": ${error}`);
      }
    }
  }));
  // Find and remove all timestamped files matching pattern: (props|results|params)_ddMMyyyyHHmmssfff.(txt|xml)
  try {
    const entries = await fs.promises.readdir(config.runnerWsPath, { withFileTypes: true });
    const pattern = /^(props|results|params)_\d{17}\.(txt|xml)$/;
    const tempFiles = entries
      .filter(entry => entry.isFile() && pattern.test(entry.name))
      .map(entry => entry.name);

    if (tempFiles.length) {
      await Promise.all(tempFiles.map(async (file) => {
        const fullPath = path.join(config.runnerWsPath, file);
        try {
          await fs.promises.rm(fullPath, { force: true });
          logger.debug(`cleanupTempFiles: Deleted "${file}"`);
        } catch (error) {
          logger.warn(`cleanupTempFiles: Failed to delete "${fullPath}": ${error}`);
        }
      }));
    }
  } catch (error) {
    logger.warn(`cleanupTempFiles: Failed to read directory for cleanup: ${error}`);
  }
}

const cleanupReportFolders = async (reportPaths: string[]) => {
  logger.debug(`cleanupReportFolders: reportPaths.length = ${reportPaths.length} ...`);
  if (reportPaths.length === 0) return;
  await Promise.all(reportPaths.map(async (relativePath) => {
    const fullPath = path.join(config.runnerWsPath, relativePath);
    try {
      logger.debug(`deleting "${fullPath}" ...`);
      await fs.promises.rm(fullPath, { recursive: true, force: true });
    } catch (error) {
      logger.warn(`cleanupReportFolders: Failed to delete "${fullPath}": ${error}`);
    }
  }));
}

const validateAlmProps = (): void => {
  logger.debug(`validateAlmProps ...`);
  const alm = config.alm;
  if (!alm || !alm.testSets || alm.testSets.length === 0) {
    throw new Error(`Missing almTestSets value`);
  }

  validateAlmCommonProps(alm);

  const criteria = alm.testSetsOrderByCriteria;
  const allowedCriterias = ["name", "id"];
  if (!allowedCriterias.includes(criteria)) {
    throw new Error(`Invalid almTestSetRunOrderByCriteria value '${criteria}'. Allowed: ${allowedCriterias.join(', ')}`);
  }
}

const validateAlmLabProps = (): void => {
  logger.debug('validateAlmLabProps ...');
  const almLab = config.almLab;
  if (!almLab) {
    throw new Error('Missing alm-lab configuration');
  }
  if ((Number.isNaN(almLab.testSetId) || almLab.testSetId! <= 0) &&
    (Number.isNaN(almLab.bvsId) || almLab.bvsId! <= 0)) {
    throw new Error('Either "almTestSetId" or "almBvsId" must be a positive integer');
  } else if (almLab.testSetId! > 0 && almLab.bvsId! > 0) {
    throw new Error('Only one of "almTestSetId" or "almBvsId" can be specified');
  }
  if (Number.isNaN(almLab.duration) || almLab.duration <= 0) {
    throw new Error('The value of "almTimeslotDuration" must be a positive integer');
  }
  if (Number.isNaN(almLab.envConfigId) || almLab.envConfigId < 0) {
    throw new Error('The value of "almEnvConfigId" must be a positive integer');
  }

  validateAlmCommonProps(almLab);
}

const validateAlmCommonProps = (alm: {
  serverUrl: string;
  username: string;
  domain: string;
  project: string;
  isSSO: boolean;
  clientId: string;
  apiKeySecret: string;
  runMode: string;
  runHost: string;
}): void => {
  const runMode = alm.runMode;
  const allowedModes = ["LOCAL", "REMOTE", "PLANNED_HOST"];
  if (!allowedModes.includes(runMode)) {
    throw new Error(`Invalid almRunMode value '${runMode}'. Allowed: ${allowedModes.join(', ')}`);
  }
  if (runMode === "REMOTE" && !alm.runHost) {
    throw new Error(`almRunHost is required when almRunMode is '${runMode}'`);
  }

  const urlPattern = /^https?:\/\/[^\/]+\/qcbin\/?$/i;
  if (!urlPattern.test(alm.serverUrl)) {
    throw new Error(`Invalid almServerUrl value '${alm.serverUrl}'. Expected format: http(s)://{hostname-or-ip}[:{port}]/qcbin`);
  }
  if (alm.isSSO) {
    if (!alm.clientId)
      throw new Error(`almClientId is required when almSSOEnabled is true`);
    if (!alm.apiKeySecret)
      throw new Error(`almApiKeySecret is required when almSSOEnabled is true`);
  } else if (!alm.username) {
    throw new Error(`almUsername is required when almSSOEnabled is false`);
  }
  if (!alm.domain) {
    throw new Error(`almDomain is required`);
  }
  if (!alm.project) {
    throw new Error(`almProject is required`);
  }
}

const validateAndGetTestPaths = async (): Promise<string[]> => {
  logger.debug("validateAndGetTestPaths: ...");
  if (!config.testPaths || config.testPaths.length === 0) {
    throw new Error(`Missing testPaths value`);
  }

  // Reject absolute paths — only relative paths based on repository root are allowed
  const absolutePaths = config.testPaths.filter(p => path.isAbsolute(p));
  if (absolutePaths.length > 0) {
    throw new Error(`Absolute paths are not allowed in testPaths. Use paths relative to the repository root:\n${absolutePaths.join('\n')}`);
  }

  // Resolve each relative path against the repository root inside the runner workspace
  const testPaths: string[] = config.testPaths.map(p => path.join(config.repo, p));

  const missing: string[] = testPaths.filter(p => !fs.existsSync(path.resolve(config.runnerWsPath, p)));
  if (missing.length > 0) {
    throw new Error(`The following test paths do not exist:\n${missing.join('\n')}`);
  }

  logger.debug(`validateAndGetTestPaths: resolved test paths:`);
  testPaths.forEach(p => logger.debug(`"${p}"`));
  return testPaths;
}

const buildJUnitReport = async (xmlResFileName: string): Promise<string[]> => {
  logger.info(`buildJUnitReport: from "${xmlResFileName}" ...`);
  const parser = new JUnitParser(xmlResFileName);
  const junitRes = await parser.parseResult();
  logger.debug(`buildJUnitReport: parsed ${junitRes.suites.length} suites.`);
  const reportPaths: string[] = junitRes.suites
    .flatMap(suite => suite.cases)
    .map(c => c.reportPath)
    .filter((p): p is string => !!p);

  const junitFullPath = path.join(config.runnerWsPath, JUNIT_RES_XML);
  await fs.writeFile(junitFullPath, junitRes.toXML());
  logger.debug(`buildJUnitReport: junitFullPath="${junitFullPath}", reportPaths=${reportPaths.length}`);
  return reportPaths;
}
