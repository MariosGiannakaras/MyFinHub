import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/pages/DashboardPage.tsx',import.meta.url),'utf8');
const lending=readFileSync(new URL('../src/pages/LendingPage.tsx',import.meta.url),'utf8');
const reports=readFileSync(new URL('../src/pages/ReportsPage.tsx',import.meta.url),'utf8');
const qa=readFileSync(new URL('../src/qa.tsx',import.meta.url),'utf8');

describe('shared session privacy contract',()=>{
  it('owns one non-persisted visibility state in the app and passes it to every sensitive surface',()=>{
    expect(app).toContain('const [privacyVisible,setPrivacyVisible]=useState(false)');
    for(const surface of ['DashboardPage','LendingPage','ReportsPage']){
      const tagStart=app.indexOf('<'+surface);
      expect(tagStart).toBeGreaterThan(-1);
      const tagEnd=app.indexOf('/>',tagStart);
      const tag=app.slice(tagStart,tagEnd+2);
      expect(tag).toContain('privacyVisible={privacyVisible}');
      expect(tag).toContain('onPrivacyVisibleChange={setPrivacyVisible}');
    }
    expect(app).not.toContain('settings:{...current.state.settings,privacyVisible');
  });

  it('makes all three page toggles consume the shared prop rather than local privacy state',()=>{
    for(const source of [dashboard,lending,reports]){
      expect(source).toContain('privacyVisible');
      expect(source).toContain('onPrivacyVisibleChange');
      expect(source).not.toMatch(/useState\([^\n]*privacy/i);
    }
  });

  it('keeps the rendered QA harness on the same shared-state contract',()=>{
    expect(qa).toContain('const [privacyVisible,setPrivacyVisible]=useState(false)');
    expect(qa).toContain('privacyVisible={privacyVisible}');
    expect(qa).toContain('onPrivacyVisibleChange={setPrivacyVisible}');
  });
});
