import { describe, expect, it } from 'vitest';
import { validateCategoryIdentityState } from '../server/categoryIdentityValidation.js';

describe('category identity extension validation',()=>{
  it('accepts unique current and historical taxonomy paths',()=>{
    expect(()=>validateCategoryIdentityState({settings:{categoryIdentities:{
      food:{id:'food',kind:'expense',label:'Τρόφιμα',aliases:['Φαγητό']},
      transport:{id:'transport',kind:'expense',label:'Μετακινήσεις',aliases:[]},
      market:{id:'market',kind:'expense',label:'Σούπερ μάρκετ',aliases:['Supermarket'],parentId:'transport',parentAliases:['food']},
    }}})).not.toThrow();
  });

  it('rejects duplicate category labels or aliases within one kind',()=>{
    expect(()=>validateCategoryIdentityState({settings:{categoryIdentities:{
      food:{id:'food',kind:'expense',label:'Τρόφιμα',aliases:['Φαγητό']},
      duplicate:{id:'duplicate',kind:'expense',label:'Φαγητό',aliases:[]},
    }}})).toThrowError(/ambiguous category identity alias\/path/i);
  });

  it('rejects two subcategory identities claiming the same historical path',()=>{
    expect(()=>validateCategoryIdentityState({settings:{categoryIdentities:{
      food:{id:'food',kind:'expense',label:'Τρόφιμα',aliases:[]},
      market:{id:'market',kind:'expense',label:'Σούπερ μάρκετ',aliases:['Supermarket'],parentId:'food',parentAliases:[]},
      other:{id:'other',kind:'expense',label:'Supermarket',aliases:[],parentId:'food',parentAliases:[]},
    }}})).toThrowError(/ambiguous category identity alias\/path/i);
  });
});
