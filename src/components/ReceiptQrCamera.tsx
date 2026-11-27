import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import type { ReceiptQrResult } from '../lib/receiptQr';
import type { createReceiptQrDecoder } from '../lib/receiptQrImage';

export function ReceiptQrCamera({onCancel,onCapture}:{onCancel:()=>void;onCapture:(file:File,result:ReceiptQrResult)=>void}){
  const videoRef=useRef<HTMLVideoElement>(null);
  const cancelRef=useRef<HTMLButtonElement>(null);
  const captureRef=useRef(onCapture);captureRef.current=onCapture;
  const [status,setStatus]=useState('Ζητείται πρόσβαση στην κάμερα…');
  useEffect(()=>{
    cancelRef.current?.focus();
    let stopped=false,stream:MediaStream|undefined,decoder:ReturnType<typeof createReceiptQrDecoder>|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    const stop=()=>{stopped=true;if(timer)clearTimeout(timer);decoder?.close();stream?.getTracks().forEach(track=>track.stop());if(videoRef.current)videoRef.current.srcObject=null};
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
    const loop=async()=>{
      if(stopped)return;
      const video=videoRef.current;
      if(video&&video.readyState>=2&&video.videoWidth&&video.videoHeight&&context&&decoder){
        const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
        canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
        context.drawImage(video,0,0,canvas.width,canvas.height);
        const result=await decoder.decode(context.getImageData(0,0,canvas.width,canvas.height));
        if(stopped)return;
        if(result.kind==='unavailable'){stop();setStatus('Η ανάγνωση QR δεν είναι διαθέσιμη. Χρησιμοποίησε φωτογραφία ή αρχείο.');return}
        if(result.kind!=='none'&&result.kind!=='product'){
          const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
          if(stopped)return;
          stop();
          if(blob)captureRef.current(new File([blob],'receipt-camera.jpg',{type:'image/jpeg'}),result);
          else setStatus('Δεν αποθηκεύτηκε η λήψη. Χρησιμοποίησε φωτογραφία ή αρχείο.');
          return;
        }
      }
      timer=setTimeout(()=>void loop().catch(()=>{if(!stopped){stop();setStatus('Η ζωντανή σάρωση σταμάτησε. Χρησιμοποίησε φωτογραφία ή αρχείο.')}}),500);
    };
    void (async()=>{
      try{
        const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
        if(stopped){media.getTracks().forEach(track=>track.stop());return}
        stream=media;
        const video=videoRef.current;
        if(!video)throw new Error('CAMERA_UNAVAILABLE');
        video.srcObject=media;await video.play();
        if(stopped)return;
        const module=await import('../lib/receiptQrImage');if(stopped)return;
        decoder=module.createReceiptQrDecoder();
        setStatus('Κράτησε το QR μέσα στην εικόνα. Η λήψη και η αναγνώριση γίνονται τοπικά.');
        await loop();
      }catch{if(!stopped){stop();setStatus('Δεν ήταν δυνατή η πρόσβαση στην κάμερα. Χρησιμοποίησε φωτογραφία ή αρχείο.')}}
    })();
    return stop;
  },[]);
  return <section className="receipt-qr-camera" aria-label="Ζωντανή σάρωση QR απόδειξης"><video ref={videoRef} muted playsInline aria-label="Προεπισκόπηση κάμερας απόδειξης"/><p role="status" aria-live="polite">{status}</p><Button ref={cancelRef} type="button" variant="secondary" onClick={onCancel}>Κλείσιμο κάμερας</Button></section>;
}
