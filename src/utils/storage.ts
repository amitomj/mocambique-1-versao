/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Processo, Documento, Tribunal, FormModelo, ProcessNotificacao } from '../types';

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const STORAGE_KEYS = {
  USERS: 'gestao_processos_users',
  PROCESSOS: 'gestao_processos_processos',
  LOGGED_IN_USER: 'gestao_processos_active_user',
  DISK_C: 'gestao_processos_disk_c',
  TRIBUNAIS: 'gestao_processos_tribunais',
  FORM_MODELOS: 'gestao_processos_form_modelos',
  NOTIFICACOES: 'gestao_processos_notificacoes'
};

const MINIMAL_PDF_BASE64 = "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCjIgMCBvYmoKICA8PCAvVHlwZSAvUGFnZXMKICAgICAvS2lkcyBbIDMgMCBSIF0KICAgICAvQ291bnQgMQogID4+CmVuZG9iagozIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2UKICAgICAvUGFyZW50IDIgMCBSCiAgICAgL01lZGlhQm94IFsgMCAwIDU5NSA4NDIgXQogICAgIC9SZXNvdXJjZXMgPDw+PgogICAgIC9Db250ZW50cyA0IDAgUgogID4+CmVuZG9iago0IDAgb2JqCiAgPDwgL0xlbmd0aCAyOCA+PgpzdHJlYW0KICBCVCAvRjEgMTIgVGYgNzAgNzAwIFRkIChIZWxsbykgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3NCAwMDAwMCBuIAowMDAwMDAwMTM3IDAwMDAwIGYgCjAwMDAwMDAyMzEgMDAwMDAgbiAKdHJhaWxlcgogIDw8IC9TaXplIDUKICAgICAvUm9vdCAxIDAgUgogID4+CnN0YXJ0eHJlZgogMzA4CiUlRU9GCg==";

export function saveProcessosToStorage(processos: Processo[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROCESSOS, JSON.stringify(processos));
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.message?.toLowerCase().includes('quota')) {
      console.warn("Storage quota exceeded. Attempting auto-optimization of attached documents...");
      
      const docsToOptimize: Array<{ procIndex: number; docIndex: number; size: number }> = [];
      
      processos.forEach((proc, procIdx) => {
        if (proc.documentos) {
          proc.documentos.forEach((doc, docIdx) => {
            if (doc.conteudoUrl && doc.conteudoUrl.startsWith('data:') && doc.conteudoUrl !== MINIMAL_PDF_BASE64) {
              docsToOptimize.push({
                procIndex: procIdx,
                docIndex: docIdx,
                size: doc.conteudoUrl.length
              });
            }
          });
        }
      });
      
      docsToOptimize.sort((a, b) => b.size - a.size);
      
      let optimizedOne = false;
      for (const item of docsToOptimize) {
        if (item.size > 10 * 1024) {
          const doc = processos[item.procIndex].documentos[item.docIndex];
          doc.conteudoUrl = MINIMAL_PDF_BASE64;
          doc.conteudoTexto = `[FOTO/DOCUMENTO OTIMIZADO PARA POUPANÇA DE ESPAÇO LOCAL]\n\nEste documento original excedeu os limites de capacidade do navegador.\n\nNome do documento: ${doc.nome}\n\nTexto Original:\n${doc.conteudoTexto || '(Sem texto extractível)'}`;
          optimizedOne = true;
          break;
        }
      }
      
      if (optimizedOne) {
        saveProcessosToStorage(processos);
      } else {
        alert('Erro crítico: O espaço de armazenamento do navegador está completamente cheio. Por favor de-selecione/remova alguns anexos antigos e tente novamente.');
        throw e;
      }
    } else {
      throw e;
    }
  }
}

// Simple base64 PDF representation or text patterns for pre-loaded documents
const DEFAULT_TEXT_DOC = `TRIBUNAL DA COMARCA
PROCESSO DE EXECUÇÃO E SUPORTE DE FACTOS

Pelo presente documento, certifica-se para todos os efeitos legais que o processo em epígrafe se encontra em andamento processual regular. Todas as partes foram devidamente notificadas conforme os preceitos da legislação processual civil em vigor.

Data de Emissão: 2026-05-29
Secção Cível do Tribunal Judicial
`;

// Helper to seed data if empty
export function initLocalStorageSeed() {
  // Clear trace of the old 10 processes seed so we can zero out everything perfectly
  const cleanFlag = 'gestao_processos_cleared_for_antonio_v3';
  if (localStorage.getItem(cleanFlag) !== 'true') {
    localStorage.clear();
    
    // Set Antonio as the only registered administrator
    const defaultUser: User = {
      username: "antonio.j.gomes@csm.org.pt",
      role: 'administrador',
      password: "123", // Clean, simple password for offline test stage
      createdAt: new Date().toISOString(),
      tribunalId: 't-csm'
    };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([defaultUser]));
    localStorage.setItem(STORAGE_KEYS.LOGGED_IN_USER, JSON.stringify(defaultUser));
    
    // Set other tables to clean state
    localStorage.setItem(STORAGE_KEYS.PROCESSOS, JSON.stringify([]));
    localStorage.setItem('gestao_processos_intervenientes_fichas', JSON.stringify([]));
    localStorage.setItem('gestao_processos_advogados_detalhados_fichas', JSON.stringify([]));
    localStorage.setItem('gestao_processos_juizes', JSON.stringify([]));
    localStorage.setItem('gestao_processos_advogados', JSON.stringify([]));
    localStorage.setItem('gestao_processos_procuradores', JSON.stringify([]));
    localStorage.setItem('gestao_processos_funcionarios', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.NOTIFICACOES, JSON.stringify([]));
    localStorage.setItem('gestao_processos_backups', JSON.stringify([]));
    
    // Seed Tribunals for Mozambique
    const defaultTribunais: Tribunal[] = [
      {
        id: 't-csm',
        localidade: 'Maputo',
        tribunal: 'Conselho Superior da Magistratura Judicial de Moçambique',
        imagemCabecalho: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&h=120&q=80'
      },
      {
        id: 't-maputo',
        localidade: 'Maputo',
        tribunal: 'Tribunal Judicial da Cidade de Maputo',
        imagemCabecalho: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&h=120&q=80'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.TRIBUNAIS, JSON.stringify(defaultTribunais));
    localStorage.setItem(STORAGE_KEYS.FORM_MODELOS, JSON.stringify([]));
    
    localStorage.setItem(cleanFlag, 'true');
  }

  // Fallback check to ensure user array is populated of antonio.j.gomes@csm.org.pt
  const existingUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!existingUsers) {
    const defaultUser: User = {
      username: "antonio.j.gomes@csm.org.pt",
      role: 'administrador',
      password: "123",
      createdAt: new Date().toISOString(),
      tribunalId: 't-csm'
    };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([defaultUser]));
    localStorage.setItem(STORAGE_KEYS.LOGGED_IN_USER, JSON.stringify(defaultUser));
  }
}

// User Persistence Operations
export function getUsers(): User[] {
  const raw = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveUser(user: User): boolean {
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === user.username.toLowerCase())) {
    return false; // User already exists!
  }
  users.push(user);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  return true;
}

export function deleteUser(username: string): User[] {
  const users = getUsers();
  const updated = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
  return updated;
}

export function toggleUserActive(username: string): User[] {
  const users = getUsers();
  const updated = users.map(u => {
    if (u.username.toLowerCase() === username.toLowerCase()) {
      return { ...u, active: u.active === false ? true : false };
    }
    return u;
  });
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
  return updated;
}

export function createFirstAdmin(username: string, passwordString: string, tribunalId?: string): User {
  const firstAdmin: User = {
    username,
    role: 'administrador',
    password: passwordString,
    createdAt: new Date().toISOString(),
    tribunalId
  };
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([firstAdmin]));
  // Sign in automatically
  setActiveUser(firstAdmin);
  return firstAdmin;
}

export function getActiveUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.LOGGED_IN_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function setActiveUser(user: User | null) {
  if (user === null) {
    localStorage.removeItem(STORAGE_KEYS.LOGGED_IN_USER);
  } else {
    localStorage.setItem(STORAGE_KEYS.LOGGED_IN_USER, JSON.stringify(user));
  }
}

// Process Persistence Operations
export function getProcessos(): Processo[] {
  const raw = localStorage.getItem(STORAGE_KEYS.PROCESSOS);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((p: any) => {
      const pId = p.id || p.numero;
      return {
        ...p,
        id: pId,
        autores: Array.isArray(p.autores) ? p.autores : [],
        reus: Array.isArray(p.reus) ? p.reus : [],
        documentos: Array.isArray(p.documentos) ? p.documentos : [],
        historicoAtos: Array.isArray(p.historicoAtos) ? p.historicoAtos : [],
        advogadosAutor: Array.isArray(p.advogadosAutor) ? p.advogadosAutor : [],
        advogadosReu: Array.isArray(p.advogadosReu) ? p.advogadosReu : [],
        procuradores: Array.isArray(p.procuradores) ? p.procuradores : [],
        funcionarios: Array.isArray(p.funcionarios) ? p.funcionarios : [],
        deleted: typeof p.deleted === 'boolean' ? p.deleted : false
      };
    });
  } catch (e) {
    return [];
  }
}

export function getDocumentClassifications(tipo: string): string[] {
  const raw = localStorage.getItem(`gestao_processos_class_${tipo}`);
  let list: string[] = [];
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch (e) {
      list = [];
    }
  }
  if (!list || list.length === 0) {
    if (tipo === 'crime') {
      list = [
        "Acórdão",
        "Acta de audiência e julgamento",
        "Acusação formal (Ministério Público)",
        "Auto de Notícia",
        "Contestação / Defesa",
        "Defesa do Arguido",
        "Despacho",
        "Despacho de Pronúncia",
        "Infrator / Arguição",
        "Inquérito",
        "Instrução",
        "Julgamento",
        "Notificação",
        "Requerimento do Ministério Público",
        "Requerimento do Assistente",
        "Requerimento",
        "Sentença",
        "Suporte de Prova",
        "Taxa de justiça"
      ];
    } else {
      list = [
        "Acórdão (incluindo reforma em caso de nulidades)",
        "Acta de audiência e julgamento (juiz singular ou tribunal colectivo)",
        "Adjudicação de bens ao exequente",
        "Alteração do rol de testemunhas",
        "Anulação da execução (por falta ou nulidade de citação)",
        "Anulação da partilha",
        "Anulação da venda e indemnização do comprador",
        "Apresentação de contas pelo réu",
        "Articulado superveniente",
        "Ata de julgamento",
        "Ato do funcionário",
        "Audiência preliminar (ou sua dispensa)",
        "Auto de penhora",
        "Avaliação de bens (incluindo bens doados ou legados por inoficiosidade)",
        "Cancelamento dos registos",
        "Caução",
        "Cessação da execução pelo pagamento voluntário",
        "Citação (incluindo citação prévia e citação de credores)",
        "Conferência de interessados",
        "Consignação de rendimentos",
        "Contestação (incluindo com reconvenção ou de contas)",
        "Conversão da execução (or do arresto em penhora)",
        "Cumulação de inventários",
        "Decisão",
        "Depósito",
        "Designação de curador provisório",
        "Designação de solicitador de execução",
        "Despacho (incluindo liminar, saneador ou sobre forma à partilha)",
        "Destituição dos liquidatários",
        "Dispensa de depósito aos credores",
        "Edital / Editais",
        "Emenda da partilha",
        "Esclarecimento ou reforma da sentença",
        "Exame pericial",
        "Exercício do direito de preferência",
        "Extinção da execução",
        "Fixação de prazo para a prestação",
        "Habilitação",
        "Impugnação de créditos reclamados",
        "Indicação das provas",
        "Inspecção judicial",
        "Insolvência da herança",
        "Interrogatório do requerido",
        "Irregularidades da venda",
        "Julgamento da matéria de facto",
        "Junção de documentos com as alegações",
        "Levantamento da interdição ou inabilitação",
        "Levantamento da penhora",
        "Licitações",
        "Liquidação total ou parcial e partilha em espécie",
        "Mapa de partilha",
        "Nomeação do cabeça de casal",
        "Notificação",
        "Oposição (à execução, à penhora ou espontânea)",
        "Pagamento (incluindo em prestações ou de dívidas da herança)",
        "Pagamento ou depósito de tornas",
        "Passivo da herança",
        "Penhora",
        "Perícia",
        "Petição inicial",
        "Preenchimento dos quinhões",
        "Prestação de caução",
        "Prestação de contas (várias modalidades: forçada, espontânea, tutor, etc.)",
        "Primeira conferência",
        "Produção antecipada de provas",
        "Propostas em carta fechada",
        "Reclamação à relação de bens (ou contra o valor dos bens)",
        "Reclamação contra o indeferimento do recurso",
        "Reclamação de créditos",
        "Reclamações contra o mapa",
        "Rectificação de erros materiais",
        "Recurso (incluindo apelação, revista, agravo, revisão e especial)",
        "Recusa do requerimento",
        "Reforço e substituição da caução",
        "Relação de bens",
        "Relação de interessados",
        "Relatório de avaliação do custo da prestação",
        "Relatório pericial (singular ou colegial)",
        "Remição",
        "Renovação da execução extinta",
        "Representação de incapazes ou ausentes",
        "Resposta (ao articulado superveniente, à contestação, à reconvenção ou do reclamante)",
        "Requerimento executivo",
        "Requerimento inicial",
        "Réplica",
        "Selecção da matéria de facto",
        "Sentença (incluindo homologatória da partilha)",
        "Suspensão da execução",
        "Suspensão ou adiamento da conferência",
        "Tentativa de conciliação",
        "Tréplica",
        "Uniformização de jurisprudência",
        "Venda (incluindo antecipada, direta, por negociação particular, em leilão, etc.)"
      ];
    }
  }
  
  let cleaned = Array.from(new Set(list.map(s => s.trim()))).filter(Boolean);
  return cleaned.sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));
}

export function saveDocumentClassifications(tipo: string, list: string[]): string[] {
  let cleaned = Array.from(new Set(list.map(s => s.trim()))).filter(Boolean);
  localStorage.setItem(`gestao_processos_class_${tipo}`, JSON.stringify(cleaned));
  return cleaned.sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));
}

export function createProcesso(
  numero: string,
  autores: string[],
  reus: string[],
  dataAutuacao: string,
  juizTitular: string,
  advogadosAutor: string[],
  advogadosReu: string[],
  parentProcessoNumero?: string,
  procuradores?: string[],
  notificacoesDestinatarios?: string[],
  tipo?: string,
  valorAcao?: number,
  especieCivel?: string,
  tipoAccaoCivel?: string,
  funcionarios?: string[],
  alarmeDias?: number
): { success: boolean; message: string; data?: Processo } {
  const processos = getProcessos();
  const searchNum = numero.trim().toUpperCase();

  const exists = processos.some(p => p.numero.trim().toUpperCase() === searchNum);
  if (exists) {
    return { success: false, message: `Já existe um processo com o número ${numero}.` };
  }

  let autoAlarmeData = "";
  let autoAlarmeNota = "";
  let autoAlarmeAtivo = false;
  const days = alarmeDias || 60;

  if (dataAutuacao) {
    try {
      const parsedDate = new Date(dataAutuacao);
      if (!isNaN(parsedDate.getTime())) {
        parsedDate.setDate(parsedDate.getDate() + days);
        autoAlarmeData = parsedDate.toISOString().split('T')[0];
        autoAlarmeNota = `Alarme automático (${days} dias após o último ato)`;
        autoAlarmeAtivo = true;
      }
    } catch (err) {
      console.warn("Erro ao calcular data de autuação para o alarme automático", err);
    }
  }

  const novo: Processo = {
    id: generateId(),
    numero: numero.trim(),
    autores: autores.map(a => a.trim()).filter(a => a !== ''),
    reus: reus.map(r => r.trim()).filter(r => r !== ''),
    dataAutuacao,
    juizTitular: juizTitular.trim(),
    advogadosAutor: advogadosAutor.map(a => a.trim()).filter(a => a !== ''),
    advogadosReu: advogadosReu.map(a => a.trim()).filter(a => a !== ''),
    procuradores: procuradores ? procuradores.map(p => p.trim()).filter(p => p !== '') : [],
    funcionarios: funcionarios ? funcionarios.map(f => f.trim()).filter(f => f !== '') : [],
    notificacoesDestinatarios: notificacoesDestinatarios ? notificacoesDestinatarios.map(d => d.trim()).filter(d => d !== '') : [],
    documentos: [],
    createdAt: new Date().toISOString(),
    parentProcessoNumero: parentProcessoNumero ? parentProcessoNumero.trim() : undefined,
    tipo: tipo || 'civel',
    especieCivel: tipo === 'civel' ? especieCivel : undefined,
    tipoAccaoCivel: tipo === 'civel' ? tipoAccaoCivel : undefined,
    valorAcao: tipo === 'civel' ? valorAcao : undefined,
    faseAtual: 'Instrução Inicial',
    historicoAtos: [],
    alarmeAtivo: autoAlarmeAtivo,
    alarmeTipo: 'automatico',
    alarmeData: autoAlarmeData || undefined,
    alarmeNota: autoAlarmeNota || undefined,
    alarmeDias: days
  };

  processos.push(novo);
  saveProcessosToStorage(processos);
  return { success: true, message: 'Processo registado com sucesso.', data: novo };
}

function internalAddDays(dateStr: string, days: number): string {
  try {
    const cleaned = dateStr.trim().split('T')[0];
    const [yearStr, monthStr, dayStr] = cleaned.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    }
    const date = new Date(year, month - 1, day + days);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch (e) {
    return dateStr;
  }
}

function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function adjustProcessoAlarmsOnUpdate(updated: Processo, oldP?: Processo): Processo {
  const p = { ...updated };

  const oldActCount = oldP?.historicoAtos?.length || 0;
  const newActCount = p.historicoAtos?.length || 0;
  const actWasAdded = newActCount > oldActCount;
  const days = p.alarmeDias || 60;

  // Rule: if an alarm was marked as deleted/silenced or deactivated (meaning it was eliminated):
  // "atenção, se um processo tinha um alarme e ele foi eliminado, o sistema deve criar imediatamente outro alarme automatico"
  const wasDeleted = p.alarmeSilenciado === true || (oldP?.alarmeAtivo === true && p.alarmeAtivo === false);

  if (wasDeleted) {
    p.alarmeAtivo = true;
    p.alarmeTipo = 'automatico';
    p.alarmeSilenciado = undefined;
    
    // Calculate custom days after the latest act or autuação
    let baseDate = p.dataAutuacao || p.createdAt?.split('T')[0] || getLocalTodayString();
    if (p.historicoAtos && p.historicoAtos.length > 0) {
      let latestAct = p.historicoAtos[0];
      for (const act of p.historicoAtos) {
        if (act.data > latestAct.data) {
          latestAct = act;
        }
      }
      baseDate = latestAct.data;
    }
    
    p.alarmeData = internalAddDays(baseDate, days);
    p.alarmeNota = `Alarme automático (${days} dias após o último ato)`;
  } else if (actWasAdded) {
    if (p.alarmeTipo !== 'manual') {
      // It is automatic!
      // "3. no caso de alarme automatico, ele é eliminado sempre que for criado um ato. e é criado novo alarme para daí a 60 dias"
      p.alarmeAtivo = true;
      p.alarmeTipo = 'automatico';
      p.alarmeSilenciado = undefined; // reset silence state on new act
      
      // Calculate custom days after the latest act
      let baseDate = p.dataAutuacao || p.createdAt?.split('T')[0] || getLocalTodayString();
      if (p.historicoAtos && p.historicoAtos.length > 0) {
        let latestAct = p.historicoAtos[0];
        for (const act of p.historicoAtos) {
          if (act.data > latestAct.data) {
            latestAct = act;
          }
        }
        baseDate = latestAct.data;
      }
      
      p.alarmeData = internalAddDays(baseDate, days);
      p.alarmeNota = `Alarme automático (${days} dias após o último ato)`;
    }
  }

  return p;
}

export function updateProcesso(processo: Processo): Processo {
  const processos = getProcessos();
  const index = processos.findIndex(p => p.numero === processo.numero);
  if (index !== -1) {
    const oldP = processos[index];
    const adjusted = adjustProcessoAlarmsOnUpdate(processo, oldP);
    processos[index] = adjusted;
    saveProcessosToStorage(processos);
    return adjusted;
  }
  return processo;
}

// File and Dir simulation functions
export interface DiskFolder {
  name: string;
  isFolder: boolean;
  path: string;
  files?: DiskFolder[];
  size?: string;
  meta?: any;
}

export function getSimulatedDiskPathStructure(): DiskFolder[] {
  // Return the visual "C:\" folders matching standard directory creation.
  const processos = getProcessos();
  
  const processFolders: DiskFolder[] = processos.map(p => {
    const documentFiles: DiskFolder[] = p.documentos.map(d => ({
      name: d.nome,
      isFolder: false,
      path: `C:\\GestaoProcessos\\${p.numero}\\${d.nome}`,
      size: d.tamanho,
      meta: d
    }));

    return {
      name: p.numero,
      isFolder: true,
      path: `C:\\GestaoProcessos\\${p.numero}`,
      files: documentFiles
    };
  });

  // Fetch local backups to list them dynamically inside C:\GestaoProcessos\Backup
  const backupsRaw = localStorage.getItem('gestao_processos_backups');
  let backupFiles: DiskFolder[] = [];
  if (backupsRaw) {
    try {
      const backupList = JSON.parse(backupsRaw);
      backupFiles = backupList.map((b: any) => ({
        name: b.filename,
        isFolder: false,
        path: `C:\\GestaoProcessos\\Backup\\${b.filename}`,
        size: b.size,
        meta: {
          id: b.id,
          nome: b.filename,
          categoria: 'Cópia de Segurança (Backup)',
          dataApresentacao: b.timestamp.substring(0, 10),
          parteApresentante: b.wasTriggeredAuto ? 'Sistema (Cópia Automática)' : 'Administrador',
          advogadoApresentante: 'N/A',
          conteudoTexto: b.content,
          tamanho: b.size,
          tipoMime: 'application/json'
        }
      }));
    } catch (e) {
      // ignore empty or corrupt backup format
    }
  }

  const backupFolder: DiskFolder = {
    name: 'Backup',
    isFolder: true,
    path: 'C:\\GestaoProcessos\\Backup',
    files: backupFiles
  };

  return [
    {
      name: 'Disco Local (C:)',
      isFolder: true,
      path: 'C:\\',
      files: [
        {
          name: 'GestaoProcessos',
          isFolder: true,
          path: 'C:\\GestaoProcessos',
          files: [backupFolder, ...processFolders]
        }
      ]
    }
  ];
}

// Juízes persistence helpers
export function generateFirstUsername(fullName: string): string {
  let parts = fullName.trim().split(/\s+/);
  // remove common Portuguese titles if they appear as the first word
  const titles = ['dr.', 'dr', 'dra.', 'dra', 'juiz', 'procurador', 'desembargador', 'juiza', 'sr.', 'sr', 'sra.', 'sra', 'senhor', 'senhora', 'oficial'];
  if (parts.length > 1 && titles.includes(parts[0].toLowerCase())) {
    parts.shift();
  }
  const firstName = parts[0] || 'user';
  return firstName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, ""); // keep alpha-numeric only
}

export function generateUniqueUsername(fullName: string, users: User[]): string {
  const base = generateFirstUsername(fullName);
  let finalUsername = base;
  let count = 1;
  while (users.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
    finalUsername = `${base}${count}`;
    count++;
  }
  return finalUsername;
}

export function getJuizes(): string[] {
  const raw = localStorage.getItem('gestao_processos_juizes');
  if (!raw) {
    const seed: string[] = [];
    localStorage.setItem('gestao_processos_juizes', JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveJuiz(nome: string): { success: boolean; message: string; list: string[] } {
  const juizes = getJuizes();
  const novoNome = nome.trim();
  if (!novoNome) {
    return { success: false, message: "O nome do juiz não pode estar vazio.", list: juizes };
  }
  if (juizes.some(j => j.toLowerCase() === novoNome.toLowerCase())) {
    return { success: false, message: "Este juiz já se encontra registado no sistema.", list: juizes };
  }
  juizes.push(novoNome);
  localStorage.setItem('gestao_processos_juizes', JSON.stringify(juizes));

  // Auto-create a user account for the judge
  const users = getUsers();
  const genUser = generateUniqueUsername(novoNome, users);
  users.push({
    username: genUser,
    role: 'juiz',
    password: '1234',
    createdAt: new Date().toISOString(),
    needsSetup: true,
    fullName: novoNome
  });
  localStorage.setItem('gestao_processos_users', JSON.stringify(users));

  return { success: true, message: `Juiz registado com sucesso. Criada conta de acesso (utilizador: ${genUser}, palavra-passe inicial: 1234).`, list: juizes };
}

export function deleteJuiz(nome: string): string[] {
  let juizes = getJuizes();
  juizes = juizes.filter(j => j !== nome);
  localStorage.setItem('gestao_processos_juizes', JSON.stringify(juizes));
  return juizes;
}

// Advogados persistence helpers
export function getAdvogados(): string[] {
  const raw = localStorage.getItem('gestao_processos_advogados');
  if (!raw) {
    const seed: string[] = [];
    localStorage.setItem('gestao_processos_advogados', JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveAdvogado(nome: string): { success: boolean; message: string; list: string[] } {
  const advogados = getAdvogados();
  const novoNome = nome.trim();
  if (!novoNome) {
    return { success: false, message: "O nome do advogado não pode estar vazio.", list: advogados };
  }
  if (advogados.some(a => a.toLowerCase() === novoNome.toLowerCase())) {
    return { success: false, message: "Este advogado já se encontra registado no sistema.", list: advogados };
  }
  advogados.push(novoNome);
  localStorage.setItem('gestao_processos_advogados', JSON.stringify(advogados));
  return { success: true, message: "Advogado registado com sucesso.", list: advogados };
}

export function deleteAdvogado(nome: string): string[] {
  let advogados = getAdvogados();
  advogados = advogados.filter(a => a !== nome);
  localStorage.setItem('gestao_processos_advogados', JSON.stringify(advogados));
  return advogados;
}

// Procuradores persistence helpers
export function getProcuradores(): string[] {
  const raw = localStorage.getItem('gestao_processos_procuradores');
  if (!raw) {
    const seed: string[] = [];
    localStorage.setItem('gestao_processos_procuradores', JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveProcurador(nome: string): { success: boolean; message: string; list: string[] } {
  const procuradores = getProcuradores();
  const novoNome = nome.trim();
  if (!novoNome) {
    return { success: false, message: "O nome do procurador não pode estar vazio.", list: procuradores };
  }
  if (procuradores.some(p => p.toLowerCase() === novoNome.toLowerCase())) {
    return { success: false, message: "Este procurador já se encontra registado no sistema.", list: procuradores };
  }
  procuradores.push(novoNome);
  localStorage.setItem('gestao_processos_procuradores', JSON.stringify(procuradores));

  // Auto-create a user account for the procurador
  const users = getUsers();
  const genUser = generateUniqueUsername(novoNome, users);
  users.push({
    username: genUser,
    role: 'procurador',
    password: '1234',
    createdAt: new Date().toISOString(),
    needsSetup: true,
    fullName: novoNome
  });
  localStorage.setItem('gestao_processos_users', JSON.stringify(users));

  return { success: true, message: `Procurador registado com sucesso. Criada conta de acesso (utilizador: ${genUser}, palavra-passe inicial: 1234).`, list: procuradores };
}

export function deleteProcurador(nome: string): string[] {
  let procuradores = getProcuradores();
  procuradores = procuradores.filter(p => p !== nome);
  localStorage.setItem('gestao_processos_procuradores', JSON.stringify(procuradores));
  return procuradores;
}

// Funcionários persistence helpers
export function getFuncionarios(): string[] {
  const raw = localStorage.getItem('gestao_processos_funcionarios');
  if (!raw) {
    const seed: string[] = [];
    localStorage.setItem('gestao_processos_funcionarios', JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveFuncionario(nome: string): { success: boolean; message: string; list: string[] } {
  const list = getFuncionarios();
  const novoNome = nome.trim();
  if (!novoNome) {
    return { success: false, message: "O nome do funcionário não pode estar vazio.", list };
  }
  if (list.some(f => f.toLowerCase() === novoNome.toLowerCase())) {
    return { success: false, message: "Este funcionário já se encontra registado no sistema.", list };
  }
  list.push(novoNome);
  localStorage.setItem('gestao_processos_funcionarios', JSON.stringify(list));

  // Auto-create a user account for the funcionario
  const users = getUsers();
  const genUser = generateUniqueUsername(novoNome, users);
  users.push({
    username: genUser,
    role: 'funcionario',
    password: '1234',
    createdAt: new Date().toISOString(),
    needsSetup: true,
    fullName: novoNome
  });
  localStorage.setItem('gestao_processos_users', JSON.stringify(users));

  return { success: true, message: `Funcionário registado com sucesso. Criada conta de acesso (utilizador: ${genUser}, palavra-passe inicial: 1234).`, list };
}

export function deleteFuncionario(nome: string): string[] {
  let list = getFuncionarios();
  list = list.filter(f => f !== nome);
  localStorage.setItem('gestao_processos_funcionarios', JSON.stringify(list));
  return list;
}

// Update persistence helpers for administration panel
export function updateJuiz(oldNome: string, newNome: string): { success: boolean; message: string; list: string[] } {
  const list = getJuizes();
  const index = list.indexOf(oldNome);
  if (index === -1) return { success: false, message: "Juiz não encontrado.", list };
  const trimNew = newNome.trim();
  if (!trimNew) return { success: false, message: "O nome do juiz não pode estar vazio.", list };
  if (list.some((j, i) => i !== index && j.toLowerCase() === trimNew.toLowerCase())) {
    return { success: false, message: "Este juiz já se encontra registado no sistema.", list };
  }
  list[index] = trimNew;
  localStorage.setItem('gestao_processos_juizes', JSON.stringify(list));
  return { success: true, message: "Juiz atualizado com sucesso.", list };
}

export function updateAdvogado(oldNome: string, newNome: string): { success: boolean; message: string; list: string[] } {
  const list = getAdvogados();
  const index = list.indexOf(oldNome);
  if (index === -1) return { success: false, message: "Advogado não encontrado.", list };
  const trimNew = newNome.trim();
  if (!trimNew) return { success: false, message: "O nome do advogado não pode estar vazio.", list };
  if (list.some((a, i) => i !== index && a.toLowerCase() === trimNew.toLowerCase())) {
    return { success: false, message: "Este advogado já se encontra registado no sistema.", list };
  }
  list[index] = trimNew;
  localStorage.setItem('gestao_processos_advogados', JSON.stringify(list));
  return { success: true, message: "Advogado atualizado com sucesso.", list };
}

export function updateProcurador(oldNome: string, newNome: string): { success: boolean; message: string; list: string[] } {
  const list = getProcuradores();
  const index = list.indexOf(oldNome);
  if (index === -1) return { success: false, message: "Procurador não encontrado.", list };
  const trimNew = newNome.trim();
  if (!trimNew) return { success: false, message: "O nome do procurador não pode estar vazio.", list };
  if (list.some((p, i) => i !== index && p.toLowerCase() === trimNew.toLowerCase())) {
    return { success: false, message: "Este procurador já se encontra registado no sistema.", list };
  }
  list[index] = trimNew;
  localStorage.setItem('gestao_processos_procuradores', JSON.stringify(list));
  return { success: true, message: "Procurador atualizado com sucesso.", list };
}

export function updateFuncionario(oldNome: string, newNome: string): { success: boolean; message: string; list: string[] } {
  const list = getFuncionarios();
  const index = list.indexOf(oldNome);
  if (index === -1) return { success: false, message: "Funcionário não encontrado.", list };
  const trimNew = newNome.trim();
  if (!trimNew) return { success: false, message: "O nome do funcionário não pode estar vazio.", list };
  if (list.some((f, i) => i !== index && f.toLowerCase() === trimNew.toLowerCase())) {
    return { success: false, message: "Este funcionário já se encontra registado no sistema.", list };
  }
  list[index] = trimNew;
  localStorage.setItem('gestao_processos_funcionarios', JSON.stringify(list));
  return { success: true, message: "Funcionário atualizado com sucesso.", list };
}

// --- TRIBUNAIS PERSISTENCE ---
export function getTribunais(): Tribunal[] {
  const raw = localStorage.getItem(STORAGE_KEYS.TRIBUNAIS);
  if (!raw) {
    const seed: Tribunal[] = [
      {
        id: 't-csm',
        localidade: 'Maputo',
        tribunal: 'Conselho Superior da Magistratura Judicial de Moçambique',
        imagemCabecalho: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&h=120&q=80'
      },
      {
        id: 't-maputo',
        localidade: 'Maputo',
        tribunal: 'Tribunal Judicial da Cidade de Maputo',
        imagemCabecalho: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&h=120&q=80'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.TRIBUNAIS, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveTribunal(localidade: string, tribunalNome: string, imagemCabecalho?: string): Tribunal[] {
  const list = getTribunais();
  const novo: Tribunal = {
    id: generateId(),
    localidade: localidade.trim(),
    tribunal: tribunalNome.trim(),
    imagemCabecalho: imagemCabecalho || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&h=120&q=80'
  };
  list.push(novo);
  localStorage.setItem(STORAGE_KEYS.TRIBUNAIS, JSON.stringify(list));
  return list;
}

export function updateTribunal(item: Tribunal): Tribunal[] {
  const list = getTribunais();
  const index = list.findIndex(t => t.id === item.id);
  if (index !== -1) {
    list[index] = item;
    localStorage.setItem(STORAGE_KEYS.TRIBUNAIS, JSON.stringify(list));
  }
  return list;
}

export function deleteTribunal(id: string): Tribunal[] {
  const list = getTribunais();
  const updated = list.filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TRIBUNAIS, JSON.stringify(updated));
  return updated;
}

// --- FORMULÁRIOS MODELOS PERSISTENCE ---
export function getFormModelos(): FormModelo[] {
  const raw = localStorage.getItem(STORAGE_KEYS.FORM_MODELOS);
  if (!raw) {
    const seed: FormModelo[] = [];
    localStorage.setItem(STORAGE_KEYS.FORM_MODELOS, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveFormModelo(item: FormModelo): FormModelo[] {
  const list = getFormModelos();
  const index = list.findIndex(f => f.id === item.id);
  if (index !== -1) {
    list[index] = item;
  } else {
    list.push({ ...item, id: item.id || generateId() });
  }
  localStorage.setItem(STORAGE_KEYS.FORM_MODELOS, JSON.stringify(list));
  return list;
}

export function deleteFormModelo(id: string): FormModelo[] {
  const list = getFormModelos();
  const updated = list.filter(f => f.id !== id);
  localStorage.setItem(STORAGE_KEYS.FORM_MODELOS, JSON.stringify(updated));
  return updated;
}

// --- PROCESS NOTIFICATIONS PERSISTENCE ---
export function getNotificacoes(): ProcessNotificacao[] {
  const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICACOES);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveNotificacao(item: ProcessNotificacao): ProcessNotificacao[] {
  const list = getNotificacoes();
  const index = list.findIndex(n => n.id === item.id);
  if (index !== -1) {
    list[index] = item;
  } else {
    list.push({ ...item, id: item.id || generateId() });
  }
  localStorage.setItem(STORAGE_KEYS.NOTIFICACOES, JSON.stringify(list));
  return list;
}

export function deleteNotificacao(id: string): ProcessNotificacao[] {
  const list = getNotificacoes();
  const updated = list.filter(n => n.id !== id);
  localStorage.setItem(STORAGE_KEYS.NOTIFICACOES, JSON.stringify(updated));
  return updated;
}

export function isAuthorizationActive(createdAt: string, limiteData?: string | null): boolean {
  const now = new Date();
  
  if (limiteData) {
    const parts = limiteData.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      // Ends at 23:59:59.999 on that day local time
      const expiryDate = new Date(year, month, day, 23, 59, 59, 999);
      return now <= expiryDate;
    }
  }
  
  // If no limiteData, active for exactly 48 hours (2 days) starting from createdAt
  const createdDate = new Date(createdAt);
  const diffTime = now.getTime() - createdDate.getTime();
  const fortyEightHours = 48 * 60 * 60 * 1000;
  return diffTime >= 0 && diffTime <= fortyEightHours;
}

export function matchUserAndFullName(userOrUsername: User | string, fullName: string): boolean {
  if (!userOrUsername || !fullName) return false;
  
  let username = "";
  let userFullName = "";
  
  if (typeof userOrUsername === 'string') {
    username = userOrUsername;
  } else if (userOrUsername && typeof userOrUsername === 'object') {
    username = (userOrUsername as any).username || "";
    userFullName = (userOrUsername as any).fullName || "";
  }
  
  const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const fClean = clean(fullName);
  const uClean = clean(username);
  const ufClean = userFullName ? clean(userFullName) : "";
  
  // 1. Prioritize user's fullName matching if present
  if (ufClean) {
    if (ufClean === fClean || fClean.includes(ufClean) || ufClean.includes(fClean)) {
      return true;
    }
    const ignoreWords = ['funcionario', 'juiz', 'procurador', 'advogado', 'autor', 'reu', 'secretaria', 'comarca', 'tribunal', 'dra', 'dr', 'de', 'do', 'da', 'os', 'as', 'dos', 'das', 'em', 'e', 'para', 'na', 'no'];
    const partsF = ufClean.split(/[._\s-]+/).filter(part => part.length >= 2 && !ignoreWords.includes(part));
    if (partsF.length > 0 && partsF.every(part => fClean.includes(part))) {
      return true;
    }
  }
  
  // 2. Fallback to username matching
  if (uClean === fClean || fClean.includes(uClean) || uClean.includes(fClean)) {
    return true;
  }
  
  const ignoreWords = ['funcionario', 'juiz', 'procurador', 'advogado', 'autor', 'reu', 'secretaria', 'comarca', 'tribunal', 'dra', 'dr', 'de', 'do', 'da', 'os', 'as', 'dos', 'das', 'em', 'e', 'para', 'na', 'no'];
  // Part-based matching (split by dots, underscores, spaces, hyphens)
  const parts = uClean.split(/[._\s-]+/).filter(part => part.length >= 2 && !ignoreWords.includes(part));
  if (parts.length > 0) {
    // Every part of the username must be contained in the full name
    return parts.every(part => fClean.includes(part));
  }
  
  return false;
}

export function getUserPermissionForProcess(user: User | null, p: Processo): 'consulta' | 'todos' | 'nenhuma' {
  if (!user) return 'nenhuma';
  if (user.role === 'administrador') return 'todos';
  
  const uname = user.username.toLowerCase().trim();
  const matches = (fullName: string) => {
    return matchUserAndFullName(user, fullName);
  };

  // 1. Check Native Association
  let isNative = false;
  if (user.role === 'juiz' && matches(p.juizTitular)) isNative = true;
  if (user.role === 'procurador' && p.procuradores?.some(matches)) isNative = true;
  if (user.role === 'funcionario' && p.funcionarios?.some(matches)) isNative = true;
  if (user.role === 'advogado' && (p.advogadosAutor?.some(matches) || p.advogadosReu?.some(matches))) isNative = true;

  let highestPerm: 'consulta' | 'todos' | 'nenhuma' = isNative ? 'todos' : 'nenhuma';

  // 2. Check Peer-to-Peer Shared Authorizations
  try {
    const rawShared = localStorage.getItem('gestao_processos_autorizacoes_partilhadas');
    if (rawShared) {
      const list: any[] = JSON.parse(rawShared);
      const matchedShared = list.filter(item => 
        item.processoNumero === p.numero && 
        item.grantedTo.toLowerCase().trim() === uname &&
        item.role === user.role
      );
      for (const item of matchedShared) {
        if (!isAuthorizationActive(item.createdAt, item.limiteData)) {
          continue;
        }
        if (item.perm === 'todos') {
          highestPerm = 'todos';
        } else if (item.perm === 'consulta' && highestPerm === 'nenhuma') {
          highestPerm = 'consulta';
        }
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 3. Check Admin Authorizations
  try {
    const rawAdmin = localStorage.getItem('gestao_processos_autorizacoes_admin');
    if (rawAdmin) {
      const list: any[] = JSON.parse(rawAdmin);
      const matchedAdmin = list.filter(item => 
        item.userId.toLowerCase().trim() === uname
      );
      
      for (const item of matchedAdmin) {
        if (!isAuthorizationActive(item.createdAt, item.expiraEm || item.limiteData)) {
          continue;
        }
        
        // Check scope
        let scopeMatches = false;
        if (item.scope === 'todos') {
          scopeMatches = true;
        } else if ((item.scope === 'uns' || item.scope === 'alguns') && item.processoNumeros && item.processoNumeros.includes(p.numero)) {
          scopeMatches = true;
        }
        
        if (scopeMatches) {
          if (item.perm === 'todos') {
            highestPerm = 'todos';
          } else if (item.perm === 'consulta' && highestPerm === 'nenhuma') {
            highestPerm = 'consulta';
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  }

  return highestPerm;
}

export function isUserAssociatedWithProcess(user: User | null, p: Processo): boolean {
  return getUserPermissionForProcess(user, p) !== 'nenhuma';
}

export function isUserNativelyAssociatedWithProcess(user: User | null, p: Processo): boolean {
  if (!user) return false;
  if (user.role === 'administrador') return true;
  
  const matches = (fullName: string) => {
    return matchUserAndFullName(user, fullName);
  };

  if (user.role === 'juiz' && matches(p.juizTitular)) return true;
  if (user.role === 'procurador' && p.procuradores?.some(matches)) return true;
  if (user.role === 'funcionario' && p.funcionarios?.some(matches)) return true;
  if (user.role === 'advogado' && (p.advogadosAutor?.some(matches) || p.advogadosReu?.some(matches))) return true;

  return false;
}

export function isUserAuthorizedForProcess(user: User | null, p: Processo): boolean {
  if (!user) return false;
  if (user.role === 'administrador') return false;
  return isUserAssociatedWithProcess(user, p) && !isUserNativelyAssociatedWithProcess(user, p);
}

export interface AdminAuth {
  id: string;
  userId: string;
  tipo: 'permanente' | 'temporaria';
  expiraEm?: string; // YYYY-MM-DD
  scope: 'todos' | 'uns' | 'alguns';
  processoNumeros?: string[]; // processes
  perm: 'consulta' | 'todos';
  createdAt: string;
}

export function getAdminAuthorizations(): AdminAuth[] {
  try {
    const raw = localStorage.getItem('gestao_processos_autorizacoes_admin');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

export function saveAdminAuthorization(auth: AdminAuth): void {
  try {
    const list = getAdminAuthorizations();
    const existingIndex = list.findIndex(item => item.id === auth.id);
    if (existingIndex >= 0) {
      list[existingIndex] = auth;
    } else {
      list.push(auth);
    }
    localStorage.setItem('gestao_processos_autorizacoes_admin', JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
}

export function deleteAdminAuthorization(id: string): void {
  try {
    const list = getAdminAuthorizations();
    const filtered = list.filter(item => item.id !== id);
    localStorage.setItem('gestao_processos_autorizacoes_admin', JSON.stringify(filtered));
  } catch (e) {
    console.error(e);
  }
}

export function seedFictitiousData(): { success: boolean; message: string; processos: Processo[] } {
  // 1. Seed Juízes
  const juizesSeed = [
    "Dra. Joana Almerinda Chissano",
    "Dr. Alberto Francisco Maleiane",
    "Dra. Maria Lurdes de Oliveira",
    "Dr. Tomás Nhassengo"
  ];
  localStorage.setItem('gestao_processos_juizes', JSON.stringify(juizesSeed));

  // 2. Seed Advogados
  const advogadosSeed = [
    "Dr. Gilberto Ismael",
    "Dra. Sheila de Lemos",
    "Dr. Abdul Carimo",
    "Dra. Patrícia da Silva"
  ];
  localStorage.setItem('gestao_processos_advogados', JSON.stringify(advogadosSeed));

  // 3. Seed Procuradores
  const procuradoresSeed = [
    "Dra. Beatriz Custódio Tembe",
    "Dr. Amílcar Amade Miquidade",
    "Dra. Ana Maria Sitoe",
    "Dr. Salomão Mungoi"
  ];
  localStorage.setItem('gestao_processos_procuradores', JSON.stringify(procuradoresSeed));

  // 4. Seed Funcionários
  const funcionariosSeed = [
    "Armando Mateus Bila",
    "Telma Hortênsia Langa",
    "Isabel Margarida Mucavele",
    "Carlos Daniel Cossa"
  ];
  localStorage.setItem('gestao_processos_funcionarios', JSON.stringify(funcionariosSeed));

  // 5. Seed detailed Intervenientes Fichas
  const intervenientesFichas = [
    {
      nome: "Sociedade Moçambicana de Investimentos, S.A.",
      nuit: "400129384",
      nomePai: "N/A",
      nomeMae: "N/A",
      dataNascimento: "2010-04-12",
      bilheteIdentidade: "N/A",
      profissao: "Sociedade Comercial",
      moradas: [{ id: "m1", endereco: "Av. Karl Marx, n.º 1420, Maputo", isAtual: true }],
      telefone: "+258 21 330 400",
      email: "geral@smi.co.mz",
      tipo: "autor"
    },
    {
      nome: "Banco Comercial e de Fomento, S.A.",
      nuit: "400192843",
      nomePai: "N/A",
      nomeMae: "N/A",
      dataNascimento: "1998-11-22",
      bilheteIdentidade: "N/A",
      profissao: "Instituição Financeira",
      moradas: [{ id: "m2", endereco: "Av. 25 de Setembro, n.º 844, Maputo", isAtual: true }],
      telefone: "+258 21 445 500",
      email: "contacto@bcf.co.mz",
      tipo: "reu"
    },
    {
      nome: "Construtora do Índico, Lda.",
      nuit: "400582931",
      nomePai: "N/A",
      nomeMae: "N/A",
      dataNascimento: "2015-08-01",
      bilheteIdentidade: "N/A",
      profissao: "Construção Civil",
      moradas: [{ id: "m3", endereco: "Av. de Angola, n.º 2300, Maputo", isAtual: true }],
      telefone: "+258 84 990 1234",
      email: "obras@indico.co.mz",
      tipo: "autor"
    },
    {
      nome: "Telecomunicações de Moçambique (TDM)",
      nuit: "400283748",
      nomePai: "N/A",
      nomeMae: "N/A",
      dataNascimento: "1981-06-01",
      bilheteIdentidade: "N/A",
      profissao: "Telecomunicações",
      moradas: [{ id: "m4", endereco: "Rua da Sé, n.º 12, Maputo", isAtual: true }],
      telefone: "+258 21 000 111",
      email: "suporte@tdm.mz",
      tipo: "reu"
    },
    {
      nome: "Mussa Almor Amade",
      nuit: "102938472",
      nomePai: "Almor Selemane Amade",
      nomeMae: "Fátima Zaida Amade",
      dataNascimento: "1978-05-14",
      bilheteIdentidade: "1102938472B",
      profissao: "Empresário",
      moradas: [{ id: "m5", endereco: "Av. Julius Nyerere, n.º 312, Maputo", isAtual: true }],
      telefone: "+258 82 445 1234",
      email: "mussa.amade@gmail.com",
      tipo: "autor"
    },
    {
      nome: "Celeste Eunice Mondlane",
      nuit: "129384812",
      nomePai: "Eunice Mondlane",
      nomeMae: "Mariana Mondlane",
      dataNascimento: "1985-09-21",
      bilheteIdentidade: "129384812C",
      profissao: "Docente",
      moradas: [{ id: "m6", endereco: "Av. Eduardo Mondlane, n.º 1500, Maputo", isAtual: true }],
      telefone: "+258 84 123 4567",
      email: "celeste.mondlane@gmail.com",
      tipo: "reu"
    }
  ];
  localStorage.setItem('gestao_processos_intervenientes_fichas', JSON.stringify(intervenientesFichas));

  // 6. Seed detailed Advogados Fichas
  const advogadosFichas = [
    {
      nome: "Dr. Gilberto Ismael",
      cedulaProfissional: "1452",
      bilheteIdentidade: "11234567A",
      moradasProfissionais: [{ id: "a1", endereco: "Av. Kim Il Sung, n.º 450, Maputo", isAtual: true }],
      telefone: "+258 84 332 1100",
      email: "gilberto.ismael@oam.org.mz",
      fax: "+258 21 440 220"
    },
    {
      nome: "Dra. Sheila de Lemos",
      cedulaProfissional: "2311",
      bilheteIdentidade: "12345678B",
      moradasProfissionais: [{ id: "a2", endereco: "Av. Mao Tse Tung, n.º 1120, Maputo", isAtual: true }],
      telefone: "+258 84 550 4422",
      email: "sheila.lemos@oam.org.mz",
      fax: "+258 21 440 221"
    },
    {
      nome: "Dr. Abdul Carimo",
      cedulaProfissional: "844",
      bilheteIdentidade: "13456789C",
      moradasProfissionais: [{ id: "a3", endereco: "Av. Kenneth Kaunda, n.º 88, Maputo", isAtual: true }],
      telefone: "+258 82 120 4455",
      email: "abdul.carimo@oam.org.mz",
      fax: "+258 21 440 222"
    },
    {
      nome: "Dra. Patrícia da Silva",
      cedulaProfissional: "3105",
      bilheteIdentidade: "14567890D",
      moradasProfissionais: [{ id: "a4", endereco: "Rua de Bagamoyo, n.º 15, Maputo", isAtual: true }],
      telefone: "+258 84 990 8822",
      email: "patricia.silva@oam.org.mz",
      fax: "+258 21 440 223"
    }
  ];
  localStorage.setItem('gestao_processos_advogados_detalhados_fichas', JSON.stringify(advogadosFichas));

  // 7. Seed System Users (Juiz, Procurador, Clerks, Lawyers) to easily switch roles
  const currentUsers = getUsers();
  const newUsersSeed = [
    { username: "antonio.j.gomes@csm.org.pt", role: 'administrador' as const, password: "123", createdAt: new Date().toISOString(), tribunalId: 't-csm', fullName: "António J. Gomes" },
    { username: "joana.chissano", role: 'juiz' as const, password: "123", createdAt: new Date().toISOString(), tribunalId: 't-maputo', fullName: "Dra. Joana Almerinda Chissano" },
    { username: "alberto.maleiane", role: 'juiz' as const, password: "123", createdAt: new Date().toISOString(), tribunalId: 't-maputo', fullName: "Dr. Alberto Francisco Maleiane" },
    { username: "beatriz.tembe", role: 'procurador' as const, password: "123", createdAt: new Date().toISOString(), tribunalId: 't-maputo', fullName: "Dra. Beatriz Custódio Tembe" },
    { username: "armando.bila", role: 'funcionario' as const, password: "123", createdAt: new Date().toISOString(), tribunalId: 't-maputo', fullName: "Armando Mateus Bila" },
    { username: "gilberto.ismael", role: 'advogado' as const, password: "123", createdAt: new Date().toISOString(), tribunalId: 't-maputo', fullName: "Dr. Gilberto Ismael" },
    { username: "sheila.lemos", role: 'advogado' as const, password: "123", createdAt: new Date().toISOString(), tribunalId: 't-maputo', fullName: "Dra. Sheila de Lemos" }
  ];
  
  // Merge users, keeping duplicates overwritten with fresh test passwords
  const mergedUsers = [...currentUsers];
  newUsersSeed.forEach(seedU => {
    const idx = mergedUsers.findIndex(u => u.username.toLowerCase() === seedU.username.toLowerCase());
    if (idx !== -1) {
      mergedUsers[idx] = seedU;
    } else {
      mergedUsers.push(seedU);
    }
  });
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(mergedUsers));

  // 8. 4 Processos Fictícios
  const baseDocsSeed = [
    {
      id: generateId(),
      nome: "Peticao_Inicial_Assinada_SMI.pdf",
      categoria: "Petição inicial",
      dataApresentacao: "2026-05-10",
      parteApresentante: "Sociedade Moçambicana de Investimentos, S.A.",
      advogadoApresentante: "Dr. Gilberto Ismael",
      conteudoUrl: MINIMAL_PDF_BASE64,
      conteudoTexto: "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA SECÇÃO COMERCIAL DO TRIBUNAL JUDICIAL DA CIDADE DE MAPUTO\n\nSOCIEDADE MOÇAMBICANA DE INVESTIMENTOS, S.A., NUIT 400129384, com sede em Maputo, vem por este meio intentar a presente ACÇÃO ORDINÁRIA DE INCUMPRIMENTO CONTRATUAL E PERDAS E DANOS contra BANCO COMERCIAL E DE FOMENTO, S.A., NUIT 400192843, com base nos factos que passa a expor:\n1. As partes celebraram um contrato de garantia de investimento e mútuo financeiro.\n2. O Réu recusou injustificadamente a libertação das tranches de crédito acordadas.\n3. Disso resultou avultado prejuízo na ordem dos 12.500.000 MT.\n\nTermos em que requer a V.Excia se digne julgar provada e procedente a presente acção.\n\nPedem Deferimento.",
      tamanho: "142 KB",
      tipoMime: "application/pdf",
      valorTaxaJustica: 150000,
      pagadorTaxaJustica: "Sociedade Moçambicana de Investimentos, S.A."
    },
    {
      id: generateId(),
      nome: "Contestacao_BCF_Oposicao.pdf",
      categoria: "Contestação (incluindo com reconvenção ou de contas)",
      dataApresentacao: "2026-05-25",
      parteApresentante: "Banco Comercial e de Fomento, S.A.",
      advogadoApresentante: "Dra. Sheila de Lemos",
      conteudoUrl: MINIMAL_PDF_BASE64,
      conteudoTexto: "CONTESTAÇÃO DO RÉU BANCO COMERCIAL E DE FOMENTO, S.A.\n\nO Réu, devidamente notificado, vem oferecer a sua contestação:\n1. A recusa de financiamento deveu-se à falta de apresentação de garantias colaterais de primeiro grau.\n2. O Autor encontrava-se em situação de incumprimento com outras entidades do grupo financeiro.\n3. Inexistência de perdas e danos imputáveis a esta instituição.\n\nRequer-se a absolvição do Réu do pedido.\n\nAdvogado do Réu, Dra. Sheila de Lemos.",
      tamanho: "98 KB",
      tipoMime: "application/pdf"
    }
  ];

  const processos: Processo[] = [
    // Processo 1
    {
      id: generateId(),
      numero: "0042/TJCMP/2026",
      autores: ["Sociedade Moçambicana de Investimentos, S.A."],
      reus: ["Banco Comercial e de Fomento, S.A."],
      dataAutuacao: "2026-05-10",
      juizTitular: "Dra. Joana Almerinda Chissano",
      advogadosAutor: ["Dr. Gilberto Ismael"],
      advogadosReu: ["Dra. Sheila de Lemos"],
      procuradores: [],
      funcionarios: ["Armando Mateus Bila"],
      notificacoesDestinatarios: ["Dr. Gilberto Ismael", "Dra. Sheila de Lemos"],
      documentos: [baseDocsSeed[0], baseDocsSeed[1]],
      createdAt: new Date().toISOString(),
      tipo: "civel",
      especieCivel: "Processo de declaração",
      tipoAccaoCivel: "processo ordinário",
      valorAcao: 12500000,
      faseAtual: "Instrução e Saneamento",
      alarmeAtivo: true,
      alarmeTipo: "automatico",
      alarmeData: "2026-07-24",
      alarmeNota: "Alarme automático (60 dias após a contestação)",
      alarmeDias: 60,
      historicoAtos: [
        {
          id: generateId(),
          data: "2026-05-25",
          descricao: "Apresentação de Contestação pela parte Ré",
          fase: "Articulados",
          tipoAto: "Contestação / Defesa",
          documentosIds: [baseDocsSeed[1].id],
          parteAssociada: "Banco Comercial e de Fomento, S.A.",
          advogadoPraticante: "Dra. Sheila de Lemos",
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          data: "2026-05-10",
          descricao: "Petição Inicial Autuada na Secretaria Geral",
          fase: "Instrução Inicial",
          tipoAto: "Petição inicial",
          documentosIds: [baseDocsSeed[0].id],
          parteAssociada: "Sociedade Moçambicana de Investimentos, S.A.",
          advogadoPraticante: "Dr. Gilberto Ismael",
          createdAt: new Date().toISOString()
        }
      ],
      agendaCompromissos: [
        {
          id: generateId(),
          titulo: "Audiência Preliminar de Conciliação e Fixação do Objeto do Litígio",
          dataLimite: "2026-07-15",
          destinatario: "Ambas as Partes",
          responsavel: "Dra. Joana Almerinda Chissano",
          fase: "Tentativa de Conciliação",
          createdAt: new Date().toISOString()
        }
      ]
    },
    // Processo 2
    {
      id: generateId(),
      numero: "0115/TJCMP/2026",
      autores: ["Construtora do Índico, Lda."],
      reus: ["Telecomunicações de Moçambique (TDM)"],
      dataAutuacao: "2026-04-15",
      juizTitular: "Dr. Alberto Francisco Maleiane",
      advogadosAutor: ["Dr. Abdul Carimo"],
      advogadosReu: ["Dra. Patrícia da Silva"],
      procuradores: [],
      funcionarios: ["Telma Hortênsia Langa"],
      notificacoesDestinatarios: ["Dr. Abdul Carimo", "Dra. Patrícia da Silva"],
      documentos: [
        {
          id: generateId(),
          nome: "Requerimento_Executivo_Obras.pdf",
          categoria: "Requerimento executivo",
          dataApresentacao: "2026-04-15",
          parteApresentante: "Construtora do Índico, Lda.",
          advogadoApresentante: "Dr. Abdul Carimo",
          conteudoUrl: MINIMAL_PDF_BASE64,
          conteudoTexto: "REQUERIMENTO EXECUTIVO PARA PAGAMENTO DE QUANTIA CERTA\n\nCONSTRUTORA DO ÍNDICO, LDA., vem requerer execução de dívida contra TELECOMUNICAÇÕES DE MOÇAMBIQUE (TDM):\n1. O exequente é credor da quantia líquida de 4.820.000 MT, titulada por faturas aceites e não pagas de empreitadas de canalização subterrânea.\n2. Esgotados os prazos amigáveis, resta a via judicial.\n3. Requer-se a imediata penhora de bens suficientes para solver a dívida.\n\nAdvogado Abdul Carimo.",
          tamanho: "115 KB",
          tipoMime: "application/pdf",
          valorTaxaJustica: 50000,
          pagadorTaxaJustica: "Construtora do Índico, Lda."
        },
        {
          id: generateId(),
          nome: "Auto_de_Penhora_Contas.pdf",
          categoria: "Auto de penhora",
          dataApresentacao: "2026-05-18",
          parteApresentante: "Secretaria Judicial",
          advogadoApresentante: "N/A",
          conteudoUrl: MINIMAL_PDF_BASE64,
          conteudoTexto: "AUTO DE PENHORA DE ATIVOS FINANCEIROS\n\nAos dezoito dias do mês de Maio de 2026, eu, Telma Hortênsia Langa, Oficial de Justiça, procedi à penhora eletrónica de saldos bancários nas contas da executada Telecomunicações de Moçambique no valor reclamado de 4.820.000 MT. O saldo foi temporariamente indisponibilizado e transferido para a conta de depósitos à ordem do Tribunal.\n\nOficial de Justiça.",
          tamanho: "88 KB",
          tipoMime: "application/pdf"
        }
      ],
      createdAt: new Date().toISOString(),
      tipo: "civel",
      especieCivel: "Processo de execução",
      tipoAccaoCivel: "execução para pagamento de quantia certa",
      valorAcao: 4820000,
      faseAtual: "Penhora de Ativos",
      alarmeAtivo: true,
      alarmeTipo: "automatico",
      alarmeData: "2026-07-18",
      alarmeNota: "Alarme automático (60 dias após a penhora)",
      alarmeDias: 60,
      historicoAtos: [
        {
          id: generateId(),
          data: "2026-05-18",
          descricao: "Efetivação de Penhora Eletrónica de Contas Bancárias",
          fase: "Penhora",
          tipoAto: "Auto de penhora",
          parteAssociada: "Telecomunicações de Moçambique (TDM)",
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          data: "2026-04-15",
          descricao: "Autuação de Ação Executiva de Título de Crédito",
          fase: "Instrução Inicial",
          tipoAto: "Requerimento executivo",
          parteAssociada: "Construtora do Índico, Lda.",
          advogadoPraticante: "Dr. Abdul Carimo",
          createdAt: new Date().toISOString()
        }
      ],
      agendaCompromissos: [
        {
          id: generateId(),
          titulo: "Prazo Limite para Oposição à Execução pela Executada",
          dataLimite: "2026-06-28",
          destinatario: "Telecomunicações de Moçambique (TDM)",
          responsavel: "Dra. Patrícia da Silva",
          fase: "Oposição",
          createdAt: new Date().toISOString()
        }
      ]
    },
    // Processo 3
    {
      id: generateId(),
      numero: "0089/TJCMP/2026",
      autores: ["Mussa Almor Amade"],
      reus: ["Celeste Eunice Mondlane"],
      dataAutuacao: "2026-02-20",
      juizTitular: "Dra. Maria Lurdes de Oliveira",
      advogadosAutor: ["Dr. Gilberto Ismael"],
      advogadosReu: ["Dr. Abdul Carimo"],
      procuradores: [],
      funcionarios: ["Isabel Margarida Mucavele"],
      notificacoesDestinatarios: ["Dr. Gilberto Ismael", "Dr. Abdul Carimo"],
      documentos: [
        {
          id: generateId(),
          nome: "Peticao_Inventario_Bens.pdf",
          categoria: "Petição inicial",
          dataApresentacao: "2026-02-20",
          parteApresentante: "Mussa Almor Amade",
          advogadoApresentante: "Dr. Gilberto Ismael",
          conteudoUrl: MINIMAL_PDF_BASE64,
          conteudoTexto: "PETIÇÃO INICIAL DE INVENTÁRIO OBRIGATÓRIO\n\nMUSSA ALMOR AMADE, requer partilha judicial de herança por óbito de seu falecido pai, Almor Selemane Amade:\n1. O inventariado faleceu sem deixar testamento válido.\n2. Deixou bens imóveis e participações sociais em Maputo.\n3. O requerente e a interessada Celeste Eunice Mondlane divergem quanto às quotas partes e avaliação dos bens.\n\nRequer-se a nomeação de cabeça-de-casal e citação para partilha.",
          tamanho: "95 KB",
          tipoMime: "application/pdf"
        },
        {
          id: generateId(),
          nome: "Relacao_de_Bens_Heranca.pdf",
          categoria: "Relação de bens",
          dataApresentacao: "2026-03-15",
          parteApresentante: "Celeste Eunice Mondlane",
          advogadoApresentante: "Dr. Abdul Carimo",
          conteudoUrl: MINIMAL_PDF_BASE64,
          conteudoTexto: "RELAÇÃO DE BENS APRESENTADA PELA CABEÇA-DE-CASAL CELESTE EUNICE MONDLANE\n\nLista descritiva:\nVerba 1: Prédio urbano sito na Avenida Julius Nyerere, n.º 312, Maputo, avaliado em 2.500.000 MT.\nVerba 2: Veículo ligeiro marca Toyota Hilux, matrícula MM-99-88, avaliado em 700.000 MT.\n\nMaputo, 15 de Março de 2026.",
          tamanho: "76 KB",
          tipoMime: "application/pdf"
        }
      ],
      createdAt: new Date().toISOString(),
      tipo: "civel",
      especieCivel: "Processos especiais",
      tipoAccaoCivel: "Inventário",
      valorAcao: 3200000,
      faseAtual: "Relação de Bens",
      alarmeAtivo: true,
      alarmeTipo: "automatico",
      alarmeData: "2026-05-15",
      alarmeNota: "Alarme automático (60 dias após a relação de bens)",
      alarmeDias: 60,
      historicoAtos: [
        {
          id: generateId(),
          data: "2026-03-15",
          descricao: "Apresentação da Relação de Bens pela interessada Cabeça-de-Casal",
          fase: "Relação de Bens",
          tipoAto: "Relação de bens",
          parteAssociada: "Celeste Eunice Mondlane",
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          data: "2026-02-20",
          descricao: "Distribuição e Autuação da Ação de Inventário",
          fase: "Instrução Inicial",
          tipoAto: "Petição inicial",
          parteAssociada: "Mussa Almor Amade",
          advogadoPraticante: "Dr. Gilberto Ismael",
          createdAt: new Date().toISOString()
        }
      ],
      agendaCompromissos: [
        {
          id: generateId(),
          titulo: "Audiência de Conferência de Interessados para Adjudicação de Quotas",
          dataLimite: "2026-07-10",
          destinatario: "Todos os Interessados",
          responsavel: "Dra. Maria Lurdes de Oliveira",
          fase: "Conferência",
          createdAt: new Date().toISOString()
        }
      ]
    },
    // Processo 4
    {
      id: generateId(),
      numero: "0312/TJCMP/2026",
      autores: ["Ministério Público de Moçambique"],
      reus: ["Celso Rogério Matsinhe", "Inácio Hilário Tembe"],
      dataAutuacao: "2026-01-10",
      juizTitular: "Dr. Tomás Nhassengo",
      advogadosAutor: [],
      advogadosReu: ["Dra. Sheila de Lemos"],
      procuradores: ["Dra. Beatriz Custódio Tembe"],
      funcionarios: ["Carlos Daniel Cossa"],
      notificacoesDestinatarios: ["Dra. Beatriz Custódio Tembe", "Dra. Sheila de Lemos"],
      documentos: [
        {
          id: generateId(),
          nome: "Auto_Noticia_Burla_Bancaria.pdf",
          categoria: "Auto de Notícia",
          dataApresentacao: "2026-01-10",
          parteApresentante: "Polícia de Investigação Criminal (SERNIC)",
          advogadoApresentante: "N/A",
          conteudoUrl: MINIMAL_PDF_BASE64,
          conteudoTexto: "AUTO DE NOTÍCIA E REGISTO DE INVESTIGAÇÃO\n\nConstatou-se através de denúncia interna do Banco de Investimentos de Moçambique a realização de transferências bancárias fraudulentas recorrendo a assinaturas e carimbos adulterados da Direção Nacional de Tesouro.\nOs arguidos Celso Rogério Matsinhe (Contabilista) e Inácio Hilário Tembe operavam contas falsas para branqueamento de capitais.",
          tamanho: "128 KB",
          tipoMime: "application/pdf"
        },
        {
          id: generateId(),
          nome: "Acusacao_Formal_MP_Burla.pdf",
          categoria: "Acusação formal (Ministério Público)",
          dataApresentacao: "2026-02-18",
          parteApresentante: "Ministério Público de Moçambique",
          advogadoApresentante: "N/A",
          conteudoUrl: MINIMAL_PDF_BASE64,
          conteudoTexto: "ACUSAÇÃO FORMAL DO MINISTÉRIO PÚBLICO\n\nA Digníssima Procuradora da República Beatriz Custódio Tembe deduz acusação em processo comum contra os arguidos Celso Rogério Matsinhe e Inácio Hilário Tembe, imputando-lhes a prática em co-autoria material de:\n1. Crime de Burla Qualificada, previsto e punível pelo Código Penal Moçambicano.\n2. Branqueamento de Capitais e Falsificação de Documentos de Crédito.\n\nCom base em provas testemunhais e extratos bancários juntos.\n\nProcuradora, Dra. Beatriz Tembe.",
          tamanho: "192 KB",
          tipoMime: "application/pdf"
        },
        {
          id: generateId(),
          nome: "Despacho_Pronuncia_Crime.pdf",
          categoria: "Despacho de Pronúncia",
          dataApresentacao: "2026-03-22",
          parteApresentante: "Tribunal Judicial",
          advogadoApresentante: "N/A",
          conteudoUrl: MINIMAL_PDF_BASE64,
          conteudoTexto: "DESPACHO DE PRONÚNCIA CRIMINAL\n\nAnalisados os autos de instrução e a acusação formulada pelo Ministério Público, este juízo julga verosímeis e indiciados suficientemente os factos imputados aos arguidos.\nDetermino a PRONÚNCIA de Celso Rogério Matsinhe e Inácio Hilário Tembe por Burla Qualificada.\n\nRemeta-se para julgamento.\n\nJuiz de Direito, Dr. Tomás Nhassengo.",
          tamanho: "110 KB",
          tipoMime: "application/pdf"
        }
      ],
      createdAt: new Date().toISOString(),
      tipo: "crime",
      faseAtual: "Julgamento Criminal",
      alarmeAtivo: true,
      alarmeTipo: "automatico",
      alarmeData: "2026-05-22",
      alarmeNota: "Alarme automático (60 dias após a pronúncia)",
      alarmeDias: 60,
      historicoAtos: [
        {
          id: generateId(),
          data: "2026-03-22",
          descricao: "Despacho de Pronúncia Criminal Proferido pelo Juiz",
          fase: "Instrução",
          tipoAto: "Despacho de Pronúncia",
          documentosIds: [],
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          data: "2026-02-18",
          descricao: "Dedução de Acusação Formal pelo Ministério Público",
          fase: "Inquérito",
          tipoAto: "Acusação formal (Ministério Público)",
          documentosIds: [],
          parteAssociada: "Ministério Público de Moçambique",
          createdAt: new Date().toISOString()
        },
        {
          id: generateId(),
          data: "2026-01-10",
          descricao: "Autuação e Abertura de Inquérito de Polícia de Investigação",
          fase: "Inquérito",
          tipoAto: "Auto de Notícia",
          documentosIds: [],
          createdAt: new Date().toISOString()
        }
      ],
      agendaCompromissos: [
        {
          id: generateId(),
          titulo: "Audiência de Julgamento Criminal de Discussão da Matéria de Facto",
          dataLimite: "2026-07-05",
          destinatario: "Arguidos e Testemunhas",
          responsavel: "Dr. Tomás Nhassengo",
          fase: "Julgamento",
          createdAt: new Date().toISOString()
        }
      ]
    }
  ];

  localStorage.setItem(STORAGE_KEYS.PROCESSOS, JSON.stringify(processos));

  return { success: true, message: "Dados de demonstração de Moçambique semeados com total sucesso!", processos };
}


