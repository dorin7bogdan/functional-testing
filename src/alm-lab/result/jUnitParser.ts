import { TestCase, TestSuite } from './testSuites.js';
import TestSuites from './testSuites.js';
import { EntityMap } from '../sdk/util/xml.js';

const TESTSET_NAME = 'testset-name';
const TEST_SUBTYPE = 'test-subtype';
const TESTCYCL_ID = 'testcycl-id';
const TEST_CONFIG_NAME = 'test-config-name';
const DURATION = 'duration';
const START_EXEC_TIME = 'start-exec-time';
const START_EXEC_DATE = 'start-exec-date';
const STATUS = 'status';
const RUN_ID = 'run-id';

const PASSED = 'Passed';
const FAILED = 'Failed';
const NO_RUN = 'No Run';
const ZERO = '0';
const PASS = 'pass';
const FAIL = 'fail';
const ERROR = 'error';

export default class JUnitParser {
  constructor(private readonly entityId: number) {}

  public toModel(testInstanceRuns: EntityMap[], entityName: string, url: string, domain: string, project: string): TestSuites {
    const testSets = this.buildTestSets(testInstanceRuns, entityName, url, domain, project);
    return this.createTestSuites(testSets);
  }

  private createTestSuites(testSets: Map<string, TestSuite>): TestSuites {
    const result = new TestSuites();
    result.items.push(...testSets.values());

    const totalTests = result.items.reduce((sum, s) => sum + s.testCases.length, 0);
    const totalFailures = result.items.reduce((sum, s) => sum + Number.parseInt(s.failures ?? '0', 10), 0);
    const totalErrors = result.items.reduce((sum, s) => sum + Number.parseInt(s.errors ?? '0', 10), 0);

    result.tests = `${totalTests}`;
    result.failures = `${totalFailures}`;
    result.errors = `${totalErrors}`;
    return result;
  }

  private buildTestSets(testInstanceRuns: EntityMap[], rootEntityName: string, url: string, domain: string, project: string): Map<string, TestSuite> {
    const testSets = new Map<string, TestSuite>();

    for (const entity of testInstanceRuns) {
      const testSetId = entity[TESTCYCL_ID] ?? '';
      let testSuite = testSets.get(testSetId);
      if (!testSuite) {
        testSuite = new TestSuite();
        testSuite.name = this.getTestSetName(entity, rootEntityName);
        testSuite.tests = '0';
        testSuite.failures = '0';
        testSuite.errors = '0';
        testSets.set(testSetId, testSuite);
      }

      const testCase = this.getTestCase(entity, rootEntityName, url, domain, project);
      testSuite.testCases.push(testCase);
      testSuite.tests = `${testSuite.testCases.length}`;

      if (testCase.failures.length > 0) {
        testSuite.failures = `${Number.parseInt(testSuite.failures ?? '0', 10) + 1}`;
      }
      if (testCase.errors.length > 0) {
        testSuite.errors = `${Number.parseInt(testSuite.errors ?? '0', 10) + 1}`;
      }
    }

    return testSets;
  }

  private getTestCase(entity: EntityMap, rootEntityName: string, url: string, domain: string, project: string): TestCase {
    const testCase = new TestCase();
    testCase.classname = this.getTestSetName(entity, rootEntityName);
    testCase.name = this.getTestName(entity);
    testCase.time = this.getTime(entity);
    testCase.startExecDateTime = this.getTimestamp(entity);
    testCase.type = entity[TEST_SUBTYPE] ?? '';

    this.updateStatus(testCase, entity, url, domain, project);
    return testCase;
  }

  private getTestSetName(entity: EntityMap, rootEntityName: string): string {
    const testSetName = entity[TESTSET_NAME];
    if (testSetName?.trim()) {
      return `${rootEntityName} (id:${this.entityId}).${testSetName}`;
    }
    return `${rootEntityName}.(Unnamed test set)`;
  }

  private getTestName(entity: EntityMap): string {
    const testName = entity[TEST_CONFIG_NAME];
    return testName?.trim() ? testName : 'Unnamed test';
  }

  private getTime(entity: EntityMap): string {
    const time = entity[DURATION];
    return time?.trim() ? time : ZERO;
  }

  private getTimestamp(entity: EntityMap): string {
    const date = entity[START_EXEC_DATE] ?? '';
    const time = entity[START_EXEC_TIME] ?? '';
    return `${date} ${time}`.trim();
  }

  private updateStatus(testCase: TestCase, entity: EntityMap, url: string, domain: string, project: string): void {
    const status = entity[STATUS] ?? '';
    testCase.status = this.getAzureStatus(status);
    const link = this.getTestInstanceRunLink(entity, url, domain, project);

    if (testCase.status === ERROR) {
      testCase.errors.push({ message: `${status}. ${link}`.trim() });
    } else if (testCase.status === FAIL) {
      testCase.failures.push({ message: `${status}. ${link}`.trim() });
    }
  }

  private getTestInstanceRunLink(entity: EntityMap, url: string, domain: string, project: string): string {
    const runId = entity[RUN_ID];
    if (!runId?.trim()) {
      return '';
    }

    try {
      const host = new URL(url).hostname;
      return `To see the test instance run in ALM, go to: td://${project}.${domain}.${host}:8080/qcbin/[TestRuns]?EntityLogicalName=run&EntityID=${runId}`;
    } catch {
      return '';
    }
  }

  private getAzureStatus(status: string): string {
    switch (status) {
      case PASSED:
        return PASS;
      case NO_RUN:
        return ERROR;
      case FAILED:
        return FAIL;
      default:
        return status;
    }
  }
}
