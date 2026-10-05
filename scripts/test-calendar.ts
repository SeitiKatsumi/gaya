import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {db} from '../src/lib/db.ts';
import {addDays,validDate,weeklyDates,calendarDays,visitLanes,type Visit} from '../src/lib/calendar.ts';

assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(addDays('2028-02-28',1),'2028-02-29');
assert.deepEqual(calendarDays('2026-10-01','week'),['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04']);
assert.equal(calendarDays('2026-10-01','month').length,42);
assert.deepEqual(weeklyDates('2026-12-21','2027-01-04'),['2026-12-21','2026-12-28','2027-01-04']);
assert.throws(()=>weeklyDates('2026-10-05','2027-10-07'));assert.throws(()=>weeklyDates('2026-10-05','2026-10-04'));
const lanes=visitLanes([{id:'a',start_time:'08:00',end_time:'12:00'},{id:'b',start_time:'09:00',end_time:'11:00'},{id:'c',start_time:'14:00',end_time:'18:00'}] as Visit[]);
assert.deepEqual(lanes.map(({lane,lanes})=>[lane,lanes]),[[0,2],[1,2],[0,1]]);

// ponytail: test the real local routes with temporary tenants and remove all test records.
const base='http://localhost:3000',tag=`calendar-${Date.now()}`,company=`${tag}-company`,foreign=`${tag}-foreign`,coord=`${tag}-coord`,tech=`${tag}-tech`,secondTech=`${tag}-second`,unit=`${tag}-unit`,secondUnit=`${tag}-other-unit`,foreignUnit=`${tag}-foreign-unit`;
const password='LocalTest123!';
async function post(body:Record<string,unknown>,cookie=''){const res=await fetch(base+'/api/visits',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};}
async function login(id:string){const res=await fetch(base+'/api/auth/login',{method:'POST',body:new URLSearchParams({email:`${id}@test.local`,password}),redirect:'manual'});assert.equal(res.status,303);return res.headers.get('set-cookie')!.split(';')[0];}
async function calendar(cookie:string,view='month'){const res=await fetch(base+`/calendario?date=2026-10-05&view=${view}`,{headers:{cookie}});assert.equal(res.status,200);return res.text();}
try{
  for(const id of [company,foreign])db.prepare('INSERT INTO companies(id,legal_name,trade_name) VALUES(?,?,?)').run(id,id,id);
  for(const [id,role] of [[coord,'SUPERVISOR'],[tech,'INSPECTOR'],[secondTech,'INSPECTOR']])db.prepare('INSERT INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)').run(id,company,id,`${id}@test.local`,bcrypt.hashSync(password,4),role);
  for(const [id,tenant,owner,code] of [[unit,company,tech,'TEST-A'],[secondUnit,company,secondTech,'TEST-B'],[foreignUnit,foreign,null,'FOREIGN']])db.prepare('INSERT INTO units(id,company_id,name,code,responsible_id) VALUES(?,?,?,?,?)').run(id,tenant,id,code,owner);
  const coordinator=await login(coord),responsible=await login(tech),otherResponsible=await login(secondTech);
  const input={intent:'create',unit_id:unit,visit_date:'2026-10-05',start_time:'08:00',end_time:'12:00',notes:'Visita teste'};
  assert.equal((await post(input)).status,401);assert.equal((await post(input,responsible)).status,403);
  assert.equal((await post({...input,unit_id:foreignUnit},coordinator)).status,403);
  assert.equal((await post({...input,visit_date:'2026-02-30'},coordinator)).status,400);
  assert.equal((await post({...input,end_time:'07:00'},coordinator)).status,400);
  assert.equal((await post({...input,repeat_until:'2027-10-07'},coordinator)).status,400);
  const created=await post({...input,repeat_until:'2026-12-31'},coordinator);assert.equal(created.status,200);assert.equal(created.data.count,13);
  const id=created.data.ids[0] as string;
  const other=await post({...input,unit_id:secondUnit,notes:'Outra unidade'},coordinator);assert.equal(other.status,200);
  db.prepare('INSERT INTO visits(id,unit_id,visit_date,start_time,end_time,notes) VALUES(?,?,?,?,?,?)').run(tag,foreignUnit,'2026-10-05','08:00','12:00','Outro cliente');
  const ownerHtml=await calendar(responsible);assert.ok(ownerHtml.includes(id));assert.ok(!ownerHtml.includes(other.data.ids[0]));assert.ok(!ownerHtml.includes(foreignUnit));assert.ok(!ownerHtml.includes('Criar visita'));
  const coordinatorHtml=await calendar(coordinator);assert.ok(coordinatorHtml.includes(id));assert.ok(coordinatorHtml.includes(other.data.ids[0]));assert.ok(!coordinatorHtml.includes(foreignUnit));assert.ok(coordinatorHtml.includes('Criar visita'));
  assert.ok((await calendar(coordinator,'week')).includes('Calendário semanal por horário'));
  for(const intent of ['update','cancel'])assert.equal((await post({...input,intent,id},responsible)).status,403);
  assert.equal((await post({...input,intent:'update',id:tag},coordinator)).status,404);
  assert.equal((await post({...input,intent:'update',id,visit_date:'2026-10-06',start_time:'14:00',end_time:'18:00'},coordinator)).status,200);
  assert.equal((db.prepare('SELECT visit_date FROM visits WHERE id=?').get(id)!).visit_date,'2026-10-06');
  assert.equal((db.prepare('SELECT count(*) n FROM visits WHERE unit_id=? AND visit_date>=?').get(unit,'2026-10-12')!).n,12);
  db.prepare('UPDATE units SET responsible_id=? WHERE id=?').run(secondTech,unit);
  assert.ok(!(await calendar(responsible)).includes(id));assert.ok((await calendar(otherResponsible)).includes(id));
  assert.equal((await post({intent:'cancel',id},coordinator)).status,200);
  assert.equal((db.prepare('SELECT status FROM visits WHERE id=?').get(id)!).status,'CANCELLED');assert.ok(!(await calendar(coordinator)).includes(id));
  assert.equal((await post({...input,intent:'update',id},coordinator)).status,409);
  console.log('Calendário validado: datas, recorrência, horários, sobreposição, criação, edição, cancelamento e isolamento por unidade/empresa.');
}finally{
  db.prepare('DELETE FROM audit_logs WHERE company_id IN (?,?)').run(company,foreign);
  db.prepare('DELETE FROM visits WHERE unit_id IN (?,?,?)').run(unit,secondUnit,foreignUnit);
  db.prepare('DELETE FROM units WHERE company_id IN (?,?)').run(company,foreign);
  db.prepare('DELETE FROM users WHERE company_id=?').run(company);
  db.prepare('DELETE FROM companies WHERE id IN (?,?)').run(company,foreign);
}
