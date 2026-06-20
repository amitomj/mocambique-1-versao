/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BackupRecord {
  id: string;
  filename: string;
  timestamp: string;
  localDate: string;
  size: string;
  content: string;
  wasTriggeredAuto: boolean;
}

export function getBackupsList(): BackupRecord[] {
  const raw = localStorage.getItem('gestao_processos_backups');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function executeBackup(wasTriggeredAuto: boolean): BackupRecord {
  const backups = getBackupsList();
  const agora = new Date();
  
  // Format local date parts
  const year = agora.getFullYear();
  const month = String(agora.getMonth() + 1).padStart(2, '0');
  const day = String(agora.getDate()).padStart(2, '0');
  const hour = String(agora.getHours()).padStart(2, '0');
  const min = String(agora.getMinutes()).padStart(2, '0');
  const sec = String(agora.getSeconds()).padStart(2, '0');
  
  const typeStr = wasTriggeredAuto ? 'Auto' : 'Manual';
  const filename = `Backup_${typeStr}_${year}-${month}-${day}_${hour}h${min}m${sec}s.json`;
  
  const getLocalDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const todayLoc = getLocalDateString(agora);
  
  // Gather current LocalStorage data
  const processes = localStorage.getItem('gestao_processos_processos') || '[]';
  const users = localStorage.getItem('gestao_processos_users') || '[]';
  const judges = localStorage.getItem('gestao_processos_juizes') || '[]';
  const lawyers = localStorage.getItem('gestao_processos_advogados') || '[]';
  const prosecutors = localStorage.getItem('gestao_processos_procuradores') || '[]';
  
  const payloadData = {
    app: "GestaoProcessos",
    versao: "2.1",
    timestamp: agora.toISOString(),
    localDate: todayLoc,
    wasTriggeredAuto,
    dados: {
      processos: JSON.parse(processes),
      utilizadores: JSON.parse(users),
      juizes: JSON.parse(judges),
      advogados: JSON.parse(lawyers),
      procuradores: JSON.parse(prosecutors)
    }
  };
  
  const payloadStr = JSON.stringify(payloadData, null, 2);
  const bytes = payloadStr.length;
  let sizeStr = '';
  if (bytes < 1024) {
    sizeStr = `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    sizeStr = `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    sizeStr = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  
  const newBackup: BackupRecord = {
    id: `backup-${agora.getTime()}`,
    filename,
    timestamp: agora.toISOString(),
    localDate: todayLoc,
    size: sizeStr,
    content: payloadStr,
    wasTriggeredAuto
  };
  
  // Prepend to list
  backups.unshift(newBackup);
  
  // Keep only the last 5 successful backups (rotation)
  let finalBackups = backups;
  if (finalBackups.length > 5) {
    finalBackups = finalBackups.slice(0, 5);
  }
  
  try {
    localStorage.setItem('gestao_processos_backups', JSON.stringify(finalBackups));
  } catch (error) {
    console.warn("Falha ao guardar backups devido ao limite de quota local. Tentando otimizar espaço...", error);
    try {
      // 1. Try keeping full database content ONLY for the most recent backup, clearing detailed content for the older ones
      const optimizedBackups = finalBackups.map((b, idx) => {
        if (idx === 0) return b; // Always keep the latest full content
        return { ...b, content: "" }; // Discard content for older backups to save space
      });
      localStorage.setItem('gestao_processos_backups', JSON.stringify(optimizedBackups));
    } catch (err) {
      console.error("Ainda excede a quota local. Tentando guardar apenas o backup mais recente...", err);
      try {
        // 2. Keep only the most recent backup
        const singleBackup = [newBackup];
        localStorage.setItem('gestao_processos_backups', JSON.stringify(singleBackup));
      } catch (errFinal) {
        console.error("Quota do LocalStorage completamente cheia. Tentando apagar backups antigos...", errFinal);
        try {
          // 3. Last resort: store only metadata without content
          const emptyContentBackup = [{ ...newBackup, content: "" }];
          localStorage.setItem('gestao_processos_backups', JSON.stringify(emptyContentBackup));
        } catch (e) {
          console.error("Incapaz de guardar qualquer metadado de backup no LocalStorage.", e);
        }
      }
    }
  }
  return newBackup;
}

export function checkAndRunAutoBackup(): { triggered: boolean; backup?: BackupRecord } {
  const agora = new Date();
  const hora = agora.getHours();
  
  // Automatic backup is performed daily between 9:00 AM (inclusive) and 12:00 PM (exclusive/inclusive)
  // Let's check: 9, 10, 11 (meaning from 09:00:00 to 11:59:59)
  if (hora >= 9 && hora < 12) {
    const getLocalDateString = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    const todayLoc = getLocalDateString(agora);
    const backups = getBackupsList();
    
    // Check if an automatic backup was already completed on this local day
    const hasAutoToday = backups.some(b => b.localDate === todayLoc && b.wasTriggeredAuto);
    if (!hasAutoToday) {
      const b = executeBackup(true);
      return { triggered: true, backup: b };
    }
  }
  return { triggered: false };
}

export function restoreDatabase(contentStr: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(contentStr);
    if (parsed.app !== "GestaoProcessos" || !parsed.dados) {
      return { success: false, message: "O ficheiro selecionado não é uma cópia de segurança válida para a Gestão de Processos." };
    }
    const { processos, utilizadores, juizes, advogados, procuradores } = parsed.dados;
    
    if (processos) localStorage.setItem('gestao_processos_processos', JSON.stringify(processos));
    if (utilizadores) localStorage.setItem('gestao_processos_users', JSON.stringify(utilizadores));
    if (juizes) localStorage.setItem('gestao_processos_juizes', JSON.stringify(juizes));
    if (advogados) localStorage.setItem('gestao_processos_advogados', JSON.stringify(advogados));
    if (procuradores) localStorage.setItem('gestao_processos_procuradores', JSON.stringify(procuradores));
    
    return { success: true, message: "Cópia de segurança restaurada com êxito! Todos os dados locais foram atualizados." };
  } catch (e) {
    return { success: false, message: "Falha ao analisar o ficheiro. Confirme se o formato do ficheiro .json está correto." };
  }
}

export function deleteBackup(id: string): BackupRecord[] {
  const backups = getBackupsList();
  const updated = backups.filter(b => b.id !== id);
  try {
    localStorage.setItem('gestao_processos_backups', JSON.stringify(updated));
  } catch (e) {
    console.error("Erro ao remover backup da localStorage:", e);
  }
  return updated;
}

