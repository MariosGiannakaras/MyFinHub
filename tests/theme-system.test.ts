import { describe, expect, it } from 'vitest';
import { DARK_THEME_TOKENS, LIGHT_THEME_TOKENS, normalizeThemePreference, resolveThemePreference } from '../src/lib/theme.js';

function channel(value:number){const normalized=value/255;return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4}
function luminance(hex:string){const value=hex.replace('#','');const [r,g,b]=[0,2,4].map(index=>Number.parseInt(value.slice(index,index+2),16));return .2126*channel(r)+.7152*channel(g)+.0722*channel(b)}
function contrast(a:string,b:string){const [bright,dark]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (bright+.05)/(dark+.05)}

const requiredRoles=['--canvas','--surface','--surface-elevated','--surface-inset','--ink','--muted','--line','--control-border','--accent','--success','--warning','--error','--info','--finance-positive','--finance-negative','--finance-neutral','--danger-solid','--chart-grid','--overlay','--focus-outline'] as const;

describe('semantic theme system',()=>{
  it('keeps the same semantic roles in Light and Dark',()=>{
    for(const role of requiredRoles){expect(LIGHT_THEME_TOKENS[role]).toBeTruthy();expect(DARK_THEME_TOKENS[role]).toBeTruthy()}
  });

  it('resolves System without changing explicit preferences',()=>{
    expect(resolveThemePreference('system',false)).toBe('light');
    expect(resolveThemePreference('system',true)).toBe('dark');
    expect(resolveThemePreference('light',true)).toBe('light');
    expect(resolveThemePreference('dark',false)).toBe('dark');
    expect(normalizeThemePreference('unexpected')).toBe('system');
  });

  it('keeps representative body and secondary text contrast readable',()=>{
    expect(contrast(LIGHT_THEME_TOKENS['--ink'],LIGHT_THEME_TOKENS['--canvas'])).toBeGreaterThanOrEqual(7);
    expect(contrast(DARK_THEME_TOKENS['--ink'],DARK_THEME_TOKENS['--canvas'])).toBeGreaterThanOrEqual(7);
    expect(contrast(LIGHT_THEME_TOKENS['--muted'],LIGHT_THEME_TOKENS['--surface-elevated'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK_THEME_TOKENS['--muted'],DARK_THEME_TOKENS['--surface-elevated'])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps interactive control boundaries and secondary dark text distinguishable',()=>{
    expect(contrast(LIGHT_THEME_TOKENS['--control-border'],LIGHT_THEME_TOKENS['--control-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK_THEME_TOKENS['--control-border'],DARK_THEME_TOKENS['--control-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK_THEME_TOKENS['--muted-2'],DARK_THEME_TOKENS['--surface-elevated'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK_THEME_TOKENS['--info'],DARK_THEME_TOKENS['--surface-elevated'])).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps semantic text, solid destructive labels and visible focus at their applicable contrast thresholds',()=>{
    for(const tokens of [LIGHT_THEME_TOKENS,DARK_THEME_TOKENS]){
      for(const role of ['success','error','warning','info'] as const){
        expect(contrast(tokens[`--${role}`],tokens[`--${role}-bg`]),role).toBeGreaterThanOrEqual(4.5);
      }
      for(const surface of ['--surface','--surface-2','--surface-elevated'] as const){
        for(const role of ['--finance-positive','--finance-negative','--finance-neutral','--green','--red','--warning'] as const){
          expect(contrast(tokens[role],tokens[surface]),role+' / '+surface).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(tokens['--focus-outline'],tokens[surface])).toBeGreaterThanOrEqual(3);
      }
      expect(contrast(tokens['--white'],tokens['--danger-solid'])).toBeGreaterThanOrEqual(4.5);
      for(const stop of tokens['--accent-gradient'].match(/#[0-9a-f]{6}/gi)??[]){
        expect(contrast(tokens['--on-accent'],stop)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps status colors distinguishable from their semantic backgrounds',()=>{
    expect(contrast(LIGHT_THEME_TOKENS['--success'],LIGHT_THEME_TOKENS['--success-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(LIGHT_THEME_TOKENS['--error'],LIGHT_THEME_TOKENS['--error-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK_THEME_TOKENS['--success'],DARK_THEME_TOKENS['--success-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK_THEME_TOKENS['--error'],DARK_THEME_TOKENS['--error-bg'])).toBeGreaterThanOrEqual(3);
  });
});
