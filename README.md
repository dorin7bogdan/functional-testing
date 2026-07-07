# 1. Introduction 🚀

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
- Integrate quality gates into pull requests, builds, and release pipelines.
- Support continuous testing throughout the software delivery lifecycle.

---

# 2. Table of Contents

[1. Introduction](#1-introduction)
[2. Table of Contents](#2-table-of-contents)
[3. Requirements](#3-requirements)
[4. GitHub Workflow Setup](#4-github-workflow-setup)
   - [4.1 Workflow Creation](#41-workflow-creation)
   - [4.2 Full YAML Examples](#42-full-yaml-examples)
   - [4.3 Workflow Parameters](#43-workflow-parameters)
   - [4.4 Debugging](#44-debugging)
[5. Running FT Tests](#5-running-ft-tests)
  - [5.1. GitHub self-hosted runner](#51-gitHub-self-hosted-runner)
  - [5.2. Run the Workflow](#52-run-the-workflow)
[6. Limitations](#6-limitations)


# 3. Requirements

Before using this action, ensure the following prerequisites are met.

## Software Requirements

- GitHub repository with GitHub Actions enabled.
- OpenText Functional Testing (UFT One) installed on the execution machine.
- Windows-based runner capable of executing FT tests.
- Access to the FT test assets or ALM project resources to be executed.

## Runner Requirements

The action is primarily intended for:

- GitHub self-hosted Windows runners.
- Machines capable of launching OpenText Functional Testing tests.

## Authentication Requirements

### GitHub

A GitHub Personal Access Token (PAT) or GitHub token must be provided:

```yaml
githubToken: ${{ secrets.GITHUB_TOKEN }}
```

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
    runs-on: [self-hosted]
```

---

## 4.2 Full YAML Examples

### File System Execution

Run Functional Testing tests stored in the GitHub repository.

```yaml
name: FT-integration

on:
  workflow_dispatch:
    inputs:
      testPaths:
        description: 'Test path(s)'
        required: true

permissions:
  actions: read
  contents: read

jobs:
  ft_integration_job:
    runs-on: [self-hosted]

    steps:
      - name: FT Integration
        uses: opentext/functional-testing@v26.3.0
        id: ft-integration
        with:
          testPaths: ${{ inputs.testPaths }}
          githubToken: ${{ secrets.GITHUB_TOKEN }}
```

### ALM Test Set Execution

Run tests managed in OpenText ALM.

```yaml
name: FT-integration-ALM

on:
  workflow_dispatch:
    inputs:
      testSets:
        description: 'Test set(s)'
        required: true

permissions:
  actions: read
  contents: read

env:
  NODE_TLS_REJECT_UNAUTHORIZED: 0

jobs:
  ft_integration_alm:
    runs-on: [self-hosted]

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

```yaml
name: FT-integration-ALM-Lab

on:
  workflow_dispatch:
    inputs:
      testSetId:
        description: 'Test Set ID'
        required: true

permissions:
  actions: read
  contents: read

env:
  NODE_TLS_REJECT_UNAUTHORIZED: 0

jobs:
  ft_integration_alm_lab:
    runs-on: [self-hosted]

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

## 4.3 Workflow Parameters

### File System Parameters

| Parameter | Required | Description |
|------------|----------|-------------|
| `testPaths` | Yes | Relative path to a test folder, individual test, or MTBX file. |
| `githubToken` | Yes | GitHub token used by the action. |
| `timeout` | No | Execution timeout in seconds. |
| `cancelRunOnFailure` | No | Stop execution after first failure. |
| `archiveReportsAsSingleArtifact` | No | Upload all reports as a single artifact. |
| `resultTestNameOnly` | No | Store test names instead of full paths in generated results. |
| `resultUnifiedTestClassname` | No | Generate consistent JUnit classname values. |
| `ftlUrl` | No | URL to FTToolsLauncher executable. |
| `logLevel` | No | Logging level from 1 (Trace) to 5 (Error). |
| `cleanupTestRunFiles` | No | Delete temporary execution files after completion. |
| `failIfNotPassed` | No | Fail the workflow when the run status is not Passed. |

### ALM Parameters

| Parameter | Required | Description |
|------------|----------|-------------|
| `almServerUrl` | Yes | ALM server URL. |
| `almUsername` | Yes* | ALM username. |
| `almPassword` | Yes* | ALM password. |
| `almDomain` | Yes | ALM domain. |
| `almProject` | Yes | ALM project. |
| `almTestSets` | Yes | ALM test set path or folder. |
| `almRunMode` | No | LOCAL, REMOTE, or PLANNED_HOST. |

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

- After completing the configuration, run your workflow, manually, from GitHub **Actions** tab.
- The progess can be checked during the execution.

## 6. Limitations

1. One self-hosted GitHub runner is required to execute the integration workflow.
2. Multiple YML workflows/actions can be created/used per GitHub repository, but it's recommended to use the same branch for all FT actions. An attempt to use a second branch can lead to unexpected results / errors.

