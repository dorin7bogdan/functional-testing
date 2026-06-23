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

import { context } from '@actions/github';
import { getInput } from '@actions/core';
import { AlmCommonConfig, AlmConfig, AlmLabConfig }  from './almConfig.js';
import { RunType } from '../dto/RunType.js';

interface Config {
  runType: RunType; // filesystem | filesystem-parallel | alm | alm-lab
  testPaths?: string[];
  timeout?: number;
  cancelRunOnFailure?: boolean;
  resultTestNameOnly: boolean;
  resultUnifiedTestClassname: boolean;
  githubToken?: string;
  alm?: AlmConfig;
  almLab?: AlmLabConfig;
  owner: string;
  repo: string;
  repoUrl: string;
  ftlUrl: string;
  archiveReportsAsSingleArtifact: boolean;
  logLevel: number;
  cleanupTestRunFiles: boolean;
  runnerWsPath: string; // Path to the workspace directory process.env.RUNNER_WORKSPACE!
  failIfNotPassed: boolean;
}

const serverUrl = context.serverUrl;
const { owner, repo } = context.repo;
const quotesRegex = /^['"]+|['"]+$/g;
if (!serverUrl || !owner || !repo) {
  throw new Error('Event should contain repository details!');
}

let _config: Config | undefined;
let errorLoadingConfig: string;

const getUnquotedInput = (key: string, defaultValue?: string): string => {
  const value = getInput(key); // trimmed by default
  if (value) {
    return value.replace(quotesRegex, '').trim();
  } else if (defaultValue !== undefined) {
    return defaultValue;
  } else {
    return "";
  }
}

const getUnquotedInputEx = (key: string): string[] => {
  const value = getInput(key); // trimmed by default
  if (value) {
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new Error(`Invalid JSON format for input '${key}': ${error}`);
      }
    } else {
      return value.replace(quotesRegex, '').trim().split('\n').filter(p => p.length > 0);
    }
  } else {
    return [];
  }
}

const RUN_TYPE_MAP: Record<string, RunType> = {
  'filesystem': RunType.FS,
  'filesystem-parallel': RunType.FSParallel,
  'alm': RunType.ALM,
  'alm-lab': RunType.ALMLab
};

const validateAndGetRunType = (): RunType => {
  const raw = getUnquotedInput('runType', 'filesystem');
  const runType = RUN_TYPE_MAP[raw];

  if (runType === undefined) {
    throw new Error(`Invalid runType value '${raw}'. Allowed: ${Object.keys(RUN_TYPE_MAP).join(', ')}`);
  }
  return runType;
}

try {
  _config = {
    runType: validateAndGetRunType(),
    resultTestNameOnly: getInput('resultTestNameOnly').toLowerCase() === 'true',
    resultUnifiedTestClassname: getInput('resultUnifiedTestClassname').toLowerCase() === 'true',
    archiveReportsAsSingleArtifact: getInput('archiveReportsAsSingleArtifact').toLowerCase() === 'true',
    githubToken: getInput('githubToken'),
    owner: owner,
    repo: repo,
    repoUrl: `${serverUrl}/${owner}/${repo}.git`,
    ftlUrl: getInput('ftlUrl'),
    logLevel: Number.parseInt(getInput('logLevel')),
    cleanupTestRunFiles: getInput('cleanupTestRunFiles').toLowerCase() === 'true',
    failIfNotPassed: getInput('failIfNotPassed').toLowerCase() === 'true',
    runnerWsPath: process.env.RUNNER_WORKSPACE! // e.g., C:\GitHub_runner\_work\ufto-tests\
  };
  if (_config.runType === RunType.FS) {
    _config = {
      testPaths: getUnquotedInputEx('testPaths'),
      timeout: Number.parseInt(getInput('timeout')),
      cancelRunOnFailure: getInput('cancelRunOnFailure').toLowerCase() === 'true',
      ..._config
    }
  } else if (_config.runType === RunType.ALM || _config.runType === RunType.ALMLab) {
    const almCommConfig = {
      serverUrl: getInput('almServerUrl'),
      username: getInput('almUsername'),
      password: getInput('almPassword'),
      domain: getInput('almDomain'),
      project: getInput('almProject'),
      isSSO: getInput('almSSOEnabled').toLowerCase() === 'true',
      clientId: getInput('almClientId'),
      apiKeySecret: getInput('almApiKeySecret'),
      runMode: getInput('almRunMode').toUpperCase(),
      runHost: getInput('almRunHost'),
      timeout: Number.parseInt(getInput('almTimeout'))
    }
    if (_config.runType === RunType.ALM) {
      _config.alm = {
        testSets: getUnquotedInputEx('almTestSets'),
        testSetsOrderByCriteria: getInput('almTestSetsOrderByCriteria'),
        ...almCommConfig
      }
    } else if (_config.runType === RunType.ALMLab) {
      _config.almLab = {
        testSetId: Number.parseInt(getInput('almTestSetId')),
        bvsId: Number.parseInt(getInput('almBvsId')),
        duration: Number.parseInt(getInput('almTimeslotDuration')),
        envConfigId: Number.parseInt(getInput('almEnvConfigId')),
        ...almCommConfig
      }
    }
  }
} catch (error: any) {
  errorLoadingConfig = error.message;
}

const getConfig = (): Config => {
  if (!_config && errorLoadingConfig) {
    throw { message: errorLoadingConfig };
  } else if (!_config) {
    throw { message: 'Config could not be loaded.' };
  }
  return _config;
};

const config = getConfig();

export { config };
