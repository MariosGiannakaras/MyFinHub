import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const shell=readFileSync(new URL('../src/styles/shell-navigation-foundations.css',import.meta.url),'utf8');
const motion=readFileSync(new URL('../src/styles/interaction-motion-states.css',import.meta.url),'utf8');
const controls=readFileSync(new URL('../src/styles/app-controls.css',import.meta.url),'utf8');

describe('post-redesign disabled interaction state ownership',()=>{
  it('keeps primary actions inert while disabled',()=>{
    expect(shell).toContain('.save-button:enabled:hover');
    expect(shell).toContain('.save-button:enabled:active');
    expect(shell).not.toContain('.save-button:hover{');
    expect(shell).not.toContain('.save-button:active{');
  });

  it('keeps shared icon and top actions inert while disabled',()=>{
    expect(shell).toContain('.top-actions button:enabled:hover,.icon-button:enabled:hover');
    expect(shell).not.toContain('.top-actions button:hover,.icon-button:hover');
  });

  it('preserves the global keyboard focus-visible contract',()=>{
    expect(controls).toContain(':where(button,input,select,textarea,summary,[tabindex]):focus-visible');
    expect(controls).toContain('box-shadow:var(--focus)!important');
  });

  it('preserves enabled secondary, ghost and icon press feedback',()=>{
    expect(motion).toContain('.secondary:not(:disabled):active');
    expect(motion).toContain('.icon-button:not(:disabled):active');
    expect(motion).toContain('.top-actions button:not(:disabled):active');
    expect(motion).toContain('.text-button:not(:disabled):hover');
  });

  it('keeps disabled buttons explicitly non-interactive in cursor semantics',()=>{
    expect(motion).toContain('button:disabled{cursor:not-allowed}');
  });
});
