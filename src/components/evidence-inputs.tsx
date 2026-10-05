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

function MediaCapture({kind,label,onTranscript,formId}:{kind:MediaKind;label:string;onTranscript?:(text:string)=>void;formId?:string}){
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const rootRef=useRef<HTMLDivElement>(null);
  const recorderRef=useRef<MediaRecorder|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const recordedRef=useRef<File|null>(null);
  const chunksRef=useRef<Blob[]>([]);
  const transcriptionRef=useRef<AbortController|null>(null);
  const [recording,setRecording]=useState(false);
  const [seconds,setSeconds]=useState(0);
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [error,setError]=useState('');
  const [transcriptError,setTranscriptError]=useState('');
  const [transcribing,setTranscribing]=useState(false);
  const [transcribed,setTranscribed]=useState(false);
  const Icon=kind==='audio'?Mic:Video;

  const stopTracks=useCallback(()=>{
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
  },[]);

  const transcribe=useCallback(async(next:File)=>{
    if(kind!=='audio'||!onTranscript)return;
    transcriptionRef.current?.abort();
    const controller=new AbortController();transcriptionRef.current=controller;
    setTranscribing(true);setTranscribed(false);setTranscriptError('');
    try{
      const data=new FormData();data.set('audio',next);
      const result=await fetch('/api/transcriptions',{method:'POST',body:data,signal:controller.signal});
      const payload=await result.json() as {text?:string;error?:string};
      if(!result.ok)throw new Error(payload.error||'Não foi possível transcrever.');
      if(payload.text){onTranscript(payload.text);setTranscribed(true);setError('');}
    }catch(cause){if(!controller.signal.aborted)setTranscriptError(cause instanceof Error?cause.message:'Falha na transcrição. Você pode manter o áudio e digitar as observações.');}
    finally{if(transcriptionRef.current===controller){setTranscribing(false);transcriptionRef.current=null;}}
  },[kind,onTranscript]);

  const selectFile=useCallback((next:File|null)=>{
    setError('');
    setFile(next);
    recordedRef.current=next;
    if(preview)URL.revokeObjectURL(preview);
    setPreview(next?URL.createObjectURL(next):'');
    if(next){attachFile(inputRef.current,next);void transcribe(next);}
  },[preview,transcribe]);

  useEffect(()=>{
    if(!recording)return;
    const timer=window.setInterval(()=>setSeconds(value=>value+1),1000);
    return()=>window.clearInterval(timer);
  },[recording]);

  useEffect(()=>{
    const form=inputRef.current?.form||rootRef.current?.closest('form');
    if(!form)return;
    const onFormData=(event:FormDataEvent)=>{
      const recorded=recordedRef.current;
      if(!recorded)return;
      event.formData.delete(kind);
      event.formData.append(kind,recorded,recorded.name);
    };
    form.addEventListener('formdata',onFormData);
    return()=>form.removeEventListener('formdata',onFormData);
  },[kind,formId]);

  useEffect(()=>{
    const form=inputRef.current?.form||rootRef.current?.closest('form');
    if(!form)return;
    const preventEarlySave=(event:Event)=>{if(recording||transcribing){event.preventDefault();setError(recording?'Pare a gravação antes de salvar.':'Aguarde a transcrição antes de salvar.');}};
    form.addEventListener('submit',preventEarlySave);
    return()=>form.removeEventListener('submit',preventEarlySave);
  },[recording,transcribing,formId]);

  useEffect(()=>()=>{
    transcriptionRef.current?.abort();
    if(recorderRef.current?.state==='recording'){recorderRef.current.onstop=null;recorderRef.current.stop();}
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
    transcriptionRef.current?.abort();setTranscribing(false);setTranscribed(false);setTranscriptError('');
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
    transcriptionRef.current?.abort();setTranscribing(false);setTranscribed(false);setTranscriptError('');
    if(selected)void transcribe(selected);
  };

  return <div ref={rootRef} className={`media-capture ${recording?'is-recording':''}`}>
    <div className="capture-buttons">
      <button type="button" className={`btn ${recording?'btn-recording':'btn-ghost'}`} disabled={transcribing} onClick={recording?stop:start}>
        {recording?<Pause size={15}/>:<Icon size={15}/>} {recording?`Parar · ${seconds}s`:`Gravar ${label.toLowerCase()}`}
      </button>
      <button type="button" className="btn btn-ghost" disabled={recording||transcribing} onClick={()=>inputRef.current?.click()} title={`Enviar ${label.toLowerCase()}`}>
        <Upload size={15}/> Enviar
      </button>
      <input ref={inputRef} hidden type="file" form={formId} name={kind} accept={`${kind}/*`} capture={kind==='video'?'environment':'user'} onChange={choose}/>
    </div>
    {kind==='video'&&<video ref={videoRef} className={`capture-preview live ${recording?'visible':''}`} muted playsInline/>}
    {preview&&kind==='audio'&&<audio className="capture-preview" src={preview} controls preload="metadata"/>}
    {preview&&kind==='video'&&!recording&&<video className="capture-preview visible" src={preview} controls playsInline preload="metadata"/>}
    {file&&<div className="capture-file"><span title={file.name}>{file.name}</span><small>{(file.size/1024/1024).toFixed(1)} MB</small><button type="button" disabled={recording} onClick={clear} title={`Remover ${label.toLowerCase()}`}><Trash2 size={13}/></button></div>}
    {kind==='audio'&&file&&onTranscript&&!transcribed&&<button type="button" className="btn btn-ghost" disabled={recording||transcribing} onClick={()=>void transcribe(file)}>{transcribing?'Transcrevendo…':'Tentar transcrição novamente'}</button>}
    {transcribed&&<p className="muted" role="status">Transcrição inserida nas observações. Confira o texto antes de salvar.</p>}
    {error&&<p className="capture-error" role="alert">{error}</p>}
    {transcriptError&&<p className="muted">{transcriptError}</p>}
  </div>;
}

export function EvidenceInputs({compact=false,onTranscript,formId}:{compact?:boolean;onTranscript?:(text:string)=>void;formId?:string}={}){
  const [photo,setPhoto]=useState('');
  const [photoError,setPhotoError]=useState(''),[converting,setConverting]=useState(false);
  const photoRef=useRef<HTMLInputElement>(null),preparedPhoto=useRef<File|null>(null),photoSelection=useRef(0);
  useEffect(()=>{
    const form=photoRef.current?.form;if(!form)return;
    const includePhoto=(event:FormDataEvent)=>{if(preparedPhoto.current){event.formData.delete('photo');event.formData.append('photo',preparedPhoto.current,preparedPhoto.current.name);}};
    form.addEventListener('formdata',includePhoto);return()=>form.removeEventListener('formdata',includePhoto);
  },[formId]);
  useEffect(()=>{
    const form=photoRef.current?.form;if(!form)return;
    const finishConversion=(event:Event)=>{if(converting){event.preventDefault();setPhotoError('Aguarde a preparação da foto antes de salvar.');}};
    form.addEventListener('submit',finishConversion);return()=>form.removeEventListener('submit',finishConversion);
  },[converting,formId]);
  const choosePhoto=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0],selection=++photoSelection.current;
    preparedPhoto.current=null;setConverting(false);setPhotoError('');setPhoto(file?.name||'');
    if(!file)return;
    if(['image/jpeg','image/png'].includes(file.type)){preparedPhoto.current=file;return;}
    setConverting(true);let objectUrl='';
    try{
      objectUrl=URL.createObjectURL(file);const picture=new Image();picture.src=objectUrl;
      await picture.decode();const canvas=document.createElement('canvas');canvas.width=picture.naturalWidth;canvas.height=picture.naturalHeight;
      const context=canvas.getContext('2d');if(!context)throw new Error('Canvas indisponível');
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(picture,0,0);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Conversão indisponível')),'image/jpeg',.92));
      if(selection!==photoSelection.current)return;
      const jpeg=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
      preparedPhoto.current=jpeg;attachFile(photoRef.current,jpeg);setPhoto(jpeg.name);setPhotoError('');
    }catch{if(selection===photoSelection.current){if(photoRef.current)photoRef.current.value='';preparedPhoto.current=null;setPhoto('');setPhotoError('Não foi possível preparar esta foto. Selecione uma imagem JPEG ou PNG.');}}
    finally{if(objectUrl)URL.revokeObjectURL(objectUrl);if(selection===photoSelection.current)setConverting(false);}
  };
  return <div className="evidence-inputs">
    <div className="evidence-picker photo-picker">
      <label className={`btn ${photo?'btn-soft':'btn-ghost'}`}><Camera size={15}/>{converting?'Preparando foto…':photo||'Foto'}<input ref={photoRef} type="file" form={formId} name="photo" accept="image/*" capture="environment" onChange={event=>void choosePhoto(event)}/></label>
      {photo&&<button className="clear-file" type="button" title="Remover foto" onClick={()=>{photoSelection.current++;if(photoRef.current)photoRef.current.value='';preparedPhoto.current=null;setPhoto('');setConverting(false);setPhotoError('')}}><Trash2 size={12}/></button>}
    </div>
    {photoError&&<p className="capture-error" role="alert">{photoError}</p>}
    <MediaCapture kind="audio" label="Áudio" onTranscript={onTranscript} formId={formId}/>
    {!compact&&<MediaCapture kind="video" label="Vídeo" formId={formId}/>}
  </div>;
}
