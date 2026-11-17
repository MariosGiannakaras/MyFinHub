import {readFileSync} from 'node:fs';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {ApiError,loadData,loadHistory,saveData} from '../src/lib/api.js';
import {SequentialQueue,remoteRevisionAction} from '../src/lib/persistenceQueue.js';
import type {FinanceData} from '../src/types.js';

const candidate={state:{events:[{id:'synthetic-finance-event'}]},updatedAt:'2026-11-17T12:00:00.000Z'} as unknown as FinanceData;
const snapshot=(revision:string)=>({data:candidate,revision,filePath:'supabase',lastSavedAt:candidate.updatedAt});
const history=(revision:string)=>({
  available:true,generation:'9',financeRevision:revision,currentPointId:'point-'+revision,
  canUndo:false,canRedo:false,undoDepth:0,redoDepth:0,points:[],
});
const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json'},
});
afterEach(()=>vi.unstubAllGlobals());

describe('#649 I19.04 finance write and cross-session revision recovery',()=>{
  it('never replays a 503 finance write that already committed; only read-back can verify it',async()=>{
    let writes=0;
    const requests:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input);
      requests.push((init?.method??'GET')+' '+path);
      if(path==='/api/data'&&init?.method==='PUT'){
        writes+=1;
        const headers=new Headers(init.headers);
        expect(headers.get('if-match')).toBe('17');
        expect(headers.get('x-rheomiq-history-generation')).toBe('9');
        return response(503,{error:'The result is unconfirmed',code:'DATA_UNAVAILABLE'});
      }
      if(path==='/api/data')return response(200,snapshot('18'));
      if(path==='/api/history')return response(200,history('18'));
      throw new Error('Unexpected transport '+path);
    }));
    const queue=new SequentialQueue<string>(async()=>{await saveData(candidate,'17','9','Synthetic event')});
    const results=await Promise.allSettled([
      queue.enqueueWithReceipt('first'),
      queue.enqueueWithReceipt('dependent'),
    ]);
    expect(results.every(result=>result.status==='rejected'&&result.reason instanceof ApiError&&result.reason.status===503)).toBe(true);
    await queue.whenIdle();
    expect(queue.hasWork()).toBe(false);
    expect(writes).toBe(1);
    expect(remoteRevisionAction('17','18',false,true)).toBe('conflict');
    const [data,verifiedHistory]=await Promise.all([loadData(),loadHistory()]);
    expect(data.revision).toBe('18');
    expect(verifiedHistory.financeRevision).toBe(data.revision);
    expect(requests).toEqual(['PUT /api/data','GET /api/data','GET /api/history']);
    expect(writes).toBe(1);
  });

  it('drops dependent writes after 409 stale-revision rejection without retry',async()=>{
    let writes=0;
    vi.stubGlobal('fetch',vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
      if(init?.method!=='PUT')throw new Error('Unexpected retry/read');
      writes+=1;
      return response(409,{error:'Stale revision',code:'REVISION_CONFLICT'});
    }));
    const queue=new SequentialQueue<string>(async()=>{await saveData(candidate,'17','9','Synthetic conflict')});
    const results=await Promise.allSettled([
      queue.enqueueWithReceipt('stale'),
      queue.enqueueWithReceipt('dependent'),
    ]);
    expect(results.every(result=>result.status==='rejected'&&result.reason instanceof ApiError&&result.reason.code==='REVISION_CONFLICT')).toBe(true);
    await queue.whenIdle();
    expect(writes).toBe(1);
    expect(remoteRevisionAction('17','18',false,true)).toBe('conflict');
  });

  it('does not treat a finance GET with lagging history as a consistent receipt',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      if(init?.method==='PUT')throw new Error('Recovery must be read-only');
      return String(input)==='/api/data'
        ? response(200,snapshot('18'))
        : response(200,history('17'));
    }));
    const [data,unverifiedHistory]=await Promise.all([loadData(),loadHistory()]);
    expect(unverifiedHistory.financeRevision).not.toBe(data.revision);
    const hook=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
    expect(hook).toContain('if(!historyMatchesRevision(nextHistory,nextData.revision))');
    expect(hook).toContain("setCurrentSaveState('conflict')");
  });

  it('locks unchanged durable recipes behind the actual earlier receipt',()=>{
    const hook=readFileSync(new URL('../src/hooks/useFinance.ts',import.meta.url),'utf8');
    expect(hook).toContain('if(next===current){');
    expect(hook).toContain('canAcknowledgeDurableNoop(saveStateRef.current,coordinator.hasWork())');
    expect(hook).toContain('await persist(next,financeChangeLabel(current,next),true)!');
    expect(hook).not.toContain('if(next!==current)await persist(next,financeChangeLabel(current,next),true)!');
  });
});
