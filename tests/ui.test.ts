import { describe, expect, it } from 'vitest';
import { qaFinanceData } from '../src/qaFixture.js';
import { accountDisplayName, effectiveRecurringItems, ratioPercent } from '../src/lib/ui.js';

describe('frontend view semantics',()=>{
  it('applies recurring overrides and custom items consistently',()=>{const data=qaFinanceData();data.state.recurringOverrides['rec-1']={...data.seed.recurring[0],active:false};expect(effectiveRecurringItems(data).map(item=>item.id)).toEqual(['rec-2'])});
  it('keeps friendly account names in user-facing views',()=>{const data=qaFinanceData();expect(accountDisplayName(data,'piraeus-payroll')).toBe('Μισθοδοσία')});
  it('treats a zero target as an explicit no-target state',()=>{expect(ratioPercent(.2,0)).toBeNull();expect(ratioPercent(.1,.2)).toBe(50)});
});
