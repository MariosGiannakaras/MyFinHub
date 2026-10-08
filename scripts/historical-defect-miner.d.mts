export interface DateWindow {since:string;until:string}
export interface HistoricalReport {
  schemaVersion:number;
  range:DateWindow;
  coverageComplete:boolean;
  requests:number;
  windows:number;
  observedFailures:number;
  distinctFailingHeads:number;
  byWorkflow:Record<string,number>;
  byMonth:Record<string,number>;
  jobStepCategories:Record<string,number>;
  trackers:{issues:{count:number;complete:boolean}|null;closedPRs:{count:number;complete:boolean}|null;openPRs:{count:number;complete:boolean}|null};
  sampleFailedRuns:Array<{runId:number;url:string;workflow:string;date:string|null}>;
  partialWarnings:string[];
  coverage:Array<DateWindow&{complete:boolean;reported?:number;observed:number}>;
  classification:string;
}
export interface InventoryOptions {
  since:string;
  until:string;
  request:(path:string)=>Promise<any>;
  includeTrackers?:boolean;
  inspectJobs?:number;
  maxRequests?:number;
  maxRuns?:number;
  span?:number;
}
export function dateWindows(since:string,until:string,span?:number):DateWindow[];
export function splitWindow(window:DateWindow):DateWindow[]|null;
export function failureStepGroup(value:unknown):string;
export function inventory(options:InventoryOptions):Promise<HistoricalReport>;
export function renderSummary(report:HistoricalReport):string;
export function githubRequest(apiPath:string,token:string):Promise<any>;
