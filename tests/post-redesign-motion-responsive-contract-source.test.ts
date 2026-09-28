import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const reduced=readFileSync(new URL('../src/styles/reduced-motion-contract.css',import.meta.url),'utf8');
const responsive=readFileSync(new URL('../src/styles/root-responsive-coordination.css',import.meta.url),'utf8');
const controls=readFileSync(new URL('../src/styles/app-controls.css',import.meta.url),'utf8');
const mobile=readFileSync(new URL('../src/styles/mobile-finance-presentations.css',import.meta.url),'utf8');
const mobileShell=readFileSync(new URL('../src/styles/mobile-app-shell.css',import.meta.url),'utf8');
const audit=readFileSync(new URL('../src/styles/frontend-audit-remediation.css',import.meta.url),'utf8');
const privacy=readFileSync(new URL('../src/styles/privacy-toggle-touch-target.css',import.meta.url),'utf8');

describe('post-redesign motion and responsive contracts',()=>{
  it('keeps in-app reduced motion global instead of relying on per-component opt-outs',()=>{
    expect(reduced).toContain('html[data-motion="reduced"] *');
    expect(reduced).toContain('animation-duration:.01ms!important');
    expect(reduced).toContain('animation-iteration-count:1!important');
    expect(reduced).toContain('transition-duration:.01ms!important');
    expect(reduced).toContain('scroll-behavior:auto!important');
  });

  it('keeps the OS reduced-motion preference global as well',()=>{
    expect(responsive).toContain('@media(prefers-reduced-motion:reduce)');
    expect(responsive).toContain('*,*:before,*:after{animation-duration:.01ms!important');
    expect(responsive).toContain('transition-duration:.01ms!important');
    expect(responsive).toContain('scroll-behavior:auto!important');
  });

  it('keeps mobile form controls readable and touch-safe',()=>{
    expect(controls).toContain('@media(max-width:680px){.app-control{min-height:46px;font-size:16px}');
    expect(mobile).toContain('.text-button,.loan-actions button,.settings-actions button,.settings-draft-actions button,.report-eye,.secondary,.save-button{min-height:44px}');
  });

  it('keeps primary mobile navigation and menu targets comfortably sized',()=>{
    expect(mobileShell).toContain('.mobile-nav button{min-height:50px');
    expect(mobileShell).toContain('.mobile-more-menu nav>button{min-height:56px');
    expect(mobile).toContain('env(safe-area-inset-bottom,0px)');
  });

  it('keeps compact icon actions above the project accessibility floor',()=>{
    expect(audit).toContain('.row-actions button,.review-part button,.split-line button,.icon-button,.mobile-more-menu>header button{min-width:40px;min-height:40px}');
    expect(privacy.trim()).toBe('.privacy-toggle{min-height:44px}');
  });
});
