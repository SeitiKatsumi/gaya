import {redirect} from 'next/navigation';
import {currentUser,homePath} from '@/lib/auth';

export default async function Dashboard({searchParams}:{searchParams:Promise<{mes?:string;unidade?:string;ok?:string;erro?:string}>}){
  const user=await currentUser();if(!user)redirect('/login');
  const query=await searchParams,parameters=new URLSearchParams();
  for(const key of ['mes','unidade','ok','erro'] as const)if(typeof query[key]==='string')parameters.set(key,query[key]!);
  // Existing bookmarks retain monthly filters after removing the duplicate overview.
  redirect(homePath(user)+(user.role!=='INSPECTOR'&&parameters.size?`?${parameters}`:''));
}