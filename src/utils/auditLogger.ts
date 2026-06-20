
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  processoNumero?: string;
  details?: string;
}

export function logAction(username: string, action: string, processoNumero?: string, details?: string) {
  let logs: AuditLogEntry[] = [];
  try {
    const raw = localStorage.getItem('gestao_processos_audit_logs');
    if (raw) {
      logs = JSON.parse(raw);
    }
  } catch (e) {
    logs = [];
  }
  const newLog: AuditLogEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    username,
    action,
    processoNumero,
    details
  };
  localStorage.setItem('gestao_processos_audit_logs', JSON.stringify([...logs, newLog]));
}

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem('gestao_processos_audit_logs');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // return empty array if corrupt JSON
  }
  return [];
}
