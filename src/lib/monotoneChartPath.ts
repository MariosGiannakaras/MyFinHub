/** SVG path interpolation for chronological finance points.
 * Fixed 80%-strength cubic handles; no interaction setting or altered data.
 * Harmonic-mean monotone tangents preserve flat intervals and never introduce
 * extrema outside the two recorded values of a segment.
 */
export type ChartCoordinate=readonly [number,number];
const CURVE_STRENGTH=0.8;

export function monotoneChartPath(points:ReadonlyArray<ChartCoordinate>,startIndex=0,endIndex=points.length-1){
  if(!points.length)return '';
  const first=Math.max(0,Math.min(points.length-1,startIndex));
  const last=Math.max(first,Math.min(points.length-1,endIndex));
  const slopes=points.slice(1).map((point,index)=>{
    const previous=points[index]!;
    const width=point[0]-previous[0];
    return width>0?(point[1]-previous[1])/width:0;
  });
  const tangents=points.map((_,index)=>{
    if(index===0)return slopes[0]??0;
    if(index===points.length-1)return slopes.at(-1)??0;
    const left=slopes[index-1]!,right=slopes[index]!;
    return left*right<=0?0:2*left*right/(left+right);
  });
  const fmt=(number:number)=>number.toFixed(2);
  let path=`M ${fmt(points[first]![0])} ${fmt(points[first]![1])}`;
  for(let index=first;index<last;index++){
    const a=points[index]!,b=points[index+1]!,width=b[0]-a[0];
    if(width<=0){path+=` L ${fmt(b[0])} ${fmt(b[1])}`;continue}
    const handle=width*CURVE_STRENGTH/3;
    path+=` C ${fmt(a[0]+handle)} ${fmt(a[1]+tangents[index]!*handle)}, ${fmt(b[0]-handle)} ${fmt(b[1]-tangents[index+1]!*handle)}, ${fmt(b[0])} ${fmt(b[1])}`;
  }
  return path;
}
