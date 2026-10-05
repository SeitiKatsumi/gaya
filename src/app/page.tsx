import {redirect} from 'next/navigation';
import {currentUser,homePath} from '@/lib/auth';
export default async function Home(){const user=await currentUser();redirect(user?homePath(user):'/login');}