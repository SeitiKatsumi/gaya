import {z} from 'zod';

// ponytail: at most two central recipients; native email inputs handle the form.
export const reportRecipients=z.string().trim().max(510).refine(value=>{
  if(!value)return true;
  const emails=value.split(',').map(email=>email.trim());
  return emails.length<=2&&emails.every(email=>z.email().max(254).safeParse(email).success);
}).transform(value=>[...new Set(value.split(',').map(email=>email.trim()).filter(Boolean))].join(', '));
