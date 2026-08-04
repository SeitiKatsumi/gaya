'use client';

import {Trash2} from 'lucide-react';

export function ConfirmSubmit({label='Excluir',message,className='btn btn-danger'}:{label?:string;message:string;className?:string}){
  return <button type="submit" className={className} onClick={event=>{if(!window.confirm(message))event.preventDefault()}}><Trash2 size={14}/>{label}</button>;
}
