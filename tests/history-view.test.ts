import {describe,expect,it} from 'vitest';
import {classifyHistoryPoints,historyAvailabilityMessage} from '../src/lib/historyView.js';

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
