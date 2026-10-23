import type { Loan, RecurringItem } from '../types.js';

type LinkedExpensePurpose={category:string;subcategory?:string};

/** A recurring item's configured purpose travels with its single linked payment. */
export function recurringExpensePurpose(item:Pick<RecurringItem,'category'|'subcategory'>):LinkedExpensePurpose{
  return {category:item.category, ...(item.subcategory?{subcategory:item.subcategory}:{})};
}

/** Legacy installments lack a purpose; keep payments classifiable without resurrecting the retired category. */
export function installmentExpensePurpose(loan:Pick<Loan,'expenseCategory'|'expenseSubcategory'>):LinkedExpensePurpose{
  const category=loan.expenseCategory?.trim()||'Άλλο';
  return {category,...(loan.expenseSubcategory?.trim()?{subcategory:loan.expenseSubcategory.trim()}: {})};
}
