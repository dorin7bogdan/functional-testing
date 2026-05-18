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
import * as path from 'path';
import { promises as fs } from 'fs';
import Logger from '../utils/logger.js';
import { ExitCode } from './ExitCode.js';
import FTL from './FTL.js';
import { checkFileExists, checkReadWriteAccess, escapePropVal, getTimestamp, toBase64 } from '../utils/utils.js';
import { config } from '../config/config.js';
import { RunType } from '../dto/RunType.js';
import { AlmRunMode } from '../dto/AlmRunMode.js';

const logger = new Logger('FtTestExecuter');

export default class FtTestExecuter {
  public static async preProcess(runType: RunType, testOrTestSetPaths: string[]): Promise<{ propsFileName: string, xmlResFileName: string }> {
    logger.debug(`preProcess ...`);
    await checkReadWriteAccess(config.runnerWsPath);
    const suffix = getTimestamp();
    const isParallel = runType === RunType.FSParallel;
    if (runType === RunType.FS || runType === RunType.FSParallel) {
      return await this.createFSProps(FTL.FileSystem, suffix, testOrTestSetPaths, isParallel);
    } else if (runType === RunType.ALM) {
      return await this.createAlmProps(FTL.Alm, suffix, testOrTestSetPaths);
    }
    return { propsFileName: '', xmlResFileName: '' };
  }

  public static async process(propsFileName: string): Promise<ExitCode> {
    logger.debug(`process: propsFileName = "${propsFileName}" ...`);
    const propsFullPath = path.join(config.runnerWsPath, propsFileName);
    await checkFileExists(propsFullPath);
    await checkReadWriteAccess(config.runnerWsPath);
    await FTL.ensureToolExists();
    const exitCode = await FTL.runTool(propsFullPath);
    logger.debug(`process: exitCode=${exitCode}`);
    return exitCode;
  }

  private static async createFSProps(runtype: string, suffix: string, testPaths: string[], isParallel: boolean = false): Promise<{ propsFileName: string, xmlResFileName: string }> {
    const propsFileName = `props_${suffix}.txt`;
    const xmlResFileName = `results_${suffix}.xml`;
    const propsFullPath = path.join(config.runnerWsPath, propsFileName);

    logger.debug(`createFSProps: "${propsFileName}" ...`);

    const props: { [key: string]: string } = {
      runType: runtype,
      resultsFilename: xmlResFileName,
      cancelRunOnFailure: `${config.cancelRunOnFailure}`,
      resultTestNameOnly: `${config.resultTestNameOnly}`,
      resultUnifiedTestClassname: `${config.resultUnifiedTestClassname}`
    };
    for (let i = 0; i < testPaths.length; i++) {
      const key = `Test${i + 1}`;
      props[key] = escapePropVal(testPaths[i]);
    }

/*    if (config.labUrl && config.labExecToken) {
      props["MobileHostAddress"] = config.labUrl;
      props["MobileExecToken"] = config.labExecToken;
    }*/
    await this.writePropsFile(props, propsFullPath);

    return { propsFileName, xmlResFileName };
  }

  private static async createAlmProps(runtype: string, suffix: string, testSets: string[]): Promise<{ propsFileName: string, xmlResFileName: string }> {
    const propsFileName = `props_${suffix}.txt`;
    const xmlResFileName = `results_${suffix}.xml`;
    const propsFullPath = path.join(config.runnerWsPath, propsFileName);
    const runMode = AlmRunMode[config.almRunMode as keyof typeof AlmRunMode];
    logger.debug(`createAlmProps: "${propsFileName}" ...`);

    const props: { [key: string]: string } = {
      runType: runtype,
      almServerUrl: config.almServerUrl,
      almUsername: config.almUsername,
      almPasswordBasicAuth: toBase64(config.almPassword),
      almDomain: config.almDomain,
      almProject: config.almProject,
      SSOEnabled: `${config.almSSOEnabled}`,
      almClientId: config.almClientId,
      almApiKeySecretBasicAuth: toBase64(config.almApiKeySecret),
      almRunMode: `${runMode}`,
      almRunHost: config.almRunHost,
      almTimeout: `${config.almTimeout}`,
      resultsFilename: xmlResFileName,
      resultTestNameOnly: `${config.resultTestNameOnly}`, // TODO review is applicable for ALM run?
      resultUnifiedTestClassname: `${config.resultUnifiedTestClassname}` // TODO review is applicable for ALM run?
    };
    for (let i = 0; i < testSets.length; i++) {
      const key = `TestSet${i + 1}`;
      props[key] = escapePropVal(testSets[i]);
    }

    await this.writePropsFile(props, propsFullPath);
    return { propsFileName, xmlResFileName };
  }

  private static async writePropsFile(props: { [key: string]: string }, propsFullPath: string): Promise<void> {
    try {
      await fs.writeFile(propsFullPath, Object.entries(props).map(([k, v]) => `${k}=${v}`).join('\n'));
    } catch (error: any) {
      logger.error(`writePropsFile: ${error.message}`);
      throw new Error('Failed when creating properties file');
    }
  }
}