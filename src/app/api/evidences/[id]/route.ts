import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {currentUser} from '@/lib/auth';
import {db} from '@/lib/db';

type Evidence={path:string;original_name:string;mime_type:string|null;size:number;company_id:string;inspector_id:string|null};

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return new Response('Não autenticado',{status:401});
  const {id}=await params;
  const evidence=db.prepare('SELECT e.path,e.original_name,e.mime_type,e.size,i.company_id,i.inspector_id FROM evidences e JOIN inspections i ON i.id=e.inspection_id WHERE e.id=?').get(id) as Evidence|undefined;
  if(!evidence||user.role!=='SUPER_ADMIN'&&evidence.company_id!==user.company_id||user.role==='INSPECTOR'&&evidence.inspector_id!==user.id)return new Response('Não encontrado',{status:404});
  const root=path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_PATH||path.join(/*turbopackIgnore: true*/ process.cwd(),'storage'));
  const full=path.resolve(/*turbopackIgnore: true*/ evidence.path);
  if(full!==root&&!full.startsWith(root+path.sep)||!fs.existsSync(full))return new Response('Arquivo não encontrado',{status:404});
  const stat=fs.statSync(full);const range=req.headers.get('range');
  const baseHeaders={'Content-Type':evidence.mime_type||'application/octet-stream','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(evidence.original_name)}`,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(range){
    const match=/bytes=(\d*)-(\d*)/.exec(range);if(!match)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});
    const start=match[1]?Number(match[1]):0;const end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;
    if(start>end||start>=stat.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});
    const stream=Readable.toWeb(fs.createReadStream(full,{start,end}));
    return new Response(stream as unknown as BodyInit,{status:206,headers:{...baseHeaders,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${stat.size}`}});
  }
  const stream=Readable.toWeb(fs.createReadStream(full));
  return new Response(stream as unknown as BodyInit,{headers:{...baseHeaders,'Content-Length':String(stat.size)}});
}
