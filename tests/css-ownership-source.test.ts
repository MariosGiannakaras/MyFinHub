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
const tailLoader=read('src/styles/approved-workspace-targets.css');
const accountMetadataSurfaces=read('src/styles/account-metadata-surfaces.css');

describe('Stage 5 CSS ownership',()=>{
  it('keeps the root/login CSS budget behind one named owner and the late tail behind one lazy workspace owner',()=>{
    const semanticRootOwners=new Map<number,string|string[]>([
      [5,['./loan-action-editor.css','./split-review-editor.css','./reduced-motion-contract.css']],
      [6,'./auth-session-shell.css'],
      [7,'./mobile-more-navigation.css'],
      [8,'./frontend-audit-remediation.css'],
      [10,'./semantic-color-contrast.css'],
      [11,'./account-shell-privacy-states.css'],
      [13,'./taxonomy-filter-controls.css'],
      [14,'./savings-workflow-history.css'],
      [15,'./recurring-operations-workspace.css'],
      [17,'./interaction-motion-states.css'],
      [18,'./cards-bank-stack-base.css'],
      [19,'./finance-icons-account-marks.css'],
      [20,'./mobile-finance-presentations.css'],
      [21,'./mobile-app-shell.css'],
      [22,'./mobile-finance-domain-layouts.css'],
      [23,'./mobile-reports-settings-editors.css'],
      [24,'./credit-loans-workspaces.css'],
      [25,'./owned-entry-popovers.css'],
      [27,'./credit-usage-archive-security.css'],
      [28,'./desktop-update-panel.css'],
      [30,'./ui-hardening-foundations.css'],
      [31,'./visual-polish-overrides.css'],
      [32,'./navigation-action-contrast.css'],
      [34,'./reports-dashboard.css'],
      [36,'./transaction-split-editor.css'],
      [37,'./planning-forecast-workspace.css'],
      [38,'./attention-contextual-actions.css'],
      [39,'./budget-rule-settings.css'],
      [40,'./command-palette-contextual-entry.css'],
      [42,['./shortcut-history-controls.css','./route-skeleton-system.css']],
      [44,'./receipt-inbox.css'],
      [45,'./category-icon-workspace.css'],
    ]);
    const expectedRoot=[...Array.from({length:46},(_,index)=>semanticRootOwners.get(index+1)??`./part${index+1}.css`).flatMap(owner=>Array.isArray(owner)?owner:[owner]),'./app-controls.css'];
    expect(cssImports(rootStyles)).toEqual(['./styles/root-compat.css']);
    expect(cssImports(rootCompat)).toEqual(expectedRoot);
    expect(tsStyleImports(workspaceLayer)).toEqual(['../styles/workspace-compat.css']);
    expect(cssImports(workspaceCompat)).toEqual([
      './approved-workspace-targets.css',
      './account-metadata-surfaces.css',
      './dashboard-command-search-geometry.css',
      './dashboard-desktop-fidelity.css',
      './dashboard-bankmark-chart-attention.css',
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
    expect(accountMetadataSurfaces).toContain('.account-iban{');
    expect(accountMetadataSurfaces).toContain('.account-metadata-row{');
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
