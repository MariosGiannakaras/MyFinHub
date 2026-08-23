import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const credit=readFileSync(new URL('../src/pages/CreditCardPage.tsx',import.meta.url),'utf8');
const loans=readFileSync(new URL('../src/pages/LoansPage.tsx',import.meta.url),'utf8');

function expectNoNativeDialog(source:string){
  expect(source).not.toContain('window.prompt');
  expect(source).not.toContain('window.confirm');
}

describe('shared primitive adoption',()=>{
  it('uses app-owned dialogs and MoneyInput in Credit Card flows',()=>{
    expectNoNativeDialog(credit);
    expect(credit).toContain('<MoneyEditDialog');
    expect(credit).toContain('<ConfirmDialog');
    expect(credit).toContain('<MoneyInput data-autofocus="true"');
  });

  it('uses app-owned confirmation for self-loan forgiveness',()=>{
    expectNoNativeDialog(loans);
    expect(loans).toContain('<ConfirmDialog');
    expect(loans).toContain('motionMode={data.state.settings.motion}');
    expect(loans).toContain('forgivenAmount:Number(current.forgivenAmount||0)+remaining');
  });
});
