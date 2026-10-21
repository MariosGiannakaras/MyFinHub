import {describe,expect,it} from 'vitest';
import {validateCategoryIdentityState} from '../server/categoryIdentityValidation.js';

const valid=()=>({
 settings:{categoryIdentities:{
  'cat-food':{id:'cat-food',kind:'expense',label:'Τρόφιμα',aliases:['Φαγητό']},
  'cat-health':{id:'cat-health',kind:'expense',label:'Υγεία',aliases:[]},
  'sub-store':{id:'sub-store',kind:'expense',label:'Σούπερ μάρκετ',aliases:['Μάρκετ'],parentId:'cat-food'}
 }},
 budgets:[{id:'budget:aug:food',month:'2026-08',scope:'subcategory',
  category:'Τρόφιμα',subcategory:'Σούπερ μάρκετ',
  categoryIdentityId:'cat-food',subcategoryIdentityId:'sub-store',amount:100,carryover:true}]
});
describe('stable budget taxonomy references (#588 #9)',()=>{
 it('accepts a matching parent/subcategory pair and all historic aliases',()=>{
  expect(()=>validateCategoryIdentityState(valid())).not.toThrow();
 });
 it('rejects spoofed or cross-parent refs and wrong taxonomy kind',()=>{
  const missing=valid();missing.budgets[0]!.categoryIdentityId='ghost';
  expect(()=>validateCategoryIdentityState(missing)).toThrow(/categoryIdentityId/);
  const cross=valid();cross.budgets[0]!.categoryIdentityId='cat-health';
  expect(()=>validateCategoryIdentityState(cross)).toThrow(/subcategoryIdentityId/);
 });
 it('keeps name-only historic budgets but rejects identity pointers when no identity map exists',()=>{
  const old={settings:{},budgets:[{id:'old',scope:'category',category:'Τρόφιμα'}]};
  expect(()=>validateCategoryIdentityState(old)).not.toThrow();
  expect(()=>validateCategoryIdentityState({...old,budgets:[{...old.budgets[0],categoryIdentityId:'fake'}]})).toThrow(/missing category identities/);
 });
});
