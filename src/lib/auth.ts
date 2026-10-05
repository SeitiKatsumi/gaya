import {SignJWT,jwtVerify} from 'jose';
import {cookies} from 'next/headers';
import {db} from './db';

// ponytail: preserve stored role codes; operational labels are Coordenador and Responsável técnico.
export type Role='SUPER_ADMIN'|'SUPERVISOR'|'INSPECTOR';
export type SessionUser={id:string;company_id:string|null;name:string;email:string;role:Role};
export function homePath(user:SessionUser){return user.role==='INSPECTOR'?'/relatorios':'/relatorios-mensais';}
const key=()=>new TextEncoder().encode(process.env.SESSION_SECRET||'development-secret-change-me-at-least-32');

export async function createToken(user:SessionUser){return new SignJWT({...user}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('12h').sign(key())}

export async function currentUser():Promise<SessionUser|null>{
  const token=(await cookies()).get('gaya_session')?.value;if(!token)return null;
  try{
    const {payload}=await jwtVerify(token,key());
    const row=db.prepare("SELECT u.id,u.company_id,u.name,u.email,u.role FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=? AND u.active=1 AND (u.role='SUPER_ADMIN' OR c.active=1)").get(String(payload.id)) as SessionUser|undefined;
    return row||null;
  }catch{return null}
}

export function can(user:SessionUser,roles:Role[]){return roles.includes(user.role)}
