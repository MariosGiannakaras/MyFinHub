import {describe,expect,it} from 'vitest';
import {classifyHistoryPoints,historyAvailabilityMessage,reachableHistoryNavigation} from '../src/lib/historyView.js';

describe('durable Do/Undo/Redo presentation',()=>{
  it('separates current snapshot from a proven redo descendant, not the audit log',()=>{
    const data=[
      {id:'future',parentId:'current',current:false},
      {id:'past',parentId:'older',current:false},
      {id:'current',parentId:'past',current:true},
    ];
    const actual=classifyHistoryPoints(data);
    expect(actual.map(x=>[x.id,x.position])).toEqual([
      ['future','redo'],['past','stored'],['current','current'],
    ]);
  });
  it('never invents redo points when current is missing or child chain ambiguous',()=>{
    expect(classifyHistoryPoints([{id:'a',parentId:null}])[0].position).toBe('stored');
    const dup=classifyHistoryPoints([{id:'a',current:true},{id:'b',parentId:'a'},{id:'c',parentId:'a'}]);
    expect(dup.map(x=>x.position)).toEqual(['current','stored','stored']);
  });
  it('uses actionable messages without presenting failed saves as completed',()=>{
    expect(historyAvailabilityMessage({state:'saving',pending:true,available:true,undoDepth:3,redoDepth:0})).toContain('αποθηκεύεται');
    expect(historyAvailabilityMessage({state:'conflict',pending:false,available:true,undoDepth:3,redoDepth:0})).toContain('Ανανέωσε');
    expect(historyAvailabilityMessage({state:'error',pending:false,available:true,undoDepth:0,redoDepth:0})).toContain('δεν επιβεβαιώθηκε');
    expect(historyAvailabilityMessage({state:'saved',pending:false,available:true,undoDepth:2,redoDepth:1})).toBe('Αναίρεση: 2 βήματα · Επαναφορά: 1 βήμα');
  });
});


describe('server-bounded direct history selection',()=>{
  it('exposes only proven multi-step ancestor and unique redo paths',()=>{
    const rows=[
      {id:'future2',parentId:'future1'},
      {id:'old2',parentId:'old1'},
      {id:'future1',parentId:'current'},
      {id:'current',parentId:'old2',current:true},
      {id:'old1',parentId:null},
    ];
    const plans=reachableHistoryNavigation(rows,2,2);
    expect(plans.get('old2')).toEqual({direction:'undo',pointIds:['old2']});
    expect(plans.get('old1')).toEqual({direction:'undo',pointIds:['old2','old1']});
    expect(plans.get('future2')).toEqual({direction:'redo',pointIds:['future1','future2']});
    expect(plans.has('current')).toBe(false);
    expect(reachableHistoryNavigation(rows,1,0).has('old1')).toBe(false);
  });
  it('fails closed for truncated, detached, ambiguous, duplicate or missing current history',()=>{
    const rows=[
      {id:'current',parentId:'missing',current:true},
      {id:'redo1',parentId:'current'},
      {id:'redo2',parentId:'current'},
      {id:'detached',parentId:null},
    ];
    const plans=reachableHistoryNavigation(rows,20,20);
    expect(plans.size).toBe(0);
    expect(reachableHistoryNavigation([{id:'same',current:true},{id:'same'}],2,2).size).toBe(0);
    expect(reachableHistoryNavigation([{id:'a',parentId:null}],2,2).size).toBe(0);
    expect(reachableHistoryNavigation([{id:'a',parentId:'b',current:true},{id:'b',parentId:'a',current:true}],3,1).size).toBe(0);
  });
});
