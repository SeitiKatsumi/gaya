import assert from 'node:assert/strict';
import {db} from '../src/lib/db.ts';
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

console.log('15 verificações de domínio e banco aprovadas.');
