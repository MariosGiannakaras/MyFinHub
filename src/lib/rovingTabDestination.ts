/** One keyboard contract for automatically activated, roving ARIA tablists. */
export function rovingTabDestination(key:string,index:number,count:number):number|null{
  if(count<1||index<0||index>=count)return null;
  if(key==='Home')return 0;
  if(key==='End')return count-1;
  if(key==='ArrowRight')return (index+1)%count;
  if(key==='ArrowLeft')return (index+count-1)%count;
  return null;
}
