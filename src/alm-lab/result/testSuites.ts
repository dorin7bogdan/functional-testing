import { escapeXML } from '../../utils/utils.js';

export class TestCase {
  public errors: Array<{ type?: string; message?: string }> = [];
  public failures: Array<{ type?: string; message?: string }> = [];
  public systemOuts: string[] = [];
  public systemErrs: string[] = [];
  public name = '';
  public assertions?: string;
  public time?: string;
  public startExecDateTime?: string;
  public classname?: string;
  public status?: string;
  public type?: string;
  public report?: string;
}

export class TestSuite {
  public testCases: TestCase[] = [];
  public name = '';
  public tests = '';
  public failures?: string;
  public errors?: string;
  public time?: string;
  public disabled?: string;
  public skipped?: string;
  public timestamp?: string;
  public hostname?: string;
  public id?: string;
  public package?: string;
}

export default class TestSuites {
  public items: TestSuite[] = [];
  public name?: string;
  public time?: string;
  public tests?: string;
  public failures?: string;
  public disabled?: string;
  public errors?: string;

  public toXML(): string {
    const attrs = [
      this.attr('name', this.name),
      this.attr('time', this.time),
      this.attr('tests', this.tests),
      this.attr('failures', this.failures),
      this.attr('disabled', this.disabled),
      this.attr('errors', this.errors)
    ].filter(Boolean).join('');

    const suitesXml = this.items.map((suite) => {
      const suiteAttrs = [
        this.attr('name', suite.name),
        this.attr('tests', suite.tests),
        this.attr('failures', suite.failures),
        this.attr('errors', suite.errors),
        this.attr('time', suite.time),
        this.attr('disabled', suite.disabled),
        this.attr('skipped', suite.skipped),
        this.attr('timestamp', suite.timestamp),
        this.attr('hostname', suite.hostname),
        this.attr('id', suite.id),
        this.attr('package', suite.package)
      ].filter(Boolean).join('');

      const casesXml = suite.testCases.map((tc) => {
        const caseAttrs = [
          this.attr('name', tc.name),
          this.attr('assertions', tc.assertions),
          this.attr('time', tc.time),
          this.attr('startExecDateTime', tc.startExecDateTime),
          this.attr('classname', tc.classname),
          this.attr('status', tc.status),
          this.attr('type', tc.type),
          this.attr('report', tc.report)
        ].filter(Boolean).join('');

        const errorsXml = tc.errors.map((e) => `<error${this.attr('type', e.type)}${this.attr('message', e.message)}/>`).join('');
        const failuresXml = tc.failures.map((f) => `<failure${this.attr('type', f.type)}${this.attr('message', f.message)}/>`).join('');
        const outXml = tc.systemOuts.map((line) => `<system-out>${escapeXML(line)}</system-out>`).join('');
        const errXml = tc.systemErrs.map((line) => `<system-err>${escapeXML(line)}</system-err>`).join('');

        return `<testcase${caseAttrs}>${errorsXml}${failuresXml}${outXml}${errXml}</testcase>`;
      }).join('');

      return `<testsuite${suiteAttrs}>${casesXml}</testsuite>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?><testsuites${attrs}>${suitesXml}</testsuites>`;
  }

  private attr(name: string, value?: string): string {
    if (!value) {
      return '';
    }
    return ` ${name}="${escapeXML(value)}"`;
  }
}
