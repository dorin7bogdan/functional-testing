# 1. Introduction

The **OpenText Functional Testing GitHub Action** enables GitHub repositories to execute OpenText Functional Testing (FT/UFT One) tests as part of GitHub Actions workflows. It provides a simple and flexible way to integrate automated functional testing into CI/CD pipelines.

The action supports multiple execution modes:

- **File System** execution of GUI and API tests stored in the repository.
- **ALM** execution of test sets managed in OpenText ALM.
- **ALM Lab Management** execution of Functional Test Sets and Build Verification Suites (BVS) managed in ALM Lab Management.

Using this action, development and QA teams can:

- Trigger automated functional test runs directly from GitHub Actions.
- Execute tests stored in source control repositories.
- Run ALM-managed test sets and suites.
- Publish and archive execution results as workflow artifacts.
- Automatically trigger test runs following pull requests, builds, and release pipelines. In this case make sure the target tests are defined before the source event occurs.

---

# 2. Table of Contents

- [1. Introduction](#1-introduction)
- [2. Table of Contents](#2-table-of-contents)
- [3. Requirements](#3-requirements)
- [4. GitHub Workflow Setup](#4-github-workflow-setup)
   - [4.1 Workflow Creation](#41-workflow-creation)
   - [4.2 Full YAML Examples](#42-full-yaml-examples)
    - [4.2.1 MTBX File Usage (`runType: filesystem`)](#421-mtbx-file-usage-runtype-filesystem)
   - [4.3 Workflow Parameters](#43-workflow-parameters)
   - [4.4 Debugging](#44-debugging)
   - [4.5 Outputs](#45-outputs)
   - [4.6 Workspace and File Management](#46-workspace-and-file-management)
- [5. Running FT Tests](#5-running-ft-tests)
  - [5.1. GitHub self-hosted runner](#51-github-self-hosted-runner)
  - [5.2. Run the Workflow](#52-run-the-workflow)
- [6. Limitations](#6-limitations)


# 3. Requirements

Before using this action, ensure the following prerequisites are met.

## Software Requirements

- GitHub repository with GitHub Actions enabled.
- OpenText Functional Testing (UFT One) installed on the execution machine.
- Windows-based runner capable of executing FT tests.
- For ALM testing the ALM Client Launcher is required to be installed on the self-hosted runner. 
    - For more details please check
https://admhelp.microfocus.com/alm/en/latest/online_help/Content/ALM_Client_launcher/ALM_Client_launcher.htm. 
    - About how to register the client components please check https://admhelp.microfocus.com/alm/ALM_Client_Launcher/ALM_Client_Launcher_Guide.pdf.
- For ALM Lab Management testing the Lab Service must be installed on the execution host. 
    - For more details please check https://admhelp.microfocus.com/alm/en/latest/online_help/Content/LM/menu_lab_service_agent.htm.

## Runner Requirements

The action is primarily intended for:

- GitHub self-hosted Windows runners.
- Machines capable of launching OpenText Functional Testing tests.

## Authentication Requirements

### GitHub

For File System executions (`runType: filesystem`), provide a GitHub token:

```yaml
githubToken: ${{ secrets.GITHUB_TOKEN }}
```
The built-in `${{ secrets.GITHUB_TOKEN }}` is automatically available to GitHub Actions workflows, so creating a Personal Access Token (PAT) is typically not required.
The GitHub token is used to clone the repository content.

For File System and ALM executions (`runType: filesystem` and `runType: alm`), the action downloads and uses `FTToolsLauncher.exe` to intermediate the execution of the tests from the generated parameter file. If `FTToolsLauncher.exe` is not already present in the runner workspace, it is downloaded automatically from the official release link by default:

https://github.com/MicroFocus/ADM-FT-ToolsLauncher/releases/download/v26.3.0/FTToolsLauncher_net48.exe

### ALM Authentication

For ALM and ALM Lab executions, valid ALM credentials are required:

```yaml
almServerUrl
almUsername
almPassword
almDomain
almProject
```

Alternatively, SSO authentication can be used:

```yaml
almSSOEnabled: true
almClientId
almApiKeySecret
```

## Supported Run Types

| Run Type | Description |
|-----------|-------------|
| `filesystem` | Executes tests stored in the GitHub repository. |
| `alm` | Executes ALM Test Sets. |
| `alm-lab` | Executes ALM Functional Test Sets or Build Verification Suites (BVS). |

Default:

```yaml
runType: filesystem
```

---

# 4. GitHub Workflow Setup

This section explains how to create and configure GitHub Actions workflows for executing OpenText Functional Testing tests.

The action supports three execution modes:

- **File System** (`filesystem`)
- **ALM Test Sets** (`alm`)
- **ALM Lab Management** (`alm-lab`)

## 4.1 Workflow Creation

Create a workflow file under:

```text
.github/workflows/
```

The action is designed to be executed manually using the GitHub `workflow_dispatch` trigger. This allows users to provide test paths, ALM test sets, or ALM Lab identifiers when starting a workflow run.

Example:

```yaml
on:
  workflow_dispatch:
```

The workflow should run on a self-hosted runner where OpenText Functional Testing is installed.

```yaml
jobs:
  ft_integration_job:
    runs-on: [self-hosted, windows]
```

---

## 4.2 Full YAML Examples

### File System Execution

Run Functional Testing tests stored in the GitHub repository.

The action downloads and uses `FTToolsLauncher.exe` on the runner to execute File System test runs.

```yaml
name: FT-integration

on:
  workflow_dispatch:
    inputs:
      testPaths:
        description: 'Test path(s)'
        required: true

permissions:
  contents: read

jobs:
  ft_integration_job:
    runs-on: [self-hosted, windows]

    steps:
      - name: FT Integration
        uses: opentext/functional-testing@v26.3.0
        id: ft-integration
        with:
          runType: filesystem
          testPaths: ${{ inputs.testPaths }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

### ALM Test Set Execution

Run tests managed in OpenText ALM.

The action downloads and uses `FTToolsLauncher.exe` on the runner to execute ALM test set runs.

```yaml
name: FT-integration-ALM

on:
  workflow_dispatch:
    inputs:
      testSets:
        description: 'Test set(s)'
        required: true

env:
  NODE_TLS_REJECT_UNAUTHORIZED: 0   # only if the almServerUrl uses HTTP or a self-signed ALM certificate

jobs:
  ft_integration_alm:
    runs-on: [self-hosted, windows]

    steps:
      - name: FT Integration ALM
        uses: opentext/functional-testing@v26.3.0
        id: ft-integration-alm
        with:
          runType: alm
          almTestSets: ${{ inputs.testSets }}
          almServerUrl: http://<alm-server>:8080/qcbin
          almUsername: ${{ secrets.ALM_USERNAME }}
          almPassword: ${{ secrets.ALM_PASSWORD }}
          almDomain: AUTOMATION
          almProject: CI_Integration
```

### ALM Lab Management Execution

Run Functional Test Sets or Build Verification Suites (BVS) managed by ALM Lab Management.

This action does not use `FTToolsLauncher.exe`.

```yaml
name: FT-integration-ALM-Lab

on:
  workflow_dispatch:
    inputs:
      testSetId:
        description: 'Test Set ID'
        required: true

env:
  NODE_TLS_REJECT_UNAUTHORIZED: 0   # only if the almServerUrl uses HTTP or a self-signed ALM certificate

jobs:
  ft_integration_alm_lab:
    runs-on: [self-hosted, windows]

    steps:
      - name: FT Integration ALM Lab Management
        uses: opentext/functional-testing@v26.3.0
        id: ft-integration-alm-lab
        with:
          runType: alm-lab
          almTestSetId: ${{ inputs.testSetId }}
          almServerUrl: http://<alm-server>:8080/qcbin
          almUsername: ${{ secrets.ALM_USERNAME }}
          almPassword: ${{ secrets.ALM_PASSWORD }}
          almDomain: AUTOMATION
          almProject: CI_Integration
```
---

### 4.2.1 MTBX File Usage (`runType: filesystem`)

If you want to run tests using an MTBX file, create a `.mtbx` file and save it in your current repository, then pass its relative path in `testPaths`.

Example workflow input:

```yaml
with:
  runType: filesystem
  testPaths: path\to\tests.mtbx
  githubToken: ${{ secrets.GITHUB_TOKEN }}
```

Sample MTBX file:

```xml
<Mtbx>
    <Test name="Pass" path="uft-one-tests\Quicks\QuickPass"></Test>
    <Test name="Warn" path="uft-one-tests\Quicks\QuickWarn"></Test>
    <Test name="Fail" path="uft-one-tests\Quicks\QuickFail"></Test>
    <Test name="Error" path="uft-one-tests\Quicks\QuickError"></Test>
</Mtbx>
```

Notes:

- The MTBX file must be stored in the same GitHub repository where the workflow runs.
- Each `path` value inside the MTBX file must be relative to the organization/user root.
- In the sample above, `uft-one-tests` is the repository name (for example: `https://github.com/MicroFocus/uft-one-tests`), so test paths start with `uft-one-tests\...`.
- Standard MTBX reference: https://github.com/MicroFocus/ADM-FT-ToolsLauncher#mtbx-file-refs

---

## 4.3 Workflow Parameters

The source of truth for parameters is [`action.yml`](./action.yml). The following tables mirror it.

### Global parameters

| Parameter | Required | Default | Description |
|------------|----------|---------|-------------|
| `runType` | No | `filesystem` | Type of run: `filesystem`, `alm`, `alm-lab`. |

### File system parameters (`runType: filesystem`)

| Parameter | Required | Default | Description |
|------------|----------|---------|-------------|
| `testPaths` | Yes | - | Relative test folder\test\`.mtbx` path, or JSON array of paths. Absolute paths are not allowed. |
| `timeout` | No | `""` | Timeout in seconds. |
| `cancelRunOnFailure` | No | `false` | Cancel run on first failure. |
| `githubToken` | Yes | - | GitHub token/PAT. |

### ALM connection parameters (`runType: alm` and `runType: alm-lab`)

| Parameter | Required | Default | Description |
|------------|----------|---------|-------------|
| `almServerUrl` | Yes | - | ALM URL in the form `http(s)://host[:port]/qcbin`. |
| `almSSOEnabled` | No | `false` | Use SSO login mode. |
| `almUsername` | Yes/No | - | Required when `almSSOEnabled: false`. |
| `almPassword` | Yes/No | - | Required when `almSSOEnabled: false`. |
| `almClientId` | Yes/No | - | Required when `almSSOEnabled: true`. |
| `almApiKeySecret` | Yes/No | - | Required when `almSSOEnabled: true`. |
| `almDomain` | Yes | - | ALM domain. |
| `almProject` | Yes | - | ALM project. |

### Classic ALM run parameters (`runType: alm`)

| Parameter | Required | Default | Description |
|------------|----------|---------|-------------|
| `almTestSets` | Yes (for `alm`) | - | Test set/folder path, or JSON array of paths. |
| `almTimeout` | No | `-1` | Timeout in seconds (`-1` = no timeout). |
| `almTestSetsOrderByCriteria` | No | `name` | Sort order for test set execution: `id` or `name`. |
| `almRunMode` | No | `LOCAL` | `LOCAL`, `REMOTE`, or `PLANNED_HOST`. |
| `almRunHost` | Yes/No | - | Required when `almRunMode: REMOTE`. |

### ALM Lab Management run parameters (`runType: alm-lab`)

| Parameter | Required | Default | Description |
|------------|----------|---------|-------------|
| `almTestSetId` | Yes* | - | Functional Test Set ID. |
| `almBvsId` | Yes* | - | BVS ID. |
| `almTimeslotDuration` | No | `30` | Lab timeslot duration in minutes (minimum 30). |
| `almEnvConfigId` | No | `0` | Environment configuration ID. |

**\* For `alm-lab`, provide either `almTestSetId` or `almBvsId`.**

### Common execution/result parameters

| Parameter | Required | Default | Description |
|------------|----------|---------|-------------|
| `resultTestNameOnly` | No | `true` | Output only test names in results summary (`runType: filesystem \| alm`). |
| `resultUnifiedTestClassname` | No | `false` | Use consistent JUnit classname format (`runType: filesystem \| alm`). |
| `ftlUrl` | No | [FTToolsLauncher v26.3.0](https://github.com/MicroFocus/ADM-FT-ToolsLauncher/releases/download/v26.3.0/FTToolsLauncher_net48.exe) | Download URL for `FTToolsLauncher.exe` when it is not already present on the runner (`runType: filesystem \| alm`). |
| `archiveReportsAsSingleArtifact` | No | `false` | Upload reports as one artifact instead of per test. |
| `logLevel` | No | `3` | Logging level `1-5` (`1=trace ... 5=error`). |
| `cleanupTestRunFiles` | No | `true` | Delete test run files and reports after execution. |
| `failIfNotPassed` | No | `true` | Fail workflow step if final status is not `Passed`. |

## 4.4 Debugging

- Set `logLevel: "1"` or `logLevel: "2"` for more verbose logs.
- Set `cleanupTestRunFiles: "false"` when troubleshooting so run files and reports remain on the runner.
- If using HTTP or self-signed ALM certificates, use:

```yaml
env:
  NODE_TLS_REJECT_UNAUTHORIZED: 0
```

Use this only when required by your environment.

## 4.5 Outputs

The action exposes:

| Output | Description |
|--------|-------------|
| `exitCode` | FT process exit code |
| `status` | FT final status: `Passed`, `Failed`, `Unstable`, `Aborted`, or `Unknown` |

## 4.6 Workspace and File Management

- When using `runType: filesystem`, the repository is cloned on the local GitHub self-hosted runner machine.
- When using `runType: alm | alm-lab`, the repository is not cloned.
- During execution, the action creates temporary runtime files in the runner workspace (for example `props_###.txt` or `params_###.xml`) mostly used by `FTToolsLauncher.exe`.
- Test results and reports are stored in the runner workspace too.
- File handling is controlled by `cleanupTestRunFiles`:
  - `true` (default): remove run files and reports (excepting `FTToolsLauncher.exe`) at the end of execution.
  - `false`: keep run files and reports for troubleshooting purposes.
- By design, all file operations stay inside the runner workspace, for security reasons.
- All run files and reports are uploaded to GitHub Actions as workflow artifacts, and can be downloaded from the workflow run summary page.

## 5. Running FT Tests

### 5.1. GitHub self-hosted runner

- After completing the configuration, make sure the desired GitHub self-hosted runner is active, from GitHub **Settings -> Actions -> Runners**
- To set up a GitHub self-hosted runner, follow the instructions provided in GitHub's documentation:
  1. Visit the Adding self-hosted runners guide: https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners
  2. Understand the prerequisites and select the machine you will use for your self-hosted runner.
  3. Follow the steps to add a self-hosted runner at the repository, organization, or enterprise level.
- If you'd like to learn more about self-hosted runners, their configuration, and management, see the following resources:
    - Managing self-hosted runners: https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners
    - About self-hosted runners: https://docs.github.com/en/actions/concepts/runners/self-hosted-runners

### 5.2. Run the Workflow

- After completing configuration, run the workflow manually from the GitHub **Actions** tab.
- Monitor progress in real time in the workflow logs.

## 6. Limitations

1. One self-hosted GitHub runner is required to execute the integration workflow.
2. Multiple YML workflows/actions can be created/used per GitHub repository, but it's recommended to use the same branch for all FT actions. An attempt to use a second branch can lead to unexpected results / errors.
3. When using `runType: filesystem`, only tests that are stored in the cloned GitHub repository can be executed. Tests located elsewhere on the runner machine are not supported. All `testPaths` values must reference files or folders within the repository and must be specified as paths relative to the repository root.
4. When using `runType: alm` or `runType: alm-lab`, tests are executed directly from OpenText ALM / ALM Lab Management. Repository test assets are not cloned, accessed, or used as part of the test execution. The GitHub repository is only used to host and run the workflow definition.
5. Running parameterized FileSystem tests is supported only through MTBX files.
6. Running parameterized ALM Test Sets is currently not supported.
7. Running Functional Testing Lab (formerly Digital Lab) tests is currently not supported.
8. Running Parallel tests is currently not supported.