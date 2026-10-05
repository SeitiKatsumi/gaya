export const uid=(prefix='id')=>`${prefix}_${crypto.randomUUID()}`;
export const statusLabel=(s:string)=>({DRAFT:'Rascunho',SCHEDULED:'Programada',AWAITING_START:'Aguardando início',IN_PROGRESS:'Em andamento',PAUSED:'Pausada',AWAITING_INFO:'Aguardando informações',IN_REVIEW:'Em revisão',CHANGES_REQUESTED:'Ajustes solicitados',REVIEWED:'Revisada',APPROVED:'Aprovada',REPORT_PROCESSING:'Relatório em processamento',REPORT_PUBLISHED:'Relatório publicado',ARCHIVED:'Arquivada',CANCELLED:'Cancelada'}[s]||s);
export const projectStatusLabel=(s:string)=>({PLANNING:'Planejamento',ACTIVE:'Ativo',PAUSED:'Pausado',COMPLETED:'Concluído',ARCHIVED:'Arquivado'}[s]||s);
export const roleLabel=(s:string)=>({SUPER_ADMIN:'Super Admin',SUPERVISOR:'Coordenador',INSPECTOR:'Responsável técnico'}[s]||s);
