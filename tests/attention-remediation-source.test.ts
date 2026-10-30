import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page=readFileSync(new URL('../src/pages/AttentionPage.tsx',import.meta.url),'utf8');
const target=readFileSync(new URL('../src/styles/attention-approved-target.css',import.meta.url),'utf8');
const refinement=readFileSync(new URL('../src/styles/attention-approved-refinement.css',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/action-center-context-qa.mjs',import.meta.url),'utf8');

describe('Attention post-v1.4 remediation contracts',()=>{
  it('offers group expansion only when rows are actually truncated',()=>{
    expect(page).toContain('const canExpand=items.length>4');
    expect(page).toContain('{canExpand?<Button');
    expect(page).toContain("expanded?'Σύμπτυξη':`Προβολή όλων (${items.length})`");
    expect(page).not.toContain('const showAll=');
    expect(page).not.toContain("document.getElementById(rowsId)?.scrollIntoView");
  });

  it('reserves true all-clear language for zero active actionable items',()=>{
    expect(page).toContain('const activeActionable=items.length');
    expect(page).toContain("counts.danger?'Εκκρεμούν επείγοντα θέματα':activeActionable?'Δεν υπάρχουν επείγοντα θέματα':'Όλα υπό έλεγχο!'");
    expect(page).toContain('counts.danger?<AlertTriangle/>:activeActionable?<CircleAlert/>:<CheckCircle2/>');
    expect(page).toContain("activeActionable?`Υπάρχουν ${activeActionable} ενεργά θέματα χαμηλότερης προτεραιότητας παραπάνω.`");
    expect(page).toContain("activeActionable?'has-active':'is-clear'");
  });

  it('keeps zero-count groups discoverable without a table shell',()=>{
    expect(page).toContain("${items.length?'':'is-empty'}");
    expect(page).toContain("{items.length?<div className={`attention-approved-table-head");
    expect(target).toContain('.attention-approved-group.is-empty .attention-approved-group-head{min-height:50px;border-bottom:0}');
    expect(target).toContain('.attention-approved-empty-row{min-height:46px');
  });

  it('keeps the domain action primary while snooze and dismiss use the shared quiet icon variant',()=>{
    expect(page.match(/className="attention-approved-icon-action"/g)?.length).toBe(2);
    expect(page).toContain('variant="primary" className="compact" onClick={()=>onAction(item)}');
    expect(target).toContain('background:transparent!important');
    expect(target).toContain('color:var(--text-secondary)!important');
  });

  it('bounds wide desktop row measure and removes tiny dense-data overrides',()=>{
    expect(target).toContain('width:min(100%,1480px);margin-inline:auto');
    expect(refinement).toContain('.attention-approved-copy>p{font-size:var(--ux-dense-label-size)}');
    expect(refinement).toContain('.attention-approved-date>small{font-size:var(--ux-dense-label-size)}');
    expect(refinement).toContain('.attention-approved-actions>.save-button{min-height:34px;padding-inline:9px;font-size:var(--ux-dense-label-size)}');
    expect(refinement).not.toMatch(/font-size:(?:7(?:\.\d+)?|8(?:\.\d+)?)px/);
    expect(target).toContain('.attention-approved-actions>.save-button{min-height:34px;min-width:0;max-width:100%;flex:1 1 auto;');
    expect(target).toContain('white-space:normal;overflow-wrap:anywhere;line-height:1.25');
    expect(target).toContain('.attention-approved-actions>.save-button svg{width:13px;height:13px;flex-shrink:0}');
    expect(qa).toContain('assertActionLabelContained');
    expect(qa).toContain('long action labels must stay inside button boundaries and readable line count');
    expect(qa).toContain('lineCount>maxLines');
    expect(qa).toContain("[1100,900,'1100']");

  });
});
