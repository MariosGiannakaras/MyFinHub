import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspace=readFileSync(new URL('../src/components/CategoryIconAssignmentWorkspace.tsx',import.meta.url),'utf8');
const settings=readFileSync(new URL('../src/pages/SettingsPage.tsx',import.meta.url),'utf8');

describe('unified category icon assignment workspace',()=>{
  it('renders expense and income taxonomies in one assignment list without a type toggle',()=>{
    expect(workspace).toContain("categoryTree(settings,'expense')");
    expect(workspace).toContain("categoryTree(settings,'income')");
    expect(workspace).not.toContain('Τύπος κατηγοριών');
    expect(workspace).not.toContain('>Έξοδα<');
    expect(workspace).not.toContain('>Έσοδα<');
  });

  it('keeps kind only as identity disambiguation and applies edits through canonical preference helpers',()=>{
    expect(workspace).toContain("duplicateNames.has(row.name)");
    expect(workspace).toContain('withCategoryIcon(settings,editor.kind,editor.category,iconKey)');
    expect(workspace).toContain('withSubcategoryIconOverride(settings,editor.kind,editor.category,editor.subcategory,iconKey)');
    expect(workspace).toContain('resolvedCategoryIcon(settings,row.kind,row.name,subcategory)');
  });

  it('uses one shared contextual picker instead of expanding a picker inside a single taxonomy card',()=>{
    expect(workspace).toContain('data-icon-selection-panel');
    expect(workspace).toContain('category-icon-selection-head');
    expect(workspace).toContain('Κλείσιμο επιλογής εικονιδίου');
    expect(workspace).toContain('showPackSwitcher={false}');
    expect(workspace).not.toContain('category-icon-unified-editor');
  });

  it('is the Settings Icons surface while Categories keeps taxonomy management',()=>{
    expect(settings).toContain('<CategoryIconAssignmentWorkspace settings={draft}');
    expect(settings).toContain('view="taxonomy"');
    expect(settings).not.toContain('view="icons"');
  });
});
