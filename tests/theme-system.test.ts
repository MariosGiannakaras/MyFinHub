import { describe, expect, it } from 'vitest';
import { DARK_THEME_TOKENS, LIGHT_THEME_TOKENS, normalizeThemePreference, resolveThemePreference } from '../src/lib/theme.js';

function channel(value:number){const normalized=value/255;return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4}
function luminance(hex:string){const value=hex.replace('#','');const [r,g,b]=[0,2,4].map(index=>Number.parseInt(value.slice(index,index+2),16));return .2126*channel(r)+.7152*channel(g)+.0722*channel(b)}
function contrast(a:string,b:string){const [bright,dark]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (bright+.05)/(dark+.05)}

const requiredRoles=['--canvas','--surface','--surface-elevated','--surface-inset','--ink','--muted','--line','--accent','--success','--warning','--error','--info','--finance-positive','--finance-negative','--finance-neutral','--chart-grid','--overlay','--focus-outline'] as const;

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

  it('keeps status colors distinguishable from their semantic backgrounds',()=>{
    expect(contrast(LIGHT_THEME_TOKENS['--success'],LIGHT_THEME_TOKENS['--success-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(LIGHT_THEME_TOKENS['--error'],LIGHT_THEME_TOKENS['--error-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK_THEME_TOKENS['--success'],DARK_THEME_TOKENS['--success-bg'])).toBeGreaterThanOrEqual(3);
    expect(contrast(DARK_THEME_TOKENS['--error'],DARK_THEME_TOKENS['--error-bg'])).toBeGreaterThanOrEqual(3);
  });
});
