import assert from 'node:assert/strict';
import fs from 'node:fs';
import {audioLimit,transcribeAudio,TranscriptionError,validateAudio} from '../src/lib/transcription.ts';

const wave=Buffer.alloc(44);wave.write('RIFF');wave.writeUInt32LE(36,4);wave.write('WAVE',8);wave.write('fmt ',12);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(16000,24);wave.writeUInt32LE(32000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);
validateAudio({size:wave.length,type:'audio/wav'},wave);
for(const file of [{size:0,type:'audio/wav'},{size:audioLimit()+1,type:'audio/wav'},{size:10,type:'text/plain'}])assert.throws(()=>validateAudio(file),TranscriptionError);
assert.throws(()=>validateAudio({size:15,type:'audio/wav'},Buffer.from('not audio bytes')),TranscriptionError);
const originalCache=process.env.LOCAL_WHISPER_CACHE;process.env.LOCAL_WHISPER_CACHE='__missing_local_whisper_cache__';
try{await assert.rejects(transcribeAudio(new File([wave],'voice.wav',{type:'audio/wav'})),(error:unknown)=>error instanceof TranscriptionError&&error.status===503);}finally{if(originalCache===undefined)delete process.env.LOCAL_WHISPER_CACHE;else process.env.LOCAL_WHISPER_CACHE=originalCache;}
const path=process.argv[2];if(path){const started=Date.now(),text=await transcribeAudio(new File([fs.readFileSync(path)],'voice.wav',{type:'audio/wav'}));assert.ok(text.length>10);assert.match(text.toLowerCase(),/quinze|15|portaria|armazenamento/);console.log(`Whisper local transcreveu fala sintética em ${((Date.now()-started)/1000).toFixed(1)}s: ${text}`);}
console.log('Transcrição: formatos, assinatura do arquivo, tamanho e configuração ausente validados.');
if(process.env.TEST_APP_URL){
  const base=process.env.TEST_APP_URL;
  const unauthenticated=await fetch(base+'/api/transcriptions',{method:'POST',body:new FormData()});assert.equal(unauthenticated.status,401);
  let cookie=process.env.TEST_AUTH_COOKIE;
  if(!cookie&&process.env.TEST_LOGIN_EMAIL&&process.env.TEST_LOGIN_PASSWORD){
    const login=await fetch(base+'/api/auth/login',{method:'POST',redirect:'manual',body:new URLSearchParams({email:process.env.TEST_LOGIN_EMAIL,password:process.env.TEST_LOGIN_PASSWORD})});
    assert.equal(login.status,303);cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
  }
  if(cookie){
    const denied=await fetch(base+'/api/transcriptions',{method:'POST',headers:{cookie,origin:'https://origem-invalida.example'},body:new FormData()});assert.equal(denied.status,403);
    const empty=await fetch(base+'/api/transcriptions',{method:'POST',headers:{cookie},body:new FormData()});assert.equal(empty.status,400);
    const fake=new FormData();fake.set('audio',new File(['text'],'fake.wav',{type:'audio/wav'}));assert.equal((await fetch(base+'/api/transcriptions',{method:'POST',headers:{cookie},body:fake})).status,415);
    const wrongType=new FormData();wrongType.set('audio',new File([wave],'file.txt',{type:'text/plain'}));assert.equal((await fetch(base+'/api/transcriptions',{method:'POST',headers:{cookie},body:wrongType})).status,415);
    const oversized=new FormData();oversized.set('audio',new File([new Uint8Array(audioLimit()+1)],'large.wav',{type:'audio/wav'}));assert.equal((await fetch(base+'/api/transcriptions',{method:'POST',headers:{cookie},body:oversized})).status,413);
    if(path){const audio=new FormData();audio.set('audio',new File([fs.readFileSync(path)],'voice.wav',{type:'audio/wav'}));const started=Date.now(),response=await fetch(base+'/api/transcriptions',{method:'POST',headers:{cookie},body:audio});assert.equal(response.status,200);const result=await response.json() as {text:string};assert.match(result.text.toLowerCase(),/quinze|15|portaria|armazenamento/);console.log(`Endpoint autenticado transcreveu fala sintética em ${((Date.now()-started)/1000).toFixed(1)}s.`);}
  }
  console.log('Transcrição: autenticação HTTP validada'+(cookie?', origem e arquivo inválido validados.':'.'));
}
