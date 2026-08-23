import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot=process.cwd();
const versionMarker=resolve(repositoryRoot,'visual-qa/current-version.txt');
const appVersion=(process.env.MYFINHUB_QA_APP_VERSION||(existsSync(versionMarker)?readFileSync(versionMarker,'utf8').trim():'v1.3')).trim();
const versionDir=resolve(repositoryRoot,'visual-qa',appVersion);
const latestDir=resolve(versionDir,'latest');
const baselineDir=resolve(versionDir,'baseline');
const latestManifestPath=resolve(latestDir,'manifest.json');
if(!existsSync(latestManifestPath))throw new Error(`No latest visual QA manifest found for ${appVersion}. Run npm run qa:visual first.`);
const latestManifest=JSON.parse(readFileSync(latestManifestPath,'utf8'));
rmSync(baselineDir,{recursive:true,force:true});
mkdirSync(baselineDir,{recursive:true});
const screenshots=[];
for(const file of readdirSync(latestDir)){
  if(!file.endsWith('__NEW.png'))continue;
  const baselineFile=file.replace(/__NEW\.png$/,'__BASELINE.png');
  copyFileSync(resolve(latestDir,file),resolve(baselineDir,baselineFile));
  const sourceEntry=latestManifest.screenshots?.find(item=>item.file===file);
  screenshots.push({...sourceEntry,file:baselineFile,state:'BASELINE'});
}
const manifest={...latestManifest,state:'BASELINE',approvedAt:new Date().toISOString(),baselineDirectory:`visual-qa/${appVersion}/baseline`,screenshots};
writeFileSync(resolve(baselineDir,'manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
console.log(`Approved ${screenshots.length} visual QA screenshots as the ${appVersion} baseline.`);
