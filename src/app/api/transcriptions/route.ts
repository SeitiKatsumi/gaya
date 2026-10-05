import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {audioLimit,transcribeAudio,TranscriptionError} from '@/lib/transcription';

export const runtime='nodejs';
export async function POST(req:Request){
  if(!await currentUser())return NextResponse.json({error:'Entre novamente.'},{status:401});
  const origin=req.headers.get('origin'),expected=new URL(process.env.APP_URL||req.url).origin;
  if(origin&&origin!==expected)return NextResponse.json({error:'Origem inválida.'},{status:403});
  if(Number(req.headers.get('content-length'))>audioLimit()+1024*1024)return NextResponse.json({error:'O áudio excede o limite permitido.'},{status:413});
  try{
    const file=(await req.formData()).get('audio');
    if(!(file instanceof File))return NextResponse.json({error:'Selecione um áudio.'},{status:400});
    return NextResponse.json({text:await transcribeAudio(file)});
  }catch(error){return NextResponse.json({error:error instanceof TranscriptionError?error.message:'Não foi possível ler o áudio. Confira o arquivo e tente novamente.'},{status:error instanceof TranscriptionError?error.status:400});}
}
