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
