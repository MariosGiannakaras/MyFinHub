import type { FinanceData } from '../types.js';

export interface LendingRow {
  person: string;
  outstanding: number;
  events: number;
}

export function lendingRows(data: FinanceData): LendingRow[] {
  const people = new Map<string, LendingRow>();
  for (const legacy of data.seed.lending ?? []) {
    const row = people.get(legacy.person) ?? { person: legacy.person, outstanding: 0, events: 0 };
    row.outstanding += Number(legacy.outstanding || 0);
    row.events += legacy.entries?.length || 0;
    people.set(legacy.person, row);
  }
  for (const event of data.state.events ?? []) {
    if (!event.person || !event.receivableDelta) continue;
    const row = people.get(event.person) ?? { person: event.person, outstanding: 0, events: 0 };
    row.outstanding += event.receivableDelta;
    row.events += 1;
    people.set(event.person, row);
  }
  return [...people.values()].sort((a, b) => b.outstanding - a.outstanding);
}
