import { describe,expect,it } from 'vitest';
import { monotoneChartPath } from '../src/lib/monotoneChartPath.js';

type Point=readonly [number,number];
function cubicSegments(path:string){
  return [...path.matchAll(/C (-?[\d.]+) (-?[\d.]+), (-?[\d.]+) (-?[\d.]+), (-?[\d.]+) (-?[\d.]+)/g)]
    .map(match=>match.slice(1).map(Number));
}

describe('Dashboard monotone 80%-strength curves',()=>{
  it('interpolates all chronological points without overshooting the recorded range of each segment',()=>{
    const points:Point[]=[[0,10],[10,10],[20,10.05],[30,900],[40,15],[50,15],[60,14.99],[70,1000],[80,1000]];
    const segments=cubicSegments(monotoneChartPath(points));
    expect(segments).toHaveLength(points.length-1);
    for(let index=0;index<segments.length;index++){
      const [x1,y1,x2,y2,endX,endY]=segments[index]!;
      const [aX,aY]=points[index]!,[bX,bY]=points[index+1]!;
      expect(x1).toBeGreaterThan(aX);expect(x2).toBeLessThan(bX);
      expect(endX).toBeCloseTo(bX,2);expect(endY).toBeCloseTo(bY,2);
      for(const y of [y1,y2]){expect(y).toBeGreaterThanOrEqual(Math.min(aY,bY)-.011);expect(y).toBeLessThanOrEqual(Math.max(aY,bY)+.011)}
    }
    expect(segments[0]![1]).toBe(10);expect(segments[0]![3]).toBe(10);
    expect(segments[4]![1]).toBe(15);expect(segments[4]![3]).toBe(15);
  });

  it('retains the same tangent through the month boundary when paths are drawn separately',()=>{
    const points:Point[]=[[0,90],[10,100],[20,120],[30,155],[40,180],[50,190]];
    const previous=cubicSegments(monotoneChartPath(points,0,2));
    const connection=cubicSegments(monotoneChartPath(points,2,3));
    const current=cubicSegments(monotoneChartPath(points,3,5));
    expect(previous).toHaveLength(2);expect(connection).toHaveLength(1);expect(current).toHaveLength(2);
    const left=connection[0]!,right=current[0]!;
    const derivativeLeft=(left[5]-left[3])/(left[4]-left[2]);
    const derivativeRight=(right[1]-points[3]![1])/(right[0]-points[3]![0]);
    expect(derivativeLeft).toBeCloseTo(derivativeRight,1);
  });

  it('handles one-point, empty, and identical-date fallback inputs',()=>{
    expect(monotoneChartPath([])).toBe('');
    expect(monotoneChartPath([[10,20]])).toBe('M 10.00 20.00');
    expect(monotoneChartPath([[0,2],[0,2]])).toContain('L 0.00 2.00');
  });
});
