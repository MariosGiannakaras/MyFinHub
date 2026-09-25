import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const cssImports=(source:string)=>[...source.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(match=>match[1]);
const tsStyleImports=(source:string)=>[...source.matchAll(/import\s+['"](\.\.\/styles\/[^'"]+)['"]/g)].map(match=>match[1]);

const rootStyles=read('src/styles.css');
const rootCompat=read('src/styles/root-compat.css');
const workspaceStyles=read('src/components/WorkspaceStyles.tsx');
const workspaceLayer=read('src/components/WorkspaceStyleLayer.tsx');
const workspaceCompat=read('src/styles/workspace-compat.css');
const pageBoundary=read('src/components/PageErrorBoundary.tsx');
const accountIban=read('src/components/AccountIban.tsx');
const accountMetadata=read('src/components/AccountMetadataSettings.tsx');
const bankBrand=read('src/components/BankBrandMark.tsx');
const tailLoader=read('src/styles/part47.css');

describe('Stage 5 CSS ownership',()=>{
  it('keeps the root/login CSS budget behind one named owner and the late tail behind one lazy workspace owner',()=>{
    const semanticRootOwners=new Map<number,string>([
      [6,'./authentication-surfaces.css'],
      [7,'./mobile-overflow-navigation.css'],
      [8,'./frontend-audit-hardening.css'],
      [10,'./semantic-color-contrast.css'],
      [12,'./reporting-period-technical-settings.css'],
      [14,'./savings-workflows.css'],
      [15,'./recurring-operations-workspace.css'],
      [17,'./interaction-state-motion.css'],
      [18,'./payment-cards-workspace.css'],
      [19,'./finance-icons-account-brands.css'],
      [20,'./mobile-finance-presentations.css'],
      [21,'./mobile-app-shell-redesign.css'],
      [22,'./mobile-finance-domain-workspaces.css'],
      [23,'./mobile-reports-settings-editors.css'],
      [24,'./credit-loans-workspaces.css'],
      [25,'./owned-entry-controls.css'],
      [26,'./interactive-card-system.css'],
      [27,'./credit-card-status-security.css'],
      [28,'./desktop-update-panel.css'],
      [29,'./cards-v15-workspace.css'],
      [30,'./shared-ui-hardening-foundations.css'],
      [32,'./navigation-action-contrast.css'],
      [34,'./reports-dashboard-layout.css'],
      [36,'./transaction-split-editor.css'],
      [37,'./planning-workspace.css'],
      [38,'./attention-workspace.css'],
      [39,'./budget-rules-workspace.css'],
      [40,'./command-palette-quick-action.css'],
      [44,'./receipt-inbox-workspace.css'],
      [45,'./category-icon-workspace.css'],
    ]);
    const expectedRoot=[...Array.from({length:46},(_,index)=>semanticRootOwners.get(index+1)??`./part${index+1}.css`),'./app-controls.css'];
    expect(cssImports(rootStyles)).toEqual(['./styles/root-compat.css']);
    expect(cssImports(rootCompat)).toEqual(expectedRoot);
    expect(tsStyleImports(workspaceLayer)).toEqual(['../styles/workspace-compat.css']);
    expect(cssImports(workspaceCompat)).toEqual([
      './part47.css',
      './dashboard-command-search-geometry.css',
      './dashboard-desktop-fidelity.css',
      './part53.css',
    ]);
    expect(workspaceStyles).toContain("lazy(()=>import('./WorkspaceStyleLayer')");
    expect(workspaceStyles).toContain('Suspense fallback={<PageSkeleton/>}');
    expect(pageBoundary).toContain('return <WorkspaceStyles>{this.props.children}</WorkspaceStyles>;');
  });

  it('removes unrelated domain components as global stylesheet loaders',()=>{
    for(const source of [accountIban,accountMetadata,bankBrand]){
      expect(source).not.toMatch(/import\s+['"]\.\.\/styles\//);
    }
    expect(accountIban).toContain('export function AccountIban');
    expect(accountMetadata).toContain('export function AccountMetadataSettings');
    expect(bankBrand).toContain('export function BankBrandMark');
  });

  it('preserves the existing transitive approved-style tail behind the named workspace owner',()=>{
    expect(cssImports(tailLoader)).toEqual([
      './dashboard-approved-target.css',
      './dashboard-route-shell-continuity.css',
      './dashboard-command-search-geometry.css',
      './dashboard-desktop-alignment.css',
      './transactions-desktop-shell.css',
      './quick-entry-desktop-composition.css',
      './savings-desktop-composition.css',
      './loans-approved-target.css',
      './credit-approved-target.css',
      './lending-approved-target.css',
      './recurring-approved-target.css',
      './planning-approved-target.css',
      './planning-approved-refinement.css',
      './attention-approved-target.css',
      './attention-approved-refinement.css',
    ]);
  });
});
