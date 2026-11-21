import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {formatFinanceAxisEuro,zeroAnchoredFinanceAxis} from '../src/lib/financeChartAxis.js';

const savings=readFileSync(new URL('../src/pages/SavingsPage.tsx',import.meta.url),'utf8');
const planning=readFileSync(new URL('../src/pages/PlanningPage.tsx',import.meta.url),'utf8');

describe('#649 finance chart axis provenance and small-value precision',()=>{
  it('keeps real cent values distinct instead of rounding low euro ticks to repeated integers',()=>{
    const labels=[0,0.5,1].map(formatFinanceAxisEuro);
    expect(new Set(labels).size).toBe(3);
    expect(formatFinanceAxisEuro(-0.25)).toContain('0,25');
    expect(formatFinanceAxisEuro(1234.5)).toContain('1.234,5');
    expect(formatFinanceAxisEuro(Number.NaN)).toBe('—');
  });
  it('uses zero as its true no-data axis rather than a fabricated 1 euro maximum',()=>{
    const empty=zeroAnchoredFinanceAxis([0,0,0]);
    expect(empty).toMatchObject({minimum:0,maximum:0,ticks:[0]});
    expect(empty.ratio(0)).toBe(0);
    const cents=zeroAnchoredFinanceAxis([0,0.01]);
    expect(cents.ticks).toEqual([0,0.01]);
    expect(new Set(cents.ticks.map(formatFinanceAxisEuro)).size).toBe(2);
  });
  it('plots negatives and positives around the same actual zero baseline',()=>{
    const axis=zeroAnchoredFinanceAxis([-2,0,4]);
    expect(axis.minimum).toBe(-2);
    expect(axis.maximum).toBe(4);
    expect(axis.ticks).toEqual([-2,1,4]);
    expect(axis.ratio(-2)).toBe(0);
    expect(axis.ratio(0)).toBeCloseTo(1/3);
    expect(axis.ratio(4)).toBe(1);
  });
  it('retains visual financial data and wires the shared formatter into sibling charts',()=>{
    expect(savings).toContain('const trendAxis=zeroAnchoredFinanceAxis(');
    expect(savings).toContain('const trendZeroY=trendY(0)');
    expect(savings).toContain('formatFinanceAxisEuro(tick)');
    expect(savings).toContain('28,${trendZeroY}');
    expect(savings).not.toContain('Math.max(1,targetTotal,flow.saving,...actualSeries)');
    expect(planning).toContain('tickFormatter={(value) => formatFinanceAxisEuro(Number(value))}');
    expect(planning).not.toContain('Math.round(Number(value))');
  });
});
