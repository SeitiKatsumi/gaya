'use client';

import {useCallback,useEffect,useRef,useState,type ChangeEvent} from 'react';
import {Camera,Mic,Pause,Trash2,Upload,Video} from 'lucide-react';

type MediaKind='audio'|'video';

function supportedMime(kind:MediaKind){
  const candidates=kind==='audio'
    ?['audio/webm;codecs=opus','audio/mp4','audio/webm']
    :['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm'];
  return candidates.find(type=>MediaRecorder.isTypeSupported(type))||'';
}

function extension(type:string,kind:MediaKind){
  if(type.includes('mp4'))return kind==='audio'?'m4a':'mp4';
  return 'webm';
}

function attachFile(input:HTMLInputElement|null,file:File){
  if(!input)return;
  try{
    const transfer=new DataTransfer();
    transfer.items.add(file);
    input.files=transfer.files;
  }catch{
    // O evento formdata abaixo cobre navegadores que não permitem atribuir input.files.
  }
}

function MediaCapture({kind,label}:{kind:MediaKind;label:string}){
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const rootRef=useRef<HTMLDivElement>(null);
  const recorderRef=useRef<MediaRecorder|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const recordedRef=useRef<File|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const [recording,setRecording]=useState(false);
  const [seconds,setSeconds]=useState(0);
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [error,setError]=useState('');
  const Icon=kind==='audio'?Mic:Video;

  const stopTracks=useCallback(()=>{
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
  },[]);

  const selectFile=useCallback((next:File|null)=>{
    setError('');
    setFile(next);
    recordedRef.current=next;
    if(preview)URL.revokeObjectURL(preview);
    setPreview(next?URL.createObjectURL(next):'');
    if(next)attachFile(inputRef.current,next);
  },[preview]);

  useEffect(()=>{
    if(!recording)return;
    const timer=window.setInterval(()=>setSeconds(value=>value+1),1000);
    return()=>window.clearInterval(timer);
  },[recording]);

  useEffect(()=>{
    const form=rootRef.current?.closest('form');
    if(!form)return;
    const onFormData=(event:FormDataEvent)=>{
      const recorded=recordedRef.current;
      if(!recorded)return;
      event.formData.delete(kind);
      event.formData.append(kind,recorded,recorded.name);
    };
    form.addEventListener('formdata',onFormData);
    return()=>form.removeEventListener('formdata',onFormData);
  },[kind]);

  useEffect(()=>()=>{
    if(recorderRef.current?.state==='recording')recorderRef.current.stop();
    stopTracks();
  },[stopTracks]);

  const start=async()=>{
    setError('');
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      setError('Este navegador não oferece gravação direta. Use Enviar arquivo.');
      return;
    }
    try{
      const stream=await navigator.mediaDevices.getUserMedia(kind==='audio'
        ?{audio:true}
        :{audio:true,video:{facingMode:{ideal:'environment'}}});
      streamRef.current=stream;
      if(kind==='video'&&videoRef.current){
        videoRef.current.srcObject=stream;
        await videoRef.current.play().catch(()=>undefined);
      }
      const mimeType=supportedMime(kind);
      const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);
      chunksRef.current=[];
      recorder.ondataavailable=event=>{if(event.data.size)chunksRef.current.push(event.data)};
      recorder.onerror=()=>setError('A gravação foi interrompida pelo navegador.');
      recorder.onstop=()=>{
        const type=recorder.mimeType||mimeType||(kind==='audio'?'audio/webm':'video/webm');
        const blob=new Blob(chunksRef.current,{type});
        if(blob.size){
          const stamp=new Date().toISOString().replace(/[:.]/g,'-');
          selectFile(new File([blob],`${kind}-${stamp}.${extension(type,kind)}`,{type,lastModified:Date.now()}));
        }
        stopTracks();
      };
      recorderRef.current=recorder;
      setSeconds(0);
      setRecording(true);
      recorder.start(750);
    }catch(cause){
      stopTracks();
      setError(cause instanceof DOMException&&cause.name==='NotAllowedError'
        ?'Permita o acesso ao microfone e à câmera nas configurações do navegador.'
        :'Não foi possível iniciar a gravação neste dispositivo.');
    }
  };

  const stop=()=>{
    const recorder=recorderRef.current;
    if(recorder?.state==='recording')recorder.stop();
    setRecording(false);
  };

  const clear=()=>{
    if(recording)stop();
    if(inputRef.current)inputRef.current.value='';
    selectFile(null);
  };

  const choose=(event:ChangeEvent<HTMLInputElement>)=>{
    const selected=event.target.files?.[0]||null;
    recordedRef.current=null;
    if(preview)URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(selected?URL.createObjectURL(selected):'');
    setError('');
  };

  return <div ref={rootRef} className={`media-capture ${recording?'is-recording':''}`}>
    <div className="capture-buttons">
      <button type="button" className={`btn ${recording?'btn-recording':'btn-ghost'}`} onClick={recording?stop:start}>
        {recording?<Pause size={15}/>:<Icon size={15}/>} {recording?`Parar · ${seconds}s`:`Gravar ${label.toLowerCase()}`}
      </button>
      <button type="button" className="btn btn-ghost" onClick={()=>inputRef.current?.click()} title={`Enviar ${label.toLowerCase()}`}>
        <Upload size={15}/> Enviar
      </button>
      <input ref={inputRef} hidden type="file" name={kind} accept={`${kind}/*`} capture={kind==='video'?'environment':'user'} onChange={choose}/>
    </div>
    {kind==='video'&&<video ref={videoRef} className={`capture-preview live ${recording?'visible':''}`} muted playsInline/>}
    {preview&&kind==='audio'&&<audio className="capture-preview" src={preview} controls preload="metadata"/>}
    {preview&&kind==='video'&&!recording&&<video className="capture-preview visible" src={preview} controls playsInline preload="metadata"/>}
    {file&&<div className="capture-file"><span title={file.name}>{file.name}</span><small>{(file.size/1024/1024).toFixed(1)} MB</small><button type="button" onClick={clear} title={`Remover ${label.toLowerCase()}`}><Trash2 size={13}/></button></div>}
    {error&&<p className="capture-error" role="alert">{error}</p>}
  </div>;
}

export function EvidenceInputs(){
  const [photo,setPhoto]=useState('');
  return <div className="evidence-inputs">
    <div className="evidence-picker photo-picker">
      <label className={`btn ${photo?'btn-soft':'btn-ghost'}`}><Camera size={15}/>{photo||'Foto'}<input type="file" name="photo" accept="image/*" capture="environment" onChange={event=>setPhoto(event.target.files?.[0]?.name||'')}/></label>
      {photo&&<button className="clear-file" type="button" title="Remover foto" onClick={event=>{const input=event.currentTarget.parentElement?.querySelector('input');if(input)input.value='';setPhoto('')}}><Trash2 size={12}/></button>}
    </div>
    <MediaCapture kind="audio" label="Áudio"/>
    <MediaCapture kind="video" label="Vídeo"/>
  </div>;
}
