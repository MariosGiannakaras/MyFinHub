import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const qa=readFileSync(new URL('../scripts/keyboard-semantic-accessibility-qa.mjs',import.meta.url),'utf8');
const runner=readFileSync(new URL('../scripts/run-rendered-qa.mjs',import.meta.url),'utf8');
const modalFocus=readFileSync(new URL('../src/hooks/useModalFocus.ts',import.meta.url),'utf8');
const controls=readFileSync(new URL('../src/styles/app-controls.css',import.meta.url),'utf8');

describe('keyboard and semantic accessibility verification contract',()=>{
  it('audits every primary route on desktop and mobile',()=>{
    for(const page of ['dashboard','transactions','savings','cards','credit','loans','lending','recurring','planning','attention','reports','settings']){
      expect(qa).toContain(`${page}:`);
    }
    expect(qa).toContain("['desktop',1440,1000,false]");
    expect(qa).toContain("['mobile',375,812,true]");
  });

  it('checks names, landmarks, headings, table semantics and focus order',()=>{
    expect(qa).toContain('unnamed controls');
    expect(qa).toContain('expected one main landmark');
    expect(qa).toContain('expected one visible H1');
    expect(qa).toContain('visible table missing caption/header semantics');
    expect(qa).toContain('positive tabindex');
    expect(qa).toContain('focused control has no visible focus indicator');
  });

  it('checks shared modal focus trapping, escape and opener restoration',()=>{
    expect(qa).toContain('Quick Entry focus trap');
    expect(qa).toContain('Command Palette focus trap');
    expect(qa).toContain('mobile More focus trap');
    expect(qa).toContain('restores focus to opener');
    expect(modalFocus).toContain("event.key !== 'Tab'");
    expect(modalFocus).toContain('opener.current?.focus');
  });

  it('covers the 404 recovery surface at a 200%-equivalent viewport with reduced motion',()=>{
    expect(qa).toContain("notFoundUrl.searchParams.set('screen','404')");
    expect(qa).toContain("prefers-reduced-motion");
    expect(qa).toContain("await viewport(720,500,false)");
    expect(qa).toContain("404 title focus");
    expect(qa).toContain("404 first Tab reaches Dashboard recovery");
    expect(qa).toContain("404 second Tab reaches Back recovery");
  });

  it('keeps a shared visible keyboard focus treatment and runs in rendered QA',()=>{
    expect(controls).toContain(':where(button,input,select,textarea,summary,[tabindex]):focus-visible');
    expect(runner).toContain("scripts/keyboard-semantic-accessibility-qa.mjs");
  });
});
