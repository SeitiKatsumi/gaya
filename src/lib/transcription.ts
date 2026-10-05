import {execFile} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';

const run=promisify(execFile);
const audioTypes=new Set(['audio/webm','audio/ogg','application/ogg','audio/wav','audio/x-wav','audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/aac','audio/flac','audio/x-flac','audio/3gpp','audio/3gpp2','audio/amr']);
export class TranscriptionError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function audioLimit(){const configured=Number(process.env.MAX_AUDIO_SIZE_MB||50);return (Number.isFinite(configured)&&configured>0?configured:50)*1024*1024;}
export function validateAudio(file:{size:number;type:string},bytes?:Uint8Array){
  if(!file.size)throw new TranscriptionError('Selecione um áudio.');
  if(file.size>audioLimit())throw new TranscriptionError('O áudio excede o limite permitido.',413);
  if(!audioTypes.has(file.type.split(';')[0].toLowerCase()))throw new TranscriptionError('Formato de áudio não permitido.',415);
  if(bytes){
    const data=Buffer.from(bytes),prefix=data.subarray(0,12).toString('ascii');
    const recognized=prefix.startsWith('RIFF')&&prefix.slice(8)==='WAVE'||prefix.startsWith('OggS')||prefix.startsWith('ID3')||prefix.startsWith('fLaC')||prefix.startsWith('#!AMR')||prefix.slice(4,8)==='ftyp'||data[0]===0x1a&&data[1]===0x45&&data[2]===0xdf&&data[3]===0xa3||data[0]===0xff&&(data[1]&0xe0)===0xe0;
    if(!recognized)throw new TranscriptionError('O arquivo não contém um áudio reconhecido.',415);
  }
}

const pythonCode=`import json,sys
from faster_whisper import WhisperModel
model=WhisperModel(sys.argv[2],device='cpu',compute_type='int8',cpu_threads=4,download_root=sys.argv[3],local_files_only=True)
segments,_=model.transcribe(sys.argv[1],language='pt',beam_size=1,vad_filter=True,condition_on_previous_text=False)
print(json.dumps({'text':' '.join(segment.text.strip() for segment in segments)},ensure_ascii=True))`;
let transcribing=false;
export async function transcribeAudio(file:File){
  validateAudio(file);
  const bytes=Buffer.from(await file.arrayBuffer());validateAudio(file,bytes);
  // ponytail: reuse the installed local model; one bounded process at a time, a persistent worker only if volume requires it.
  const python=process.env.LOCAL_WHISPER_PYTHON||'python';
  const cache=process.env.LOCAL_WHISPER_CACHE||'';
  if(process.env.TRANSCRIPTION_PROVIDER&&process.env.TRANSCRIPTION_PROVIDER!=='local')throw new TranscriptionError('Configure o provedor local de transcrição. O áudio pode ser salvo sem transcrever.',503);
  if(!cache||!fs.existsSync(cache)||path.isAbsolute(python)&&!fs.existsSync(python))throw new TranscriptionError('A transcrição local não está configurada neste servidor. O áudio pode ser salvo e as observações digitadas.',503);
  if(transcribing)throw new TranscriptionError('Outro áudio está sendo transcrito. Aguarde e tente novamente.',429);
  transcribing=true;let folder:string|undefined;
  try{
    folder=fs.mkdtempSync(path.join(os.tmpdir(),'gaya-transcription-'));
    const filename=path.join(folder,'audio.bin');fs.writeFileSync(filename,bytes,{flag:'wx'});
    const {stdout}=await run(python,['-c',pythonCode,filename,process.env.LOCAL_WHISPER_MODEL||'base',cache],{timeout:120000,maxBuffer:256*1024,windowsHide:true,env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'}});
    const result=JSON.parse(stdout.trim()) as {text?:unknown};
    if(typeof result.text!=='string'||!result.text.trim())throw new TranscriptionError('Não foi identificada fala neste áudio. Confira a gravação ou digite as observações.',422);
    return result.text.trim();
  }catch(error){if(error instanceof TranscriptionError)throw error;throw new TranscriptionError('Não foi possível transcrever o áudio. Ele permanece anexado; tente novamente ou digite as observações.',422);}
  finally{transcribing=false;if(folder){try{fs.unlinkSync(path.join(folder,'audio.bin'));fs.rmdirSync(folder);}catch{}}}
}
