import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const planning=read('src/pages/PlanningPage.tsx');
const confirmation=read('src/components/ConfirmDialog.tsx');
const browser=read('scripts/planning-forecast-qa.mjs');

describe('#649 I20.02 distinct scheduled cancellation intent',()=>{
  it('keeps the safe exit distinguishable from cancelling a real scheduled item',()=>{
    expect(confirmation).toContain("cancelLabel='Ακύρωση'");
    expect(confirmation).toContain("tone==='destructive'?'danger':'primary'");
    expect(confirmation).toContain('data-autofocus="true"');
    expect(planning).toContain('cancelLabel="Διατήρηση"');
    expect(planning).toContain("confirmLabel={lifecycleTarget?.status==='cancelled'?'Ακύρωση':'Παράλειψη'}");
    expect(planning).toContain("tone={lifecycleTarget?.status==='cancelled'?'destructive':'default'}");
    expect(planning).toContain("if(!lifecycleTarget||saving)return");
    expect(planning).toContain("await onUpsertScheduled(transitionScheduled(item,status))");
  });

  it('uses isolated Chromium bootstrap before the consolidated Planning browser assertions',()=>{
    expect(browser).toContain('MYFINHUB_QA_PRIMARY_BROWSER');
    expect(browser).toContain('createServer');
    expect(browser).toContain("listener.listen(0,'127.0.0.1'");
    expect(browser).toContain('myfinhub-planning-forecast-qa-chrome-${port}');
    expect(browser).toContain('rmSync(profile');
    expect(browser).toContain('--disable-dev-shm-usage');
    expect(browser).toContain('Chromium exited before CDP ready');
    expect(browser).toContain('child.stderr');
  });

  it('checks real browser dismissal, retained pending action and separate destructive confirmation',()=>{
    expect(browser).toContain('scheduled cancellation shows separate safe keep and destructive action labels');
    expect(browser).toContain("await clickText('[role=alertdialog] footer button','Διατήρηση')");
    expect(browser).toContain('safe keep retains pending scheduled item without a cancellation write');
    expect(browser).toContain('destructive cancellation remains available after safe keep');
    expect(browser).toContain("await clickText('[role=alertdialog] .save-button','Ακύρωση')");
    expect(browser).toContain("'cancelled history'");
  });
});
