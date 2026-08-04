import assert from 'node:assert/strict';
import {db} from '../src/lib/db.ts';
import {appUrl,publicOrigin} from '../src/lib/http.ts';
import {createInspectionReport,safePdfText} from '../src/lib/report.ts';
import {projectStatusLabel,roleLabel,statusLabel} from '../src/lib/utils.ts';

assert.equal(statusLabel('IN_PROGRESS'),'Em andamento');
assert.equal(statusLabel('CUSTOM'),'CUSTOM');
assert.equal(projectStatusLabel('ACTIVE'),'Ativo');
assert.equal(roleLabel('SUPERVISOR'),'Supervisor');

const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all() as {name:string}[];
for(const required of ['users','projects','templates','inspections','responses','evidences','nonconformities','audit_logs'])assert.ok(tables.some(table=>table.name===required),`Tabela ausente: ${required}`);
const inspectionColumns=db.prepare('PRAGMA table_info(inspections)').all() as {name:string}[];
assert.ok(inspectionColumns.some(column=>column.name==='project_id'),'Migração project_id não aplicada');
assert.ok((db.prepare('SELECT count(*) n FROM projects').get() as {n:number}).n>0,'Projeto inicial ausente');
assert.ok((db.prepare("SELECT count(*) n FROM users WHERE role='SUPERVISOR'").get() as {n:number}).n>0,'Supervisor inicial ausente');
assert.ok((db.prepare('SELECT count(*) n FROM companies WHERE active=1').get() as {n:number}).n>0,'Empresa ativa inicial ausente');
assert.ok((db.prepare('SELECT count(*) n FROM units WHERE active=1').get() as {n:number}).n>0,'Unidade ativa inicial ausente');

const previousAppUrl=process.env.APP_URL;
delete process.env.APP_URL;
const proxiedRequest=new Request('http://0.0.0.0:80/api/projects/prj1',{headers:{'x-forwarded-host':'gaya.dna11.com.br','x-forwarded-proto':'https'}});
assert.equal(publicOrigin(proxiedRequest),'https://gaya.dna11.com.br');
assert.equal(appUrl(proxiedRequest,'/projetos/prj1?ok=1').href,'https://gaya.dna11.com.br/projetos/prj1?ok=1');
process.env.APP_URL='https://gaya.dna11.com.br';
const hostileForwarded=new Request('http://0.0.0.0:80/api/test',{headers:{'x-forwarded-host':'invalid.example','x-forwarded-proto':'http'}});
assert.equal(publicOrigin(hostileForwarded),'https://gaya.dna11.com.br');
if(previousAppUrl===undefined)delete process.env.APP_URL;else process.env.APP_URL=previousAppUrl;

assert.equal(safePdfText('Operação — inspeção'),'Operação - inspeção');
const pdf=await createInspectionReport({control_code:'RQ-TESTE.08/2026',title:'Inspeção de validação',company_name:'Gaya Demo',unit_name:'Unidade teste',address:'Rua de teste, 100',template_name:'Modelo operacional',planned_start:'2026-08-04',planned_end:'2026-08-05',objective:'Validar geração do relatório',scope:'Operação completa',status:'IN_PROGRESS',progress:50,inspector_name:'Pessoa Inspetora',supervisor_name:'Pessoa Supervisora'},[{code:'TST-01',area:'Operações',title:'O relatório é gerado corretamente?',answer:'Sim',compliance:'COMPLIANT',comment:'Teste com acentuação e paginação.',evidence_count:2}],0);
assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
assert.ok(pdf.length>3000,'PDF de validação incompleto');
assert.ok(pdf.subarray(-20).toString().includes('%%EOF'),'PDF sem marcador final');

console.log('26 verificações de domínio, banco, empresas, unidades, redirects e PDF aprovadas.');
