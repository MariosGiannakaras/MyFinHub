/// <reference lib="dom" />

export type ThemePreference='system'|'light'|'dark';
export type ResolvedTheme='light'|'dark';

export const THEME_STORAGE_KEY='myfinhub.theme';
export const THEME_EVENT='myfinhub-theme-change';

type ThemeTokens=Record<`--${string}`,string>;

export const LIGHT_THEME_TOKENS:ThemeTokens={
  '--canvas':'#eef3fb','--canvas-strong':'#e7eef8','--canvas-gradient':'radial-gradient(circle at 13% 0%,#fbfdff 0,#eef3fb 36%,#e9f0f9 100%)',
  '--surface':'#f4f7fc','--surface-2':'#edf2fa','--surface-elevated':'#f8faff','--surface-inset':'#eef3fa','--surface-hover':'#e9f0f8','--surface-selected':'#e8f0ff','--surface-translucent':'rgba(248,250,254,.9)',
  '--control-bg':'#f8fbff','--control-gradient':'linear-gradient(145deg,#fff,#edf3fa)','--surface-elevated-gradient':'linear-gradient(145deg,#f8faff,#edf2f9)',
  '--ink':'#10234d','--ink-2':'#28416f','--text-primary':'#10234d','--text-secondary':'#516889','--muted':'#61728c','--muted-2':'#95a3ba','--text-disabled':'#8d9bb1','--on-accent':'#ffffff','--white':'#ffffff',
  '--line':'#d9e2f0','--border-subtle':'#d9e2f0','--border-strong':'#b8c8dc','--border-glass':'rgba(255,255,255,.86)',
  '--blue':'#2f6fed','--blue-2':'#174ea6','--blue-3':'#8fb4ff','--accent':'#2f6fed','--accent-hover':'#245fcf','--accent-selected':'#5a8cff','--accent-soft':'#e9f0ff','--accent-gradient':'linear-gradient(135deg,#2f6fed,#174ea6)','--cyan':'#25b9d7','--cyan-2':'#68d8dc','--violet':'#7656d6',
  '--green':'#1d9a68','--success':'#1d9a68','--success-bg':'#e9f8f1','--red':'#d64058','--error':'#d64058','--error-bg':'#ffedf0','--amber':'#d99117','--warning':'#a66300','--warning-bg':'#fff5db','--info':'#315fae','--info-bg':'#edf3ff','--neutral-bg':'#eef2f7',
  '--finance-positive':'#187852','--finance-negative':'#b42d45','--finance-neutral':'#516889','--chart-grid':'#dfe7f2','--overlay':'rgba(18,33,62,.28)',
  '--shadow-raised':'10px 10px 24px rgba(38,62,106,.10),-9px -9px 22px rgba(255,255,255,.88),inset 0 1px 0 rgba(255,255,255,.85)',
  '--shadow-soft':'5px 5px 13px rgba(45,69,108,.09),-5px -5px 12px rgba(255,255,255,.8)','--shadow-inset':'inset 4px 4px 10px rgba(42,65,105,.09),inset -4px -4px 10px rgba(255,255,255,.9)','--shadow-flat':'0 5px 24px rgba(34,59,98,.07)','--focus':'0 0 0 3px rgba(47,111,237,.22)','--focus-outline':'rgba(47,111,237,.52)'
};

export const DARK_THEME_TOKENS:ThemeTokens={
  '--canvas':'#0b1220','--canvas-strong':'#0f1728','--canvas-gradient':'radial-gradient(circle at 15% 0%,#17243a 0,#0d1626 34%,#08101c 100%)',
  '--surface':'#121b2d','--surface-2':'#172238','--surface-elevated':'#18243a','--surface-inset':'#0f1828','--surface-hover':'#1c2942','--surface-selected':'#1d3153','--surface-translucent':'rgba(20,30,48,.94)',
  '--control-bg':'#111c2e','--control-gradient':'linear-gradient(145deg,#19263d,#111a2b)','--surface-elevated-gradient':'linear-gradient(145deg,#1a273e,#111a2b)',
  '--ink':'#e7eefb','--ink-2':'#c7d3e8','--text-primary':'#e7eefb','--text-secondary':'#b4c0d5','--muted':'#9aa9c2','--muted-2':'#7f8ea8','--text-disabled':'#6e7c94','--on-accent':'#ffffff','--white':'#ffffff',
  '--line':'#26354e','--border-subtle':'#26354e','--border-strong':'#3a4b68','--border-glass':'rgba(255,255,255,.075)',
  '--blue':'#79a6ff','--blue-2':'#9bbcff','--blue-3':'#4c78ca','--accent':'#79a6ff','--accent-hover':'#91b6ff','--accent-selected':'#4d78d0','--accent-soft':'#1d3153','--accent-gradient':'linear-gradient(135deg,#3769cf,#2455bb)','--cyan':'#55ccdf','--cyan-2':'#7edce6','--violet':'#a68cff',
  '--green':'#66d6a5','--success':'#66d6a5','--success-bg':'#163226','--red':'#ff7f94','--error':'#ff7f94','--error-bg':'#3a1b25','--amber':'#ffc56d','--warning':'#ffc56d','--warning-bg':'#3a2a12','--info':'#9abaff','--info-bg':'#1b2b4b','--neutral-bg':'#1b2638',
  '--finance-positive':'#70d7a8','--finance-negative':'#ff8799','--finance-neutral':'#aebbd1','--chart-grid':'#2a3953','--overlay':'rgba(2,7,18,.74)',
  '--shadow-raised':'0 16px 38px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.045)','--shadow-soft':'0 8px 20px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.035)','--shadow-inset':'inset 4px 4px 10px rgba(0,0,0,.34),inset -1px -1px 0 rgba(255,255,255,.035)','--shadow-flat':'0 8px 24px rgba(0,0,0,.24)','--focus':'0 0 0 3px rgba(121,166,255,.34)','--focus-outline':'rgba(121,166,255,.72)'
};

const THEME_STYLE_ID='myfinhub-semantic-theme';
const THEME_STYLE=`
:root[data-theme]{background:var(--canvas);color:var(--ink);color-scheme:light}
:root[data-theme="dark"]{color-scheme:dark}
html,body,#root,.login-screen{background:var(--canvas-gradient)!important;color:var(--ink)!important}
.neo-raised,.metric-card,.account-chip,.report-kpis>div,.summary-card{background:var(--surface-elevated-gradient)!important;border-color:var(--border-glass)!important;box-shadow:var(--shadow-raised)!important}
.neo-inset,.searchbox,.saving-route>span,.reconcile-preview,.sort-direction-control{background:var(--surface-inset)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-inset)!important}
.neo-flat{background:var(--surface-translucent)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-flat)!important}
.brand-word,.sidebar nav button,.mobile-nav button,.settings-form span,.form-grid label>span{color:var(--text-secondary)!important}.brand-word{color:var(--ink-2)!important}.brand-word span{color:var(--cyan)!important}
.sidebar nav button:hover,.insight-list>button:hover{background:var(--surface-hover)!important}.sidebar nav button.active,.mobile-nav button.active,.primary-action,.save-button{background:var(--accent-gradient)!important;color:var(--on-accent)!important}
.count-badge{background:var(--surface-elevated)!important;color:var(--accent)!important}
.top-actions button,.icon-button,.settings-actions button,.secondary,.row-actions button,.loan-actions button,.review-buttons button,.frequent-strip button,.frequent-grid button,.kind-grid button,.text-size-picker button,.bank-add-btn,.inline-icon-action{background:var(--control-gradient)!important;border-color:var(--border-subtle)!important;color:var(--ink)!important;box-shadow:var(--shadow-soft)!important}
.top-actions button:hover,.icon-button:hover,.text-button,.reconcile-preview strong{color:var(--accent)!important}.text-button:hover{background:var(--accent-soft)!important}
.month-toolbar input,.filterbar select,.form-grid select,.form-grid input,.settings-form input,.settings-form select,.settings-form textarea,.split-line input,.split-line select,.review-part input,.review-part select,.money-input,.owned-input,.searchbox,input,select,textarea{background-color:var(--control-bg)!important;border-color:var(--border-subtle)!important;color:var(--ink)!important}
.owned-input-shell{background:var(--control-bg)!important;border-color:var(--border-subtle)!important;color:var(--ink)!important;box-shadow:var(--shadow-inset)!important}.owned-input-shell>svg{color:var(--muted)!important}.owned-popover{background:var(--surface-elevated-gradient)!important;border-color:var(--border-strong)!important;box-shadow:var(--shadow-raised)!important;color:var(--ink)!important}.owned-option-list button,.owned-calendar-grid button{background:var(--surface-2)!important;border-color:var(--border-subtle)!important;color:var(--text-secondary)!important}.owned-option-list button:hover,.owned-calendar-grid button:hover{background:var(--surface-hover)!important}.owned-option-list button[aria-selected="true"],.owned-calendar-grid button.selected{background:var(--surface-selected)!important;border-color:var(--focus-outline)!important;color:var(--ink)!important}
.sort-direction-control button,.month-toolbar button{background:var(--control-bg)!important;border-color:var(--border-subtle)!important;color:var(--text-secondary)!important}.sort-direction-control button.active,.sort-direction-control button[aria-pressed="true"]{background:var(--surface-selected)!important;color:var(--accent)!important;box-shadow:0 0 0 1px var(--focus-outline)!important}
input::placeholder,textarea::placeholder{color:var(--muted-2)!important}option{background:var(--surface-elevated);color:var(--ink)}
.metric-icon,.summary-card>svg,.rec-icon,.kind-grid button>span,.insight-icon.review{background:var(--accent-soft)!important;color:var(--accent)!important}.mini-progress,.loan-progress,.credit-usage{background:var(--chart-grid)!important}
.tr,.review-row,.recurring-table>div,.settings-list>div,.insight-list>button,.insight-list>div,.recurring-mini>div,.recent-list>div{border-color:var(--chart-grid)!important}.tr.th{background:var(--surface-inset)!important}.flow-pill{background:var(--neutral-bg)!important;color:var(--finance-neutral)!important}
.cards-bank-column{background:var(--surface-2)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-flat)!important;color:var(--ink)!important}.bank-empty{background:var(--surface-inset)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-inset)!important;color:var(--muted)!important}.card-archive-row{background:var(--surface-2)!important;border-color:var(--border-subtle)!important;color:var(--ink)!important}.cards-archive summary{color:var(--text-secondary)!important}
.credit-card-stage-stats>div{background:var(--surface-2)!important;border-color:var(--border-subtle)!important;box-shadow:var(--shadow-soft)!important;color:var(--ink)!important}.credit-card-stage-stats>div>span,.credit-card-stage-stats>div>small{color:var(--text-secondary)!important}.action-status{background:var(--info-bg)!important;border-color:var(--border-strong)!important;color:var(--text-secondary)!important;box-shadow:none!important}
.flow-pill.expense,.flow-pill.card_purchase,.row-actions .danger,.split-line button,.form-error{background:var(--error-bg)!important;color:var(--error)!important}.flow-pill.income,.flow-pill.refund,.review-buttons .approve,.confidence-orb.high{background:var(--success-bg)!important;color:var(--success)!important}.flow-pill.transfer,.flow-pill.withdrawal,.flow-pill.saving_cash_offset,.suggestion-tag{background:var(--info-bg)!important;color:var(--info)!important}.confidence-orb.medium{background:var(--warning-bg)!important;color:var(--warning)!important}.confidence-orb.low{background:var(--neutral-bg)!important;color:var(--muted)!important}
.positive,.empty-state.success,.report-insight.positive>svg{color:var(--finance-positive)!important}.negative,.report-insight.negative>svg{color:var(--finance-negative)!important}.report-insight.neutral>svg{color:var(--accent)!important}
.gauge-ring{background:conic-gradient(var(--cyan) var(--progress),var(--chart-grid) 0)!important}.gauge-ring:after{background:var(--surface)!important}.logic-note{background:var(--info-bg)!important;border-color:var(--border-strong)!important;color:var(--text-secondary)!important}
.entry-body{background:color-mix(in srgb,var(--surface-2) 78%,transparent)!important;border-color:var(--border-subtle)!important}.split-box,.report-insight,.credit-report-list>div,.category-momentum-list>div{background:var(--surface-2)!important;border-color:var(--border-subtle)!important}
.kind-grid button.active,.text-size-picker button.active{background:var(--surface-selected)!important;border-color:var(--focus-outline)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent)!important}
.modal-backdrop,.editor-backdrop,.picker-backdrop,.owned-popover-backdrop{background:var(--overlay)!important}
.login-shield{background:var(--accent-soft)!important;color:var(--accent)!important}.login-error,.session-error-banner{background:var(--error-bg)!important;border-color:var(--error)!important;color:var(--error)!important}.mfa-secret{background:var(--surface-inset)!important;color:var(--ink)!important}.login-logout{background:var(--surface-translucent)!important;border-color:var(--border-subtle)!important;color:var(--ink-2)!important}
.app-tooltip-bubble{background:var(--ink)!important;color:var(--canvas)!important;box-shadow:var(--shadow-flat)!important}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible,[tabindex]:focus-visible{outline-color:var(--focus-outline)!important}
.recharts-cartesian-grid line{stroke:var(--chart-grid)!important}.recharts-cartesian-axis-tick-value,.recharts-legend-item-text{fill:var(--muted)!important;color:var(--muted)!important}.recharts-default-tooltip{background:var(--surface-elevated)!important;border-color:var(--border-strong)!important;color:var(--ink)!important}
`;

let mediaQuery:MediaQueryList|null=null;
let mediaListener:((event:MediaQueryListEvent)=>void)|null=null;

export function normalizeThemePreference(value:string|null|undefined):ThemePreference{return value==='light'||value==='dark'||value==='system'?value:'system'}
export function resolveThemePreference(preference:ThemePreference,systemDark:boolean):ResolvedTheme{return preference==='system'?(systemDark?'dark':'light'):preference}
export function themeTokens(theme:ResolvedTheme):ThemeTokens{return theme==='dark'?DARK_THEME_TOKENS:LIGHT_THEME_TOKENS}

function ensureThemeStyle(){if(document.getElementById(THEME_STYLE_ID))return;const style=document.createElement('style');style.id=THEME_STYLE_ID;style.textContent=THEME_STYLE;document.head.append(style)}
function applyTokens(theme:ResolvedTheme){const root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme;for(const [name,value] of Object.entries(themeTokens(theme)))root.style.setProperty(name,value)}
function systemIsDark(){return typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches}

export function getThemePreference():ThemePreference{try{return normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY))}catch{return 'system'}}
export function applyThemePreference(preference:ThemePreference){ensureThemeStyle();applyTokens(resolveThemePreference(preference,systemIsDark()));document.documentElement.dataset.themePreference=preference}
export function setThemePreference(preference:ThemePreference){try{localStorage.setItem(THEME_STORAGE_KEY,preference)}catch{}applyThemePreference(preference);window.dispatchEvent(new CustomEvent(THEME_EVENT,{detail:{preference}}))}
export function subscribeThemePreference(listener:(preference:ThemePreference)=>void){const handler=()=>listener(getThemePreference());window.addEventListener(THEME_EVENT,handler);window.addEventListener('storage',handler);return()=>{window.removeEventListener(THEME_EVENT,handler);window.removeEventListener('storage',handler)}}
export function initializeTheme(){const preference=getThemePreference();applyThemePreference(preference);mediaQuery=typeof matchMedia==='function'?matchMedia('(prefers-color-scheme: dark)'):null;if(mediaQuery){mediaListener=()=>{if(getThemePreference()==='system')applyThemePreference('system')};mediaQuery.addEventListener?.('change',mediaListener)}return()=>{if(mediaQuery&&mediaListener)mediaQuery.removeEventListener?.('change',mediaListener);mediaQuery=null;mediaListener=null}}
