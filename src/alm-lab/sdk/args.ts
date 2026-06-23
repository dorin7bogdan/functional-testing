import { LabRunType } from './constants.js';

export default class Args {
  constructor(
    public readonly serverUrl: string,
    public readonly runType: LabRunType,
    public readonly entityId: string,
    public readonly domain: string,
    public readonly project: string,
    public readonly duration: string = "",
    public readonly environmentConfigurationId: string = ""
  ) {}
}
