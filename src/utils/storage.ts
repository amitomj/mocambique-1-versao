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
  return { success: true, message: "Juiz registado com sucesso.", list: juizes };
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
  return { success: true, message: "Procurador registado com sucesso.", list: procuradores };
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
  return { success: true, message: "Funcionário registado com sucesso.", list };
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

