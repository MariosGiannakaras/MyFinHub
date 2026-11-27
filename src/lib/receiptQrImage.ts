import type { ReceiptQrResult } from './receiptQr.js';

const MAX_SIDE=2400;
const MAX_PIXELS=MAX_SIDE*MAX_SIDE;
const DECODE_TIMEOUT=12000;
const unavailable:ReceiptQrResult={kind:'unavailable'};

/** Bounded worker; one in-flight frame, terminate on abort or timeout. */
export function createReceiptQrDecoder(){
  const worker=new Worker(new URL('./receiptQr.worker.ts',import.meta.url),{type:'module'});
  let finish:((result:ReceiptQrResult)=>void)|null=null,closed=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const resolve=(result:ReceiptQrResult)=>{if(timer)clearTimeout(timer);timer=undefined;const callback=finish;finish=null;callback?.(result)};
  const close=()=>{if(closed)return;closed=true;worker.terminate();resolve(unavailable)};
  worker.onmessage=(event:MessageEvent<ReceiptQrResult>)=>resolve(event.data);
  worker.onerror=close;
  worker.onmessageerror=close;
  return {
    decode:(pixels:ImageData)=>new Promise<ReceiptQrResult>(done=>{
      if(closed||finish||pixels.width<1||pixels.height<1||pixels.width>MAX_SIDE||pixels.height>MAX_SIDE||pixels.width*pixels.height>MAX_PIXELS){done(unavailable);return}
      finish=done;timer=setTimeout(close,DECODE_TIMEOUT);
      try{worker.postMessage({pixels},[pixels.data.buffer as ArrayBuffer])}catch{close()}
    }),
    close,
  };
}

export async function scanReceiptQr(image:Blob,signal?:AbortSignal):Promise<ReceiptQrResult>{
  let bitmap:ImageBitmap|undefined,decoder:ReturnType<typeof createReceiptQrDecoder>|undefined;
  const abort=()=>decoder?.close();
  try{
    if(signal?.aborted)return unavailable;
    bitmap=await createImageBitmap(image);
    if(signal?.aborted||bitmap.width<1||bitmap.height<1||bitmap.width>MAX_SIDE||bitmap.height>MAX_SIDE||bitmap.width*bitmap.height>MAX_PIXELS)return unavailable;
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;canvas.height=bitmap.height;
    const context=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
    if(!context)return unavailable;
    context.drawImage(bitmap,0,0);
    decoder=createReceiptQrDecoder();
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)return unavailable;
    return await decoder.decode(context.getImageData(0,0,canvas.width,canvas.height));
  }catch{return unavailable}
  finally{signal?.removeEventListener('abort',abort);decoder?.close();bitmap?.close()}
}
