import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const source=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const settings=source('../src/pages/SettingsPage.tsx');
const accounts=source('../src/components/AccountManagementSettings.tsx');
const screenshots=source('../scripts/ui-ux-visual-evidence-qa.mjs');

describe('#649 cohesive Settings and rendered evidence regression',()=>{
  it('uses action-scoped message tone so import, backup and taxonomy errors cannot inherit stale success',()=>{
    expect(settings).toContain("const [operationFeedback,setOperationFeedback] = useState");
    expect(settings).not.toContain('backupMessageIsError');
    expect(settings).toContain("setOperationResult(userErrorMessage(error, 'Δεν μπορέσαμε να εισαγάγουμε");

    expect(settings).toContain("'error');");
    expect(settings).toContain("'warning');");
    expect(settings).toContain('<OperationFeedback className="logic-note compact" tone={operationFeedback.tone}>');
  });
  it('implements ARIA tablist arrow, Home and End plus one sequential Tab stop',()=>{
    for(const key of ["ArrowRight","ArrowLeft","Home","End"])expect(settings).toContain(key);
    expect(settings).toContain("tabIndex={activeTab===tab.id?0:-1}");
    expect(settings).toContain("onKeyDown={event=>onTabKeyDown(event,index)}");
    expect(settings).toContain("aria-controls={`settings-panel-${tab.id}`}");
    expect(settings).toContain("selectTab(SETTINGS_TABS[next].id)");
  });
  it('announces blocked and failed account deletion as warning/error rather than success',()=>{
    expect(accounts).toContain("notify(userErrorMessage(error,'Δεν ήταν δυνατή η διαγραφή του λογαριασμού.'),'error')");
    expect(accounts).toContain("metadataWarning?'warning':'success'");
    expect(accounts).toContain('<OperationFeedback className="account-management-message" tone={messageTone}>');
    expect(accounts).toContain(",'warning');return}");
  });
  it('captures full-page screenshots only once table/list content has finished painting',()=>{
    expect(screenshots).toContain('const waitForVisualPaint=async(page)');
    expect(screenshots).toContain("node.getAnimations()");
    expect(screenshots).toContain("getComputedStyle(row).opacity");
    expect(screenshots).toContain('await waitForVisualPaint(page)');
    expect(screenshots).not.toContain('await sleep(120);if(page=');
    expect(screenshots).toContain('await new Promise(requestAnimationFrame)');
  });
});
