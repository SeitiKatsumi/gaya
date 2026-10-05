import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const raw = process.env.DATABASE_URL?.replace(/^file:/, "") || path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "gaya.sqlite");
const dbPath = path.resolve(/*turbopackIgnore: true*/ raw);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const globalDb = globalThis as unknown as { gayaDb?: DatabaseSync };
export const db = globalDb.gayaDb ?? new DatabaseSync(dbPath);
if (process.env.NODE_ENV !== "production") globalDb.gayaDb = db;
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");

export function migrate() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, trade_name TEXT NOT NULL, document TEXT, colors TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS units (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), name TEXT NOT NULL, code TEXT NOT NULL, address TEXT, city TEXT, state TEXT, active INTEGER DEFAULT 1, UNIQUE(company_id, code));
  CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES units(id), visit_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', series_id TEXT, status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','CANCELLED')), created_by TEXT REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, CHECK(start_time<end_time));
  CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date,status,unit_id);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id), name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN','SUPERVISOR','INSPECTOR')), active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), unit_id TEXT REFERENCES units(id), code TEXT NOT NULL, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('PLANNING','ACTIVE','PAUSED','COMPLETED','ARCHIVED')), manager_id TEXT REFERENCES users(id), start_date TEXT, end_date TEXT, created_by TEXT REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(company_id, code));
  CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id), name TEXT NOT NULL, category TEXT, description TEXT, version INTEGER DEFAULT 1, status TEXT DEFAULT 'PUBLISHED', owner_id TEXT REFERENCES users(id), is_global INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS template_items (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES templates(id), area TEXT NOT NULL, section TEXT, code TEXT NOT NULL, title TEXT NOT NULL, guidance TEXT, response_type TEXT DEFAULT 'YES_NO_NA', expected_answer TEXT, criticality TEXT DEFAULT 'MEDIUM', weight REAL DEFAULT 1, photo_required INTEGER DEFAULT 0, audio_required INTEGER DEFAULT 0, condition_json TEXT, sort_order INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS inspections (id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id), unit_id TEXT NOT NULL REFERENCES units(id), project_id TEXT REFERENCES projects(id), template_id TEXT NOT NULL REFERENCES templates(id), control_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, objective TEXT, scope TEXT, status TEXT NOT NULL DEFAULT 'SCHEDULED', priority TEXT DEFAULT 'NORMAL', supervisor_id TEXT REFERENCES users(id), inspector_id TEXT REFERENCES users(id), planned_start TEXT, planned_end TEXT, progress INTEGER DEFAULT 0, template_snapshot TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS inspection_sessions (id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES inspections(id), inspector_id TEXT NOT NULL REFERENCES users(id), started_at TEXT NOT NULL, ended_at TEXT, notes TEXT, status TEXT DEFAULT 'OPEN');
  CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES inspections(id), item_id TEXT NOT NULL REFERENCES template_items(id), user_id TEXT NOT NULL REFERENCES users(id), session_id TEXT REFERENCES inspection_sessions(id), answer TEXT, compliance TEXT DEFAULT 'PENDING', comment TEXT, recommendation TEXT, revision INTEGER DEFAULT 1, is_current INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS evidences (id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES inspections(id), item_id TEXT REFERENCES template_items(id), response_id TEXT REFERENCES responses(id), session_id TEXT REFERENCES inspection_sessions(id), user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, original_name TEXT NOT NULL, path TEXT NOT NULL, mime_type TEXT, size INTEGER, hash TEXT NOT NULL, caption TEXT, status TEXT DEFAULT 'READY', transcript_original TEXT, transcript_reviewed TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS nonconformities (id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES inspections(id), item_id TEXT REFERENCES template_items(id), title TEXT NOT NULL, severity TEXT NOT NULL, status TEXT DEFAULT 'OPEN', due_date TEXT, responsible TEXT, action_plan TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, inspection_id TEXT NOT NULL REFERENCES inspections(id), version INTEGER DEFAULT 1, path TEXT NOT NULL, status TEXT DEFAULT 'PUBLISHED', generated_by TEXT REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT, read_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id), company_id TEXT, inspection_id TEXT, action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, old_value TEXT, new_value TEXT, origin TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS report_section_reviews (inspection_id TEXT NOT NULL REFERENCES inspections(id), section TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')), note TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, PRIMARY KEY(inspection_id,section));
  CREATE TABLE IF NOT EXISTS monthly_reviews (scope_key TEXT NOT NULL, month TEXT NOT NULL, company_id TEXT REFERENCES companies(id), text TEXT NOT NULL, source_hash TEXT NOT NULL, reviewed_by TEXT NOT NULL REFERENCES users(id), reviewed_at TEXT NOT NULL, PRIMARY KEY(scope_key,month));
  CREATE INDEX IF NOT EXISTS idx_inspections_company ON inspections(company_id, status); CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id, status); CREATE INDEX IF NOT EXISTS idx_responses_inspection ON responses(inspection_id, item_id, is_current); CREATE INDEX IF NOT EXISTS idx_audit_inspection ON audit_logs(inspection_id, created_at); CREATE INDEX IF NOT EXISTS idx_evidences_inspection ON evidences(inspection_id, item_id);
  `);
  const companyColumns=db.prepare('PRAGMA table_info(companies)').all() as {name:string}[];
  if(!companyColumns.some(column=>column.name==='report_recipients'))db.exec("ALTER TABLE companies ADD COLUMN report_recipients TEXT NOT NULL DEFAULT ''");
  const unitColumns=db.prepare('PRAGMA table_info(units)').all() as {name:string}[];
  if(!unitColumns.some(column=>column.name==='responsible_id'))db.exec('ALTER TABLE units ADD COLUMN responsible_id TEXT REFERENCES users(id)');
  for(const field of ['maps_url','contact_name','contact_email','contact_phones','form_url']){
    if(!unitColumns.some(column=>column.name===field))db.exec(`ALTER TABLE units ADD COLUMN ${field} TEXT`);
  }
  const inspectionColumns = db.prepare("PRAGMA table_info(inspections)").all() as {name:string}[];
  for(const field of ['received_at','send_due_date'])if(!inspectionColumns.some(column=>column.name===field))db.exec(`ALTER TABLE inspections ADD COLUMN ${field} TEXT`);
  const responseColumns=db.prepare('PRAGMA table_info(responses)').all() as {name:string}[];
  if(!responseColumns.some(column=>column.name==='details_json'))db.exec('ALTER TABLE responses ADD COLUMN details_json TEXT');
  const reportColumns=db.prepare('PRAGMA table_info(reports)').all() as {name:string}[];
  for(const field of ['sent_at','recipient','delivery_method'])if(!reportColumns.some(column=>column.name===field))db.exec(`ALTER TABLE reports ADD COLUMN ${field} TEXT`);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_sent ON reports(inspection_id) WHERE status='SENT'");
  if (!inspectionColumns.some((column) => column.name === 'project_id')) {
    db.exec("ALTER TABLE inspections ADD COLUMN project_id TEXT REFERENCES projects(id)");
  }
  const templateItemColumns = db.prepare("PRAGMA table_info(template_items)").all() as {name:string}[];
  for(const field of ['document_periodicity','document_copies'])if(!templateItemColumns.some(column=>column.name===field))db.exec(`ALTER TABLE template_items ADD COLUMN ${field} TEXT`);
  if (!templateItemColumns.some((column) => column.name === 'active')) {
    db.exec("ALTER TABLE template_items ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  }
  const legacyInspections=db.prepare("SELECT id,template_id,template_snapshot FROM inspections").all() as {id:string;template_id:string;template_snapshot:string|null}[];
  const freezeSnapshot=db.prepare('UPDATE inspections SET template_snapshot=? WHERE id=?');
  const snapshotItems=db.prepare('SELECT * FROM template_items WHERE template_id=? ORDER BY sort_order');
  for(const inspection of legacyInspections){
    let hasItems=false;
    try{const parsed=JSON.parse(inspection.template_snapshot||'{}') as {items?:unknown};hasItems=Array.isArray(parsed.items)&&parsed.items.length>0}catch{}
    if(!hasItems)freezeSnapshot.run(JSON.stringify({templateId:inspection.template_id,items:snapshotItems.all(inspection.template_id)}),inspection.id);
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id, status); PRAGMA optimize;");
  const count = db.prepare("SELECT count(*) as n FROM users").get() as {n:number};
  if (!count.n) seed();
  db.prepare("INSERT OR IGNORE INTO projects(id,company_id,unit_id,code,name,description,status,manager_id,created_by) SELECT 'prj1','c1','u1','PRJ-SP11','Operação SP11','Programa recorrente de inspeções do centro de distribuição','ACTIVE','usr-super','usr-super' WHERE EXISTS(SELECT 1 FROM companies WHERE id='c1')").run();
  db.prepare("UPDATE projects SET name='Operação SP11' WHERE id='prj1' AND name='OperaÃ§Ã£o SP11'").run();
  db.prepare("UPDATE projects SET description='Programa recorrente de inspeções do centro de distribuição' WHERE id='prj1' AND description='Programa recorrente de inspeÃ§Ãµes do centro de distribuiÃ§Ã£o'").run();
  db.prepare("UPDATE inspections SET project_id='prj1' WHERE company_id='c1' AND project_id IS NULL").run();
}

export function seed() {
  db.exec('BEGIN IMMEDIATE'); try {
    db.prepare("INSERT OR IGNORE INTO companies(id,legal_name,trade_name,document) VALUES('c1','Gaya Operações Técnicas Ltda','Gaya Demo','12.345.678/0001-90')").run();
    db.prepare("INSERT OR IGNORE INTO units(id,company_id,name,code,address,city,state) VALUES('u1','c1','Centro de Distribuição São Paulo','SP11','Rod. Anhanguera, km 18','São Paulo','SP'),('u2','c1','Unidade Campinas','CP02','Av. das Flores, 350','Campinas','SP')").run();
    const hash=bcrypt.hashSync("Gaya@2026",10);
    const add=db.prepare("INSERT OR IGNORE INTO users(id,company_id,name,email,password_hash,role) VALUES(?,?,?,?,?,?)");
    add.run('usr-admin',null,'Marina Costa','admin@gaya.app',hash,'SUPER_ADMIN'); add.run('usr-super','c1','Rafael Mendes','supervisor@gaya.app',hash,'SUPERVISOR'); add.run('usr-inspector','c1','Camila Nunes','inspetor@gaya.app',hash,'INSPECTOR');
    db.prepare("INSERT OR IGNORE INTO projects(id,company_id,unit_id,code,name,description,status,manager_id,created_by) VALUES('prj1','c1','u1','PRJ-SP11','Operação SP11','Programa recorrente de inspeções do centro de distribuição','ACTIVE','usr-super','usr-super')").run();
    db.prepare("INSERT OR IGNORE INTO templates(id,company_id,name,category,description,version,status,owner_id) VALUES('tpl1','c1','Visita Técnica Operacional','Operações','Checklist técnico para centros de distribuição',3,'PUBLISHED','usr-super')").run();
    const item=db.prepare("INSERT OR IGNORE INTO template_items(id,template_id,area,section,code,title,guidance,expected_answer,criticality,photo_required,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    item.run('i1','tpl1','Recebimento','Doca','REC-01','A área de recebimento está limpa e organizada?','Verifique piso, docas e áreas de circulação.','Sim','MEDIUM',1,1); item.run('i2','tpl1','Recebimento','Controle','REC-02','Foram observados indícios de pragas?','Inspecione cantos, ralos e embalagens.','Não','CRITICAL',1,2); item.run('i3','tpl1','Armazenagem','Estrutura','ARM-01','Os produtos estão afastados das paredes?','Validar distância mínima definida no procedimento.','Sim','HIGH',1,3); item.run('i4','tpl1','Armazenagem','Validade','ARM-02','O controle FEFO está sendo aplicado?','Compare datas e posicionamento do estoque.','Sim','HIGH',0,4); item.run('i5','tpl1','Expedição','Segurança','EXP-01','As rotas de fuga estão desobstruídas?','Verifique sinalização e acesso às saídas.','Sim','CRITICAL',1,5);
    const ins=db.prepare("INSERT OR IGNORE INTO inspections(id,company_id,unit_id,template_id,control_code,title,objective,scope,status,priority,supervisor_id,inspector_id,planned_start,planned_end,progress,template_snapshot) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    ins.run('ins1','c1','u1','tpl1','RQ-SP11.08/2026','Visita técnica mensal — SP11','Avaliar conformidade operacional','Recebimento, armazenagem e expedição','IN_PROGRESS','HIGH','usr-super','usr-inspector','2026-08-03','2026-08-04',62,'{"template":"tpl1","version":3}'); ins.run('ins2','c1','u2','tpl1','RQ-CP02.08/2026','Inspeção preventiva — Campinas','Verificação preventiva','Operação completa','SCHEDULED','NORMAL','usr-super','usr-inspector','2026-08-08','2026-08-08',0,'{"template":"tpl1","version":3}');
    db.prepare("INSERT OR IGNORE INTO nonconformities(id,inspection_id,item_id,title,severity,status,due_date,responsible,action_plan) VALUES('nc1','ins1','i3','Produto armazenado junto à parede','HIGH','OPEN','2026-08-10','Operações SP11','Reposicionar pallets e demarcar limite')").run();
  db.exec('COMMIT'); } catch(error) { db.exec('ROLLBACK'); throw error; }
}

migrate();
export function audit(userId:string|null, companyId:string|null, action:string, entityType:string, entityId:string, inspectionId?:string, oldValue?:unknown, newValue?:unknown){db.prepare("INSERT INTO audit_logs(user_id,company_id,inspection_id,action,entity_type,entity_id,old_value,new_value,origin) VALUES(?,?,?,?,?,?,?,?,?)").run(userId,companyId,inspectionId??null,action,entityType,entityId,oldValue?JSON.stringify(oldValue):null,newValue?JSON.stringify(newValue):null,'web');}
