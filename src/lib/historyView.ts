/**
 * Server history is a list of saved snapshots, not an audit of cursor
 * operations. Classify only points proven reachable from the current cursor.
 */
type StoredPoint={id:string;parentId?:string|null;current?:boolean};
type HistoryPosition='current'|'redo'|'stored';
export function classifyHistoryPoints<T extends StoredPoint>(points:readonly T[]):Array<T&{position:HistoryPosition}>{
  const current=points.find(item=>item.current);
  const redoIds=new Set<string>();
  if(current){
    const childByParent=new Map<string,string>();
    const ambiguous=new Set<string>();
    for(const point of points){
      if(!point.parentId)continue;
      if(childByParent.has(point.parentId))ambiguous.add(point.parentId);
      else childByParent.set(point.parentId,point.id);
    }
    const visited=new Set<string>([current.id]);
    let id=current.id;
    while(childByParent.has(id)&&!ambiguous.has(id)){
      const child=childByParent.get(id)!;
      if(visited.has(child))break;
      redoIds.add(child);visited.add(child);id=child;
    }
  }
  return points.map(point=>({
    ...point,
    position:point.current?'current':redoIds.has(point.id)?'redo':'stored',
  }));
}

type HistoryFeedbackState='loading'|'saving'|'saved'|'error'|'conflict';
export function historyAvailabilityMessage({
  state,pending,available,undoDepth,redoDepth,
}:{
  state:HistoryFeedbackState;pending:boolean;available:boolean;undoDepth:number;redoDepth:number;
}):string{
  if(pending||state==='saving')return 'Η αλλαγή αποθηκεύεται. Αναίρεση και επαναφορά θα είναι διαθέσιμες μετά την επιβεβαίωση της βάσης.';
  if(state==='loading')return 'Γίνεται φόρτωση της αποθηκευμένης κατάστασης και του ιστορικού.';
  if(state==='conflict')return 'Το ιστορικό δεν συμφωνεί με την τελευταία έκδοση. Ανανέωσε τα δεδομένα πριν συνεχίσεις.';
  if(state==='error')return 'Η τελευταία ενέργεια δεν επιβεβαιώθηκε. Έλεγξε τη σύνδεση και φόρτωσε την τελευταία αποθηκευμένη έκδοση.';
  if(!available)return 'Το ιστορικό δεν είναι διαθέσιμο με ασφάλεια. Ανανέωσε πριν επιχειρήσεις αναίρεση.';
  if(undoDepth===0&&redoDepth===0)return 'Δεν υπάρχει προηγούμενη αλλαγή για αναίρεση ή επαναφορά.';
  return `Αναίρεση: ${undoDepth} ${undoDepth===1?'βήμα':'βήματα'} · Επαναφορά: ${redoDepth} ${redoDepth===1?'βήμα':'βήματα'}`;
}

/** A click may only walk the single server-authoritative ancestor/redo branch.
 * Depths are server-calculated and stop before import/vault barriers. Truncated
 * or ambiguous point sets are intentionally NOT selectable.
 */
type HistoryNavigationPlan={direction:'undo'|'redo';pointIds:string[]};
export function reachableHistoryNavigation<T extends StoredPoint>(
  points:readonly T[],undoDepth:number,redoDepth:number,
):Map<string,HistoryNavigationPlan>{
  const routes=new Map<string,HistoryNavigationPlan>();
  const byId=new Map(points.map(point=>[point.id,point]));
  if(byId.size!==points.length)return routes;
  const active=points.filter(point=>point.current);
  if(active.length!==1)return routes;
  const cursor=active[0];
  const used=new Set<string>([cursor.id]);
  let position=cursor;
  const undoPath:string[]=[];
  for(let i=0;i<undoDepth;i+=1){
    const parent=position.parentId?byId.get(position.parentId):undefined;
    if(!parent||used.has(parent.id))break;
    undoPath.push(parent.id);
    routes.set(parent.id,{direction:'undo',pointIds:[...undoPath]});
    used.add(parent.id);position=parent;
  }
  const children=new Map<string,T[]>();
  for(const point of points){
    if(!point.parentId)continue;
    const list=children.get(point.parentId)??[];
    list.push(point);children.set(point.parentId,list);
  }
  const redoUsed=new Set<string>([cursor.id]);
  const redoPath:string[]=[];
  position=cursor;
  for(let i=0;i<redoDepth;i+=1){
    const next=children.get(position.id);
    if(!next||next.length!==1||redoUsed.has(next[0].id))break;
    position=next[0];redoUsed.add(position.id);
    redoPath.push(position.id);
    routes.set(position.id,{direction:'redo',pointIds:[...redoPath]});
  }
  return routes;
}
