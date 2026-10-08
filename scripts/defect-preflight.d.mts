export type FailureSeverity='critical'|'high'|'medium'|'low';
export type FailureCategory='security-auth'|'domain-data'|'ui-shared'|'ci-tooling'|'desktop-packaging'|'database'|'deployment-runtime'|'ui-resilience';

export interface DefectPattern {
  id:string;
  title:string;
  category:FailureCategory;
  severity:FailureSeverity;
  rootCause:string;
  prevention:string;
  paths:string[];
  evidence:string[];
  guards:string[];
}

export interface DefectRegistry {
  version:1;
  patterns:DefectPattern[];
}

export interface DefectMatch extends Omit<DefectPattern,'paths'> {
  matchedPaths:string[];
}

export interface DefectReport {
  registryVersion:number;
  changedFiles:string[];
  matches:DefectMatch[];
  suggestedCommands:string[];
}

export function validateRegistry(data:unknown,base?:string):string[];
export function globMatches(glob:string,file:string):boolean;
export function buildReport(data:DefectRegistry,changed:string[]):DefectReport;
export function run(args:string[]):void;
