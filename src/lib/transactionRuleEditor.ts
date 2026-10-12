import type { TransactionRule, TransactionRuleScope } from '../types.js';

// The server accepts any nonempty subset of the three scopes. Editors must not
// silently collapse a two-scope stored rule when an unrelated field is changed.
export type TransactionRuleScopeChoice=TransactionRuleScope|'manual+imported'|'manual+review'|'imported+review'|'all';
const RULE_SCOPE_ORDER:TransactionRuleScope[]=['manual','imported','review'];

export function ruleScopeChoice(scopes:readonly TransactionRuleScope[]):TransactionRuleScopeChoice {
  const normalized=RULE_SCOPE_ORDER.filter(scope=>scopes.includes(scope));
  return (normalized.length===3?'all':normalized.join('+')||'manual') as TransactionRuleScopeChoice;
}

export function scopesForRuleChoice(choice:TransactionRuleScopeChoice):TransactionRuleScope[] {
  return choice==='all'?[...RULE_SCOPE_ORDER]:RULE_SCOPE_ORDER.filter(scope=>choice.split('+').includes(scope));
}

/** Reorder one rule in one revisioned FinanceData mutation, using only valid
 * integer server priorities. Preserve sparse priorities when there is room;
 * compact only when a neighboring gap is exhausted. */
export function reorderTransactionRules(rules:TransactionRule[],id:string,direction:-1|1,updatedAt:string):TransactionRule[] {
  const ordered=[...rules].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  const index=ordered.findIndex(rule=>rule.id===id);
  const target=index+direction;
  if(index<0||target<0||target>=ordered.length)return rules;
  const [moving]=ordered.splice(index,1);
  ordered.splice(target,0,moving);
  const lower=ordered[target-1]?.priority;
  const upper=ordered[target+1]?.priority;
  const priority=lower===undefined?(upper===undefined?100:upper-100):upper===undefined?lower+100:Math.floor((lower+upper)/2);
  if(Number.isInteger(priority)&&priority>=0&&priority<=1_000_000
    &&(lower===undefined||priority>lower)&&(upper===undefined||priority<upper)){
    return rules.map(rule=>rule.id===id?{...rule,priority,updatedAt}:rule);
  }
  // 10,000 rules * 100 = 1,000,000, the documented server limit.
  return ordered.map((rule,position)=>{
    const compact=(position+1)*100;
    return compact===rule.priority?rule:{...rule,priority:compact,updatedAt};
  });
}

