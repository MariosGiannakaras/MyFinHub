/** One keyboard contract for automatically activated, roving ARIA tablists. */
export function rovingTabDestination(key:string,index:number,count:number):number|null{
  if(count<1||index<0||index>=count)return null;
  if(key==='Home')return 0;
  if(key==='End')return count-1;
  if(key==='ArrowRight')return (index+1)%count;
  if(key==='ArrowLeft')return (index+count-1)%count;
  return null;
}

/** A reusable single-key, accent-insensitive typeahead contract for roving ARIA radio groups. */
export function rovingRadioTypeaheadDestination(key:string,index:number,labels:readonly string[]):number|null{
  if(key.length!==1||!key.trim()||!labels.length||index<0||index>=labels.length)return null;
  const search=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el-GR').trim();
  const needle=search(key);
  for(let step=1;step<=labels.length;step++){
    const next=(index+step)%labels.length;
    if(search(labels[next]??'').startsWith(needle))return next;
  }
  return null;
}
