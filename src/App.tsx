/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  FolderSearch, 
  FilePlus2, 
  Layers, 
  Users, 
  LogOut, 
  UserCheck, 
  FolderHeart,
  BookOpen,
  Eye, 
  EyeOff,
  Download, 
  Printer, 
  X,
  FileText,
  Clock,
  HardDrive,
  Info,
  ChevronRight,
  ChevronDown,
  Plus,
  Compass,
  FileCheck,
  Briefcase,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ServerCrash,
  Database,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  FileJson,
  Building,
  Archive,
  Trash2,
  Calendar,
  Cpu,
  Wand2,
  Columns,
  AlertTriangle,
  LayoutGrid,
  BellRing
} from 'lucide-react';

import { CIVIL_HIERARCHY, getStoredHierarchy, saveStoredHierarchy, addCustomActTypeToHierarchy, addCustomPhaseToHierarchy, DEFAULT_FASES } from './utils/civilHierarchy';

import { 
  User as ActiveUserType, 
  Processo, 
  Documento,
  HistoricoAto
} from './types';
import { jsPDF } from 'jspdf';
import { 
  getStoredAreasHierarchy,
  saveStoredAreasHierarchy,
  type AreaProcessual,
  type CivilEspecie,
  type CivilActionType
} from './utils/civilHierarchy';

import { 
  initLocalStorageSeed, 
  getUsers, 
  saveUser, 
  getProcessos, 
  createProcesso, 
  updateProcesso,
  getActiveUser,
  setActiveUser,
  getSimulatedDiskPathStructure,
  getJuizes,
  saveJuiz,
  deleteJuiz,
  getAdvogados,
  saveAdvogado,
  deleteAdvogado,
  getProcuradores,
  saveProcurador,
  deleteProcurador,
  getFuncionarios,
  saveFuncionario,
  deleteFuncionario,
  updateJuiz,
  updateAdvogado,
  updateProcurador,
  updateFuncionario,
  getTribunais,
  saveTribunal,
  updateTribunal,
  deleteTribunal,
  getFormModelos,
  saveFormModelo,
  deleteFormModelo,
  getNotificacoes,
  saveNotificacao,
  deleteNotificacao,
  generateId,
  getDocumentClassifications,
  saveDocumentClassifications
} from './utils/storage';

import LoginScreen from './components/LoginScreen';
import FileExplorer from './components/FileExplorer';
import ProcessoDetail from './components/ProcessoDetail';
import AutoTestePanel from './components/AutoTestePanel';
import ManualUtilizador from './components/ManualUtilizador';
import { AdminHierarchyPanel } from './components/AdminHierarchyPanel';
import { AdminAuditPanel } from './components/AdminAuditPanel';

import {
  getBackupsList,
  executeBackup,
  checkAndRunAutoBackup,
  restoreDatabase,
  deleteBackup,
  BackupRecord
} from './utils/backup';

import FichaIntervenienteModal from './components/FichaIntervenienteModal';
import FichaAdvogadoModal from './components/FichaAdvogadoModal';
import FichaConsultarModal from './components/FichaConsultarModal';
import { IntervenienteFicha, AdvogadoFicha, saveInterveniente, saveAdvogadoFicha, getIntervenientes } from './utils/participants';
import { logAction } from './utils/auditLogger';

function normalizeText(str: string): string {
  if (!str) return '';
  let normalized = str.toLowerCase();
  
  // Explicit Portuguese character maps for 100% reliable normalization
  const replacements: { [key: string]: string } = {
    'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
    'ç': 'c', 'ñ': 'n'
  };

  for (const char in replacements) {
    normalized = normalized.split(char).join(replacements[char]);
  }

  // Also do NFD replace standard fallback
  normalized = normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Ignore punctuation and special characters to allow pure word-based matches
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ');

  return normalized.replace(/\s+/g, ' ').trim();
}

function matchesSearchQuery(name: string, query: string): boolean {
  if (!query) return false;
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  const normalizedTarget = normalizeText(name);
  return words.every(word => normalizedTarget.includes(word));
}

export function addDays(dateStr: string, days: number): string {
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

export function add60Days(dateStr: string): string {
  return addDays(dateStr, 60);
}

export function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getProcessoAlarmeInfo(p: Processo) {
  // A manual alarm is active if alarmeAtivo is true, we have a date, it is not silenced, and it is either specified as manual or we have data without automatic type
  const isAltManualActive = !!p.alarmeAtivo && !p.alarmeSilenciado && !!p.alarmeData && (p.alarmeTipo === 'manual' || p.alarmeTipo !== 'automatico');

  if (isAltManualActive) {
    const nota = (p.alarmeNota || '').trim();
    let categoria: 'concluir para despacho' | 'concluir para decisão' | 'verificar estado dos autos' | 'outro' = 'outro';
    const notaLower = nota.toLowerCase();
    if (notaLower.includes('despacho')) {
      categoria = 'concluir para despacho';
    } else if (notaLower.includes('decisão') || notaLower.includes('decisao')) {
      categoria = 'concluir para decisão';
    } else if (notaLower.includes('estado dos autos')) {
      categoria = 'verificar estado dos autos';
    }
    
    let ultimoAtoDesc = 'Nenhum ato praticado';
    if (p.historicoAtos && p.historicoAtos.length > 0) {
      let latestAct = p.historicoAtos[0];
      for (const act of p.historicoAtos) {
        if (act.data > latestAct.data) {
          latestAct = act;
        }
      }
      ultimoAtoDesc = latestAct.descricao;
    }
    
    return {
      data: p.alarmeData || '',
      justificacao: p.alarmeNota || 'Alarme personalizado agendado pelo utilizador.',
      categoria,
      isAutomatico: false,
      ultimoAtoDesc,
      ativo: true
    };
  }

  // Automatic alarm: custom or 60 days after last act
  const days = p.alarmeDias || 60;
  let baseDate = p.dataAutuacao || p.createdAt || getLocalTodayString();
  let ultimoAtoDesc = 'Nenhum ato praticado';
  if (p.historicoAtos && p.historicoAtos.length > 0) {
    let latestAct = p.historicoAtos[0];
    for (const act of p.historicoAtos) {
      if (act.data > latestAct.data) {
        latestAct = act;
      }
    }
    baseDate = latestAct.data;
    ultimoAtoDesc = latestAct.descricao;
  }

  const alarmDate = addDays(baseDate, days);
  // An automatic alarm is active unless the process is deleted OR it has been explicitly silenced
  const isAutoActive = p.alarmeSilenciado !== true;

  return {
    data: alarmDate,
    justificacao: `Alarme automático: ${days} dias sem novos atos (para evitar esquecimento).`,
    categoria: 'verificar estado dos autos' as const,
    isAutomatico: true,
    ultimoAtoDesc,
    ativo: isAutoActive
  };
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

function matchesFuzzy(item: string, query: string): boolean {
  if (!query) return true;
  const normQuery = normalizeText(query);
  const normItem = normalizeText(item);
  
  if (normItem.includes(normQuery)) return true;
  
  const queryWords = normQuery.split(/\s+/).filter(Boolean);
  const itemWords = normItem.split(/\s+/).filter(Boolean);
  
  if (queryWords.length === 0) return true;
  
  return queryWords.every(qw => {
    if (itemWords.some(iw => iw.includes(qw) || qw.includes(iw))) {
      return true;
    }
    return itemWords.some(iw => {
      const dist = levenshteinDistance(qw, iw);
      const allowedErrors = qw.length <= 4 ? 1 : 2;
      return dist <= allowedErrors;
    });
  });
}

export default function App() {
  // Session states
  const [currentUser, setCurrentUser] = useState<ActiveUserType | null>(null);
  const [processosList, setProcessosList] = useState<Processo[]>([]);
  const [activeTab, setActiveTab] = useState<'inicial' | 'pesquisa' | 'registo' | 'disco' | 'utilizadores' | 'agentes' | 'autoteste' | 'manual'>('inicial');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [secretariaSelectedTribunalId, setSecretariaSelectedTribunalId] = useState('');
  
  // Judges & Lawyers Local Database States
  const [juizes, setJuizes] = useState<string[]>([]);
  const [advogados, setAdvogados] = useState<string[]>([]);
  const [globalProcuradores, setGlobalProcuradores] = useState<string[]>([]);
  const [funcionarios, setFuncionarios] = useState<string[]>([]);
  const [juizError, setJuizError] = useState('');
  const [juizSuccess, setJuizSuccess] = useState('');
  const [advogadoError, setAdvogadoError] = useState('');
  const [advogadoSuccess, setAdvogadoSuccess] = useState('');
  const [procuradorError, setProcuradorError] = useState('');
  const [procuradorSuccess, setProcuradorSuccess] = useState('');
  const [funcionarioError, setFuncionarioError] = useState('');
  const [funcionarioSuccess, setFuncionarioSuccess] = useState('');

  // Editing state for Magistrates & Attorneys
  const [editingJuizNome, setEditingJuizNome] = useState<string | null>(null);
  const [editingJuizVal, setEditingJuizVal] = useState('');
  const [editingAdvNome, setEditingAdvNome] = useState<string | null>(null);
  const [editingAdvVal, setEditingAdvVal] = useState('');
  const [editingProcuradorNome, setEditingProcuradorNome] = useState<string | null>(null);
  const [editingProcuradorVal, setEditingProcuradorVal] = useState('');
  const [editingFuncionarioNome, setEditingFuncionarioNome] = useState<string | null>(null);
  const [editingFuncionarioVal, setEditingFuncionarioVal] = useState('');

  // Backups Local Database States
  const [backupsList, setBackupsList] = useState<BackupRecord[]>([]);
  const [backupStatusMsg, setBackupStatusMsg] = useState<string>('');

  // Modals view and edits for Fichas (Participants and Lawyers)
  const [fichaConsultarNome, setFichaConsultarNome] = useState<string>('');
  const [fichaIntervenienteOpen, setFichaIntervenienteOpen] = useState(false);
  const [fichaIntervenienteTipo, setFichaIntervenienteTipo] = useState<'autor' | 'reu' | 'procurador'>('autor');
  const [fichaIntervenienteName, setFichaIntervenienteName] = useState('');
  const [onFichaIntervenienteSave, setOnFichaIntervenienteSave] = useState<((ficha: IntervenienteFicha) => void) | null>(null);

  const [fichaAdvogadoOpen, setFichaAdvogadoOpen] = useState(false);
  const [fichaAdvogadoName, setFichaAdvogadoName] = useState('');
  const [onFichaAdvogadoSave, setOnFichaAdvogadoSave] = useState<((ficha: AdvogadoFicha) => void) | null>(null);

  const [fichaIntervenienteExisting, setFichaIntervenienteExisting] = useState<IntervenienteFicha | undefined>(undefined);
  const [fichaAdvogadoExisting, setFichaAdvogadoExisting] = useState<AdvogadoFicha | undefined>(undefined);
  
  // Autocomplete suggestions show states
  const [showJuizSuggestions, setShowJuizSuggestions] = useState(false);
  const [showAutorSuggestions, setShowAutorSuggestions] = useState(false);
  const [showReuSuggestions, setShowReuSuggestions] = useState(false);
  const [showAdvAutorSuggestions, setShowAdvAutorSuggestions] = useState(false);
  const [showAdvReuSuggestions, setShowAdvReuSuggestions] = useState(false);
  
  // Creation Form Input state for Judges & Lawyers
  const [novoJuizNome, setNovoJuizNome] = useState('');
  const [novoAdvNome, setNovoAdvNome] = useState('');
  const [novoProcuradorNome, setNovoProcuradorNome] = useState('');
  const [novoFuncionarioNome, setNovoFuncionarioNome] = useState('');

  // Selected process for detailed sheet view
  const [selectedProcessoNum, setSelectedProcessoNum] = useState<string | null>(null);
  const [isNewTabMode, setIsNewTabMode] = useState(false);
  const [filtroAlarmeOrigem, setFiltroAlarmeOrigem] = useState<'todos' | 'utilizador'>('todos');
  const [alarmeMostrarAnterior, setAlarmeMostrarAnterior] = useState(true);
  const [alarmeMostrarAtual, setAlarmeMostrarAtual] = useState(true);
  const [alarmeMostrarFutura, setAlarmeMostrarFutura] = useState(true);
  const [alarmeFutureDaysLimit, setAlarmeFutureDaysLimit] = useState(5);

  const handleOpenProcessoInNewTab = (numero: string) => {
    const url = `${window.location.origin}${window.location.pathname}?processo=${encodeURIComponent(numero)}`;
    window.open(url, '_blank');
  };

  const handleOpenTabInNewTab = (tab: string) => {
    const url = `${window.location.origin}${window.location.pathname}?tab=${encodeURIComponent(tab)}`;
    window.open(url, '_blank');
  };


  // Document modal states
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null);
  const [printDoc, setPrintDoc] = useState<Documento | null>(null);

  // Registration form local states
  const [regNumero, setRegNumero] = useState('');
  const [regJuiz, setRegJuiz] = useState('');
  const [regData, setRegData] = useState('2026-05-29');
  const [regProcessoTipo, setRegProcessoTipo] = useState<'crime' | 'civel'>('civel');
  const [regValorAcao, setRegValorAcao] = useState<string>('');
  const [regAlarmeDiasOpcao, setRegAlarmeDiasOpcao] = useState<string>('60');
  const [regAlarmeDiasPersonalizado, setRegAlarmeDiasPersonalizado] = useState<string>('');
  
  // Custom civil hierarchy selections
  const [regEspecieCivel, setRegEspecieCivel] = useState('Processo de declaração');
  const [regTipoAccaoCivel, setRegTipoAccaoCivel] = useState('processo ordinário');
  
  // Arrays for dynamically adding multiple authors, defendants and lawyers
  const [autores, setAutores] = useState<string[]>([]);
  const [reus, setReus] = useState<string[]>([]);
  const [advogadosAutor, setAdvogadosAutor] = useState<string[]>([]);
  const [advogadosReu, setAdvogadosReu] = useState<string[]>([]);
  const [procuradores, setProcuradores] = useState<string[]>([]);
  const [funcionariosRegisto, setFuncionariosRegisto] = useState<string[]>([]);
  const [notificacoesDestinatarios, setNotificacoesDestinatarios] = useState<string[]>([]);

  // Input value states for array fields
  const [currAutor, setCurrAutor] = useState('');
  const [currAutorNuit, setCurrAutorNuit] = useState('');
  const [currReu, setCurrReu] = useState('');
  const [currReuNuit, setCurrReuNuit] = useState('');
  const [currAdvAutor, setCurrAdvAutor] = useState('');
  const [currAdvReu, setCurrAdvReu] = useState('');
  const [currProcurador, setCurrProcurador] = useState('');
  const [currFuncionario, setCurrFuncionario] = useState('');
  const [showProcuradorSuggestions, setShowProcuradorSuggestions] = useState(false);
  const [showFuncionarioSuggestions, setShowFuncionarioSuggestions] = useState(false);

  // --- STATES FOR SECRETARIA DIGITAL (Painel Triplo / 3-Column Office Desk) ---
  const [secretariaSelectedNum, setSecretariaSelectedNum] = useState<string | null>(null);
  const [secretariaActiveDoc, setSecretariaActiveDoc] = useState<Documento | null>(null);
  const [secretariaRightTab, setSecretariaRightTab] = useState<'viewer' | 'notificar' | 'ocr' | 'agenda' | 'db_control'>('ocr');
  const [secretariaIsScanning, setSecretariaIsScanning] = useState(false);
  const [secretariaScanProgress, setSecretariaScanProgress] = useState(0);
  const [secretariaDraftText, setSecretariaDraftText] = useState('');
  const [secretariaTemplateId, setSecretariaTemplateId] = useState('');
  const [adminUserFilter, setAdminUserFilter] = useState('');
  const [secretariaSelectedRecipient, setSecretariaSelectedRecipient] = useState('');
  const [secretariaSuccessMsg, setSecretariaSuccessMsg] = useState('');
  const [secSearch, setSecSearch] = useState('');
  const [secFilterType, setSecFilterType] = useState<'todos' | 'civel' | 'crime' | 'prazo'>('todos');
  const [ocrSelectedDocKey, setOcrSelectedDocKey] = useState('arrendamento');
  const [ocrResultObj, setOcrResultObj] = useState<any>(null);
  
  // Simulated judicial agenda entries
  const [agendaEvents, setAgendaEvents] = useState<Array<{
    id: string;
    processNum: string;
    date: string;
    time: string;
    title: string;
    type: 'audiência' | 'prazos' | 'conferência';
    status: 'pendente' | 'cumprido';
    details: string;
  }>>([
    {
      id: 'evt-1',
      processNum: 'PROC-2026/101',
      date: '2026-06-03',
      time: '14:00',
      title: 'Audiência de Julgamento Inicial',
      type: 'audiência',
      status: 'pendente',
      details: 'Tribunal Judicial de Braga, Sala III. Inquirição das testemunhas indicadas pelo Autor.'
    },
    {
      id: 'evt-2',
      processNum: 'PROC-2026/102',
      date: '2026-06-05',
      time: '10:00',
      title: 'Tentativa de Conciliação Amigável',
      type: 'conferência',
      status: 'pendente',
      details: 'Gabinete de Mediação Civil. Ambas as partes devem estar presentes presencialmente.'
    },
    {
      id: 'evt-3',
      processNum: 'PROC-2026/103',
      date: '2026-05-30', // Overdue
      time: '23:59',
      title: 'Prazo Limite para Resposta à Contestação',
      type: 'prazos',
      status: 'pendente',
      details: 'Prazo de 10 dias concedido por despacho judicial para apresentar contraditório documental.'
    },
    {
      id: 'evt-4',
      processNum: 'PROC-2026/105',
      date: '2026-06-12',
      time: '16:30',
      title: 'Discussão Saneadora de Articulados',
      type: 'conferência',
      status: 'pendente',
      details: 'Conferência de juiz de direito com advogados das partes para fixar objeto do litígio.'
    }
  ]);
  const [novaAgendaTitle, setNovaAgendaTitle] = useState('');
  const [novaAgendaProcess, setNovaAgendaProcess] = useState('');
  const [novaAgendaDate, setNovaAgendaDate] = useState('2026-06-01');
  const [novaAgendaTime, setNovaAgendaTime] = useState('10:00');
  const [novaAgendaType, setNovaAgendaType] = useState<'audiência' | 'prazos' | 'conferência'>('audiência');
  const [novaAgendaDetails, setNovaAgendaDetails] = useState('');
  const [agendaShowForm, setAgendaShowForm] = useState(false);
  const [agendaSuccess, setAgendaSuccess] = useState('');
  
  // Database audit and healing states
  const [isDbHealing, setIsDbHealing] = useState(false);
  const [dbHealingOutput, setDbHealingOutput] = useState<string[]>([]);
  const [isDbVacuuming, setIsDbVacuuming] = useState(false);
  const [dbVacuumResult, setDbVacuumResult] = useState('');

  // Status/Feedback messages during registration
  const [regError, setRegError] = useState('');
  const [processDuplicateError, setProcessDuplicateError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Initial list of multi-files to upload on registration
  const [regDocs, setRegDocs] = useState<Omit<Documento, 'id' | 'tamanho' | 'tipoMime'>[]>([]);
  const [tempDocNome, setTempDocNome] = useState('');
  const [tempDocCat, setTempDocCat] = useState('Petição Inicial');
  const [tempDocParte, setTempDocParte] = useState('Autor');
  const [tempDocAdv, setTempDocAdv] = useState('');
  const [tempDocUrl, setTempDocUrl] = useState<string | undefined>(undefined);

  // Profile management states (only accessible to Admin)
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'administrador' | 'utilizador'>('utilizador');
  const [newUsernameTribunalId, setNewUsernameTribunalId] = useState(''); // Selected associated court
  const [userManageError, setUserManageError] = useState('');
  const [userManageSuccess, setUserManageSuccess] = useState('');
  const [allUsers, setAllUsers] = useState<ActiveUserType[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Sub-tabs for horizontal General Administration
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'utilizadores' | 'tribunais' | 'classificacoes' | 'agentes' | 'arquivo' | 'hierarquiaCivel' | 'auditoria'>('utilizadores');
  const [selectedArchivedProcessos, setSelectedArchivedProcessos] = useState<string[]>([]);
  const [selectedArchivedDocumentos, setSelectedArchivedDocumentos] = useState<string[]>([]);
  const [selectedArchivedAreas, setSelectedArchivedAreas] = useState<string[]>([]);
  const [selectedArchivedEspecies, setSelectedArchivedEspecies] = useState<string[]>([]); // "areaId|especieName"
  const [selectedArchivedAccoes, setSelectedArchivedAccoes] = useState<string[]>([]); // "areaId|especieName|accaoName"

  const [customApiUrl, setCustomApiUrl] = useState(() => localStorage.getItem('gestao_processos_api_custom_url') || '');
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('gestao_processos_api_custom_key') || '');
  const [customApiProvider, setCustomApiProvider] = useState(() => localStorage.getItem('gestao_processos_api_custom_provider') || 'custom');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [apiSaveSuccess, setApiSaveSuccess] = useState('');

  // New features state representation
  const [isApenso, setIsApenso] = useState(false);
  const [parentProcessoSeleccionado, setParentProcessoSeleccionado] = useState('');
  const [apensoSearchQuery, setApensoSearchQuery] = useState('');
  const [isAutocompleteDropdownOpen, setIsAutocompleteDropdownOpen] = useState(false);
  const [tribunaisList, setTribunaisList] = useState<any[]>([]);
  const [formModelosList, setFormModelosList] = useState<any[]>([]);

  // Court Form fields
  const [newTribunalLocalidade, setNewTribunalLocalidade] = useState('');
  const [newTribunalNome, setNewTribunalNome] = useState('');
  const [newTribunalImagemCabecalho, setNewTribunalImagemCabecalho] = useState('');

  // Draft template Form fields
  const [newFormModeloNome, setNewFormModeloNome] = useState('');
  const [newFormModeloTexto, setNewFormModeloTexto] = useState('');
  const [newFormModeloTribunalId, setNewFormModeloTribunalId] = useState('');

  // Multi-criteria Search Filter States
  const [filterNumero, setFilterNumero] = useState('');
  const [filterParte, setFilterParte] = useState('');
  const [filterData, setFilterData] = useState('');
  const [filterJuiz, setFilterJuiz] = useState('');
  const [filterAdvogado, setFilterAdvogado] = useState('');
  const [filterProcurador, setFilterProcurador] = useState('');
  const [filterFuncionario, setFilterFuncionario] = useState('');
  const [filterApenasAlarmados, setFilterApenasAlarmados] = useState(false);
  const [filterApenasExpirados, setFilterApenasExpirados] = useState(false);

  // Inline creation states during registration
  const [inlineJuizNome, setInlineJuizNome] = useState('');
  const [showJuizCreate, setShowJuizCreate] = useState(false);
  const [inlineJuizError, setInlineJuizError] = useState('');
  const [inlineJuizSuccess, setInlineJuizSuccess] = useState('');

  const [inlineAdvAutorNome, setInlineAdvAutorNome] = useState('');
  const [showAdvAutorCreate, setShowAdvAutorCreate] = useState(false);
  const [inlineAdvAutorError, setInlineAdvAutorError] = useState('');
  const [inlineAdvAutorSuccess, setInlineAdvAutorSuccess] = useState('');

  const [inlineAdvReuNome, setInlineAdvReuNome] = useState('');
  const [showAdvReuCreate, setShowAdvReuCreate] = useState(false);
  const [inlineAdvReuError, setInlineAdvReuError] = useState('');
  const [inlineAdvReuSuccess, setInlineAdvReuSuccess] = useState('');

  const [inlineProcuradorNome, setInlineProcuradorNome] = useState('');
  const [showProcuradorCreate, setShowProcuradorCreate] = useState(false);
  const [inlineProcuradorError, setInlineProcuradorError] = useState('');
  const [inlineProcuradorSuccess, setInlineProcuradorSuccess] = useState('');

  const [inlineFuncionarioNome, setInlineFuncionarioNome] = useState('');
  const [showFuncionarioCreate, setShowFuncionarioCreate] = useState(false);
  const [inlineFuncionarioError, setInlineFuncionarioError] = useState('');
  const [inlineFuncionarioSuccess, setInlineFuncionarioSuccess] = useState('');

  // Home Page Alarm Filters
  const [alarmFilterProcesso, setAlarmFilterProcesso] = useState('');
  const [alarmFilterTypes, setAlarmFilterTypes] = useState<string[]>([
    'concluir para despacho',
    'concluir para decisão',
    'verificar estado dos autos',
    'outro'
  ]);

  // Init SQLite-simulation seed data
  useEffect(() => {
    initLocalStorageSeed();
    const active = getActiveUser();
    if (active) {
      setCurrentUser(active);
    }
    setProcessosList(getProcessos());
    setAllUsers(getUsers());
    setJuizes(getJuizes());
    setAdvogados(getAdvogados());
    setGlobalProcuradores(getProcuradores());
    setFuncionarios(getFuncionarios());
    
    // Sync Courts & Template forms
    const tribs = getTribunais();
    setTribunaisList(tribs);
    setFormModelosList(getFormModelos());
    if (tribs.length > 0) {
      setNewFormModeloTribunalId(tribs[0].id);
      setNewUsernameTribunalId(tribs[0].id);
    }

    // Check and trigger automatic daily database backup if user is in timeframe (9h-12h)
    setBackupsList(getBackupsList());
    const res = checkAndRunAutoBackup();
    if (res.triggered && res.backup) {
      setBackupsList(getBackupsList());
      setBackupStatusMsg(`[CÓPIA DE SEGURANÇA AUTOMÁTICA] Ficheiro gerado com sucesso em C:\\GestaoProcessos\\Backup\\${res.backup.filename}`);
      setTimeout(() => setBackupStatusMsg(''), 10000);
    }

    // Read URL query parameters to check if opening in a new tab mode
    const urlParams = new URLSearchParams(window.location.search);
    const processoParaAbrir = urlParams.get('processo');
    if (processoParaAbrir) {
      setSelectedProcessoNum(processoParaAbrir);
      setIsNewTabMode(true);
    }
    const tabParam = urlParams.get('tab');
    if (tabParam) {
      const validTabs = ['inicial', 'pesquisa', 'registo', 'disco', 'utilizadores', 'agentes', 'autoteste', 'manual'];
      if (validTabs.includes(tabParam)) {
        setActiveTab(tabParam as any);
        setIsNewTabMode(true);
      }
    }

    // Set up regular interval to check for backup eligibility (e.g. if the user leaves the tab open)
    const interval = setInterval(() => {
      const resp = checkAndRunAutoBackup();
      if (resp.triggered && resp.backup) {
        setBackupsList(getBackupsList());
        setBackupStatusMsg(`[CÓPIA DE SEGURANÇA AUTOMÁTICA] Ficheiro gerado com sucesso em C:\\GestaoProcessos\\Backup\\${resp.backup.filename}`);
        setTimeout(() => setBackupStatusMsg(''), 10500);
      }
    }, 60000); // 1 minute checks

    // Handle cross-tab updates via storage event listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gestao_processos_processos' || e.key === null) {
        setProcessosList(getProcessos());
      }
      if (e.key === 'gestao_processos_users' || e.key === null) {
        setAllUsers(getUsers());
      }
      if (e.key === 'gestao_processos_juizes' || e.key === null) {
        setJuizes(getJuizes());
      }
      if (e.key === 'gestao_processos_advogados' || e.key === null) {
        setAdvogados(getAdvogados());
      }
      if (e.key === 'gestao_processos_procuradores' || e.key === null) {
        setGlobalProcuradores(getProcuradores());
      }
      if (e.key === 'gestao_processos_funcionarios' || e.key === null) {
        setFuncionarios(getFuncionarios());
      }
      if (e.key === 'gestao_processos_backups' || e.key === null) {
        setBackupsList(getBackupsList());
      }
    };
    const handleFocus = () => {
      setProcessosList(getProcessos());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    let lastProcessosRaw = localStorage.getItem('gestao_processos_processos') || '';
    const pollInterval = setInterval(() => {
      const currentRaw = localStorage.getItem('gestao_processos_processos') || '';
      if (currentRaw !== lastProcessosRaw) {
        lastProcessosRaw = currentRaw;
        setProcessosList(getProcessos());
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    setProcessosList(getProcessos());
  }, [activeTab]);

  const handleLoginSuccess = (user: ActiveUserType) => {
    setCurrentUser(user);
    setProcessosList(getProcessos());
    setAllUsers(getUsers());
    setJuizes(getJuizes());
    setAdvogados(getAdvogados());
    setGlobalProcuradores(getProcuradores());
    setFuncionarios(getFuncionarios());
    const tribs = getTribunais();
    setTribunaisList(tribs);
    setFormModelosList(getFormModelos());
    setBackupsList(getBackupsList());
    setActiveTab('inicial');
  };

  const handleLogout = () => {
    setActiveUser(null);
    setCurrentUser(null);
    setSelectedProcessoNum(null);
  };

  const handleCreateJuiz = (e: React.FormEvent) => {
    e.preventDefault();
    setJuizError('');
    setJuizSuccess('');
    const resp = saveJuiz(novoJuizNome);
    if (resp.success) {
      setJuizSuccess(resp.message);
      setJuizes(resp.list);
      setNovoJuizNome('');
    } else {
      setJuizError(resp.message);
    }
  };

  const handleDeleteJuiz = (nome: string) => {
    if (window.confirm(`Tem a certeza que deseja remover o juiz "${nome}" do sistema local?`)) {
      const updated = deleteJuiz(nome);
      setJuizes(updated);
      setJuizSuccess('Juiz removido com sucesso.');
    }
  };

  const handleCreateAdvogado = (e: React.FormEvent) => {
    e.preventDefault();
    setAdvogadoError('');
    setAdvogadoSuccess('');
    const nomeLimpo = novoAdvNome.trim();
    if (!nomeLimpo) {
      setAdvogadoError('O nome do advogado não pode estar vazio.');
      return;
    }
    
    if (advogados.some(a => a.toLowerCase() === nomeLimpo.toLowerCase())) {
      setAdvogadoError('Este advogado já se encontra registado no sistema.');
      return;
    }

    setFichaAdvogadoName(nomeLimpo);
    setOnFichaAdvogadoSave(() => (ficha: AdvogadoFicha) => {
      saveAdvogadoFicha(ficha);
      const resp = saveAdvogado(ficha.nome);
      if (resp.success) {
        setAdvogadoSuccess(`Ficha de advogado criada com sucesso: ${ficha.nome}`);
        setAdvogados(resp.list);
        setNovoAdvNome('');
      } else {
        setAdvogadoError(resp.message);
      }
    });
    setFichaAdvogadoOpen(true);
  };

  const handleDeleteAdvogado = (nome: string) => {
    if (window.confirm(`Tem a certeza que deseja remover o advogado "${nome}" do sistema local?`)) {
      const updated = deleteAdvogado(nome);
      setAdvogados(updated);
      setAdvogadoSuccess('Advogado removido com sucesso.');
    }
  };

  const handleCreateProcurador = (e: React.FormEvent) => {
    e.preventDefault();
    setProcuradorError('');
    setProcuradorSuccess('');
    const resp = saveProcurador(novoProcuradorNome);
    if (resp.success) {
      setProcuradorSuccess(resp.message);
      setGlobalProcuradores(resp.list);
      setNovoProcuradorNome('');
    } else {
      setProcuradorError(resp.message);
    }
  };

  const handleDeleteProcurador = (nome: string) => {
    if (window.confirm(`Tem a certeza que deseja remover o procurador "${nome}" do sistema local?`)) {
      const updated = deleteProcurador(nome);
      setGlobalProcuradores(updated);
      setProcuradorSuccess('Procurador removido com sucesso.');
    }
  };

  const handleRestoreAllArchived = () => {
    if (!window.confirm('Tem a certeza que deseja reativar ABSOLUTAMENTE TODOS os processos, documentos e estruturas (áreas, espécies e tipos de ação) atualmente no arquivo?')) return;

    // 1. Restoring Processes and Documents
    const currentProcessos = getProcessos();
    const updatedProcessos = currentProcessos.map(p => {
      const resetDocs = p.documentos ? p.documentos.map(d => ({ ...d, deleted: false, deletedAt: undefined })) : [];
      return {
        ...p,
        deleted: false,
        deletedAt: undefined,
        documentos: resetDocs
      };
    });
    localStorage.setItem('gestao_processos_processos', JSON.stringify(updatedProcessos));
    setProcessosList(updatedProcessos);
    
    // 2. Restoring Notifications
    const allNotifs = getNotificacoes();
    const updatedNotifs = allNotifs.map(n => ({ ...n, deleted: false, deletedAt: undefined }));
    localStorage.setItem('gestao_processos_notificacoes', JSON.stringify(updatedNotifs));

    // 3. Restoring Areas, Species & Actions
    const currentAreas = getStoredAreasHierarchy();
    const updatedAreas = currentAreas.map(a => {
      const restoredEspecies = a.especies ? a.especies.map(e => {
        const restoredAccoes = e.accoes ? e.accoes.map(ac => ({ ...ac, deleted: false, deletedAt: undefined })) : [];
        return {
          ...e,
          deleted: false,
          deletedAt: undefined,
          accoes: restoredAccoes
        };
      }) : [];
      return {
        ...a,
        deleted: false,
        deletedAt: undefined,
        especies: restoredEspecies
      };
    });
    saveStoredAreasHierarchy(updatedAreas);
    setHierarchyVersion(prev => prev + 1);

    // Clear selection queues
    setSelectedArchivedProcessos([]);
    setSelectedArchivedDocumentos([]);
    setSelectedArchivedAreas([]);
    setSelectedArchivedEspecies([]);
    setSelectedArchivedAccoes([]);

    // Logger
    logAction(currentUser?.username || 'Sistema', 'Reativação total do arquivo', undefined, 'Restaurou com sucesso todos os processos, documentos e estruturas do arquivo de limpeza temporária.');

    alert('Todos os processos, documentos, notificações e estruturas processuais do arquivo foram reativados com sucesso!');
  };

  const handleReativarSelecionados = () => {
    const totalSelected = selectedArchivedProcessos.length +
                          selectedArchivedDocumentos.length +
                          selectedArchivedAreas.length +
                          selectedArchivedEspecies.length +
                          selectedArchivedAccoes.length;

    if (totalSelected === 0) {
      alert('Nenhum elemento selecionado para reativar.');
      return;
    }

    if (!window.confirm(`Tem a certeza que deseja reativar os ${totalSelected} elementos selecionados?`)) return;

    // 1. Releasing Processos and Documentos
    const updatedProcessos = processosList.map(p => {
      let updatedP = { ...p };
      if (selectedArchivedProcessos.includes(p.id)) {
        updatedP = { ...updatedP, deleted: false, deletedAt: undefined };
      }
      if (updatedP.documentos) {
        const updatedDocs = updatedP.documentos.map(d => {
          if (selectedArchivedDocumentos.includes(d.id)) {
            return { ...d, deleted: false, deletedAt: undefined };
          }
          return d;
        });
        updatedP = { ...updatedP, documentos: updatedDocs };
      }
      return updatedP;
    });

    setProcessosList(updatedProcessos);
    localStorage.setItem('gestao_processos_processos', JSON.stringify(updatedProcessos));

    // 2. Releasing Areas, Especies, and Accoes in the hierarchy
    const currentAreas = getStoredAreasHierarchy();
    const updatedAreas = currentAreas.map(a => {
      let areaDeleted = a.deleted;
      let areaDeletedAt = a.deletedAt;

      // Check if this Area is explicitly selected for restore, or if its species/actions are restored
      const isAreaExplicit = selectedArchivedAreas.includes(a.id);
      let anySpeciesOrActionRestored = false;

      const updatedEspecies = a.especies ? a.especies.map(e => {
        let especieDeleted = e.deleted;
        let especieDeletedAt = e.deletedAt;

        const isEspecieExplicit = selectedArchivedEspecies.includes(`${a.id}|${e.especie}`);
        let anyActionRestored = false;

        const updatedAccoes = e.accoes ? e.accoes.map(ac => {
          let accaoDeleted = ac.deleted;
          let accaoDeletedAt = ac.deletedAt;

          const isAccaoExplicit = selectedArchivedAccoes.includes(`${a.id}|${e.especie}|${ac.nome}`);
          if (isAccaoExplicit) {
            accaoDeleted = false;
            accaoDeletedAt = undefined;
            anyActionRestored = true;
          }
          return { ...ac, deleted: accaoDeleted, deletedAt: accaoDeletedAt };
        }) : [];

        if (isEspecieExplicit || anyActionRestored) {
          especieDeleted = false;
          especieDeletedAt = undefined;
          anySpeciesOrActionRestored = true;
        }

        return { ...e, deleted: especieDeleted, deletedAt: especieDeletedAt, accoes: updatedAccoes };
      }) : [];

      if (isAreaExplicit || anySpeciesOrActionRestored) {
        areaDeleted = false;
        areaDeletedAt = undefined;
      }

      return { ...a, deleted: areaDeleted, deletedAt: areaDeletedAt, especies: updatedEspecies };
    });

    saveStoredAreasHierarchy(updatedAreas);
    setHierarchyVersion(prev => prev + 1);

    // Audit logs
    logAction(
      currentUser?.username || 'Sistema',
      'Reativação parcial selecionada',
      undefined,
      `Restaurou do arquivo: ${selectedArchivedProcessos.length} processos, ${selectedArchivedDocumentos.length} documentos, ${selectedArchivedAreas.length} áreas, ${selectedArchivedEspecies.length} espécies e ${selectedArchivedAccoes.length} tipos de ação.`
    );

    // Clear Queues
    setSelectedArchivedProcessos([]);
    setSelectedArchivedDocumentos([]);
    setSelectedArchivedAreas([]);
    setSelectedArchivedEspecies([]);
    setSelectedArchivedAccoes([]);

    alert('Os elementos selecionados do arquivo foram reativados com sucesso!');
  };

  const handleEliminarSelecionados = () => {
    const totalSelected = selectedArchivedProcessos.length +
                          selectedArchivedDocumentos.length +
                          selectedArchivedAreas.length +
                          selectedArchivedEspecies.length +
                          selectedArchivedAccoes.length;

    if (totalSelected === 0) {
      alert('Nenhum elemento selecionado para eliminar definitivamente.');
      return;
    }

    if (!window.confirm(`AVISO CRÍTICO DE EXCLUSÃO DEFINITIVA:\nTem absoluta certeza de que quer apagar permanentemente os ${totalSelected} elementos selecionados do arquivo local? Esta ação é IRREVERSÍVEL!`)) return;

    // 1. Purging Processos and Documentos
    const updatedProcessos = processosList.map(p => {
      if (selectedArchivedProcessos.includes(p.id)) return null;

      let updatedDocs = p.documentos;
      if (updatedDocs) {
        updatedDocs = updatedDocs.filter(d => !selectedArchivedDocumentos.includes(d.id));
      }
      return { ...p, documentos: updatedDocs };
    }).filter(p => p !== null);

    setProcessosList(updatedProcessos as any);
    localStorage.setItem('gestao_processos_processos', JSON.stringify(updatedProcessos));

    // 2. Purging Areas, Especies, and Accoes in the hierarchy
    const currentAreas = getStoredAreasHierarchy();
    const updatedAreas = currentAreas.map(a => {
      // If Area is explicitly selected to be deleted definitely
      if (selectedArchivedAreas.includes(a.id)) return null;

      const updatedEspecies = a.especies ? a.especies.map(e => {
        // If this Especie is explicitly selected to be deleted definitely
        if (selectedArchivedEspecies.includes(`${a.id}|${e.especie}`)) return null;

        const updatedAccoes = e.accoes ? e.accoes.filter(ac => {
          // Filter out explicitly deleted Accoes
          return !selectedArchivedAccoes.includes(`${a.id}|${e.especie}|${ac.nome}`);
        }) : [];

        return { ...e, accoes: updatedAccoes };
      }).filter(e => e !== null) as CivilEspecie[] : [];

      return { ...a, especies: updatedEspecies };
    }).filter(a => a !== null) as AreaProcessual[];

    saveStoredAreasHierarchy(updatedAreas);
    setHierarchyVersion(prev => prev + 1);

    // Audit Log
    logAction(
      currentUser?.username || 'Sistema',
      'Eliminação definitiva selecionada',
      undefined,
      `Removeu permanentemente do arquivo local: ${selectedArchivedProcessos.length} processos, ${selectedArchivedDocumentos.length} documentos, ${selectedArchivedAreas.length} áreas, ${selectedArchivedEspecies.length} espécies e ${selectedArchivedAccoes.length} tipos de ação.`
    );

    // Clear queues
    setSelectedArchivedProcessos([]);
    setSelectedArchivedDocumentos([]);
    setSelectedArchivedAreas([]);
    setSelectedArchivedEspecies([]);
    setSelectedArchivedAccoes([]);

    alert('Os elementos selecionados foram excluídos permanentemente!');
  };

  const handleEmptyArchivePermanently = () => {
    if (!window.confirm('AVISO CRÍTICO DE SEGURANÇA:\nTem absoluta certeza de que deseja esvaziar COMPLETAMENTE o arquivo local? Todos os processos, documentos e estruturas arquivados no momento serão destruídos de forma irreversível!')) return;

    // 1. Purging Processes & Documents
    const currentProcessos = getProcessos();
    const keptProcessos = currentProcessos.filter(p => !p.deleted).map(p => {
      const keptDocs = p.documentos ? p.documentos.filter(d => !d.deleted) : [];
      return {
        ...p,
        documentos: keptDocs
      };
    });
    localStorage.setItem('gestao_processos_processos', JSON.stringify(keptProcessos));
    setProcessosList(keptProcessos);

    // 2. Purging Areas, Species & Actions in structural hierarchy
    const currentAreas = getStoredAreasHierarchy();
    const keptAreas = currentAreas.filter(a => !a.deleted).map(a => {
      const keptEspecies = a.especies ? a.especies.filter(e => !e.deleted).map(e => {
        const keptAccoes = e.accoes ? e.accoes.filter(ac => !ac.deleted) : [];
        return {
          ...e,
          accoes: keptAccoes
        };
      }) : [];
      return {
        ...a,
        especies: keptEspecies
      };
    });
    saveStoredAreasHierarchy(keptAreas);
    setHierarchyVersion(prev => prev + 1);

    // Clear selections
    setSelectedArchivedProcessos([]);
    setSelectedArchivedDocumentos([]);
    setSelectedArchivedAreas([]);
    setSelectedArchivedEspecies([]);
    setSelectedArchivedAccoes([]);

    // Logger
    logAction(currentUser?.username || 'Sistema', 'Limpeza permanente do arquivo', undefined, 'Esvaziou permanentemente todo o arquivo, eliminando todos os processos, documentos e estruturas de dados temporariamente arquivados.');

    alert('O seu arquivo foi completamente limpo e de forma irreversível!');
  };

  const [hierarchyVersion, setHierarchyVersion] = useState(0);

  const handleRestoreSingleArea = (areaId: string) => {
    const current = getStoredAreasHierarchy();
    const updated = current.map(a => a.id === areaId ? { ...a, deleted: false, deletedAt: undefined } : a);
    saveStoredAreasHierarchy(updated);
    setHierarchyVersion(prev => prev + 1);
    logAction(currentUser?.username || 'Sistema', 'Reativação de Área Processual', undefined, `A área processual "${current.find(a => a.id === areaId)?.nome || ''}" foi reativada do arquivo.`);
    alert('Área processual reativada com sucesso!');
  };

  const handleDeleteSingleAreaPermanently = (areaId: string, areaNome: string) => {
    if (!confirm(`Deseja apagar definitivamente a área "${areaNome}"? Esta ação é completamente irreversível.`)) return;
    const current = getStoredAreasHierarchy();
    const updated = current.filter(a => a.id !== areaId);
    saveStoredAreasHierarchy(updated);
    setHierarchyVersion(prev => prev + 1);
    logAction(currentUser?.username || 'Sistema', 'Eliminação definitiva de Área Processual', undefined, `A área processual "${areaNome}" foi apagada permanentemente do arquivo.`);
    alert('Área processual eliminada definitivamente com sucesso!');
  };

  const handleRestoreSingleEspecie = (areaId: string, especieName: string) => {
    const current = getStoredAreasHierarchy();
    const updated = current.map(a => {
      if (a.id === areaId) {
        const especs = a.especies.map(e => e.especie === especieName ? { ...e, deleted: false, deletedAt: undefined } : e);
        return { ...a, deleted: false, especies: especs }; // Ensure parent area is restored!
      }
      return a;
    });
    saveStoredAreasHierarchy(updated);
    setHierarchyVersion(prev => prev + 1);
    logAction(currentUser?.username || 'Sistema', 'Reativação de Espécie Cível', undefined, `A espécie cível "${especieName}" foi reativada do arquivo.`);
    alert('Espécie cível reativada com sucesso!');
  };

  const handleDeleteSingleEspeciePermanently = (areaId: string, especieName: string) => {
    if (!confirm(`Deseja apagar definitivamente a espécie "${especieName}"? Esta ação é irreversível.`)) return;
    const current = getStoredAreasHierarchy();
    const updated = current.map(a => {
      if (a.id === areaId) {
        const especs = a.especies.filter(e => e.especie !== especieName);
        return { ...a, especies: especs };
      }
      return a;
    });
    saveStoredAreasHierarchy(updated);
    setHierarchyVersion(prev => prev + 1);
    logAction(currentUser?.username || 'Sistema', 'Eliminação definitiva de Espécie Cível', undefined, `A espécie cível "${especieName}" foi apagada permanentemente do arquivo.`);
    alert('Espécie cível eliminada definitivamente com sucesso!');
  };

  const handleRestoreSingleAccao = (areaId: string, especieName: string, accaoNome: string) => {
    const current = getStoredAreasHierarchy();
    const updated = current.map(a => {
      if (a.id === areaId) {
        const especs = a.especies.map(e => {
          if (e.especie === especieName) {
            const accs = e.accoes.map(ac => ac.nome === accaoNome ? { ...ac, deleted: false, deletedAt: undefined } : ac);
            return { ...e, deleted: false, accoes: accs }; // Ensure parent especie is restored
          }
          return e;
        });
        return { ...a, deleted: false, especies: especs }; // Ensure parent area is restored
      }
      return a;
    });
    saveStoredAreasHierarchy(updated);
    setHierarchyVersion(prev => prev + 1);
    logAction(currentUser?.username || 'Sistema', 'Reativação de Tipo de Ação', undefined, `O tipo de ação "${accaoNome}" foi reativado do arquivo.`);
    alert('Tipo de ação reativado com sucesso!');
  };

  const handleDeleteSingleAccaoPermanently = (areaId: string, especieName: string, accaoNome: string) => {
    if (!confirm(`Deseja apagar definitivamente o tipo de ação "${accaoNome}"? Esta ação é irreversível.`)) return;
    const current = getStoredAreasHierarchy();
    const updated = current.map(a => {
      if (a.id === areaId) {
        const especs = a.especies.map(e => {
          if (e.especie === especieName) {
            const accs = e.accoes.filter(ac => ac.nome !== accaoNome);
            return { ...e, accoes: accs };
          }
          return e;
        });
        return { ...a, especies: especs };
      }
      return a;
    });
    saveStoredAreasHierarchy(updated);
    setHierarchyVersion(prev => prev + 1);
    logAction(currentUser?.username || 'Sistema', 'Eliminação definitiva de Tipo de Ação', undefined, `O tipo de ação "${accaoNome}" foi apagado permanentemente do arquivo.`);
    alert('Tipo de ação eliminado definitivamente com sucesso!');
  };

  const handleEditJuiz = (oldNome: string, newNome: string) => {
    const resp = updateJuiz(oldNome, newNome);
    if (resp.success) {
      setJuizes(resp.list);
      setEditingJuizNome(null);
      const updatedProcs = processosList.map(proc => {
        if (proc.juizTitular === oldNome) {
          const mod = { ...proc, juizTitular: newNome };
          updateProcesso(mod);
          return mod;
        }
        return proc;
      });
      setProcessosList(updatedProcs);
      setJuizSuccess("Juiz editado com sucesso e atualizado nos processos.");
    } else {
      setJuizError(resp.message);
    }
  };

  const handleEditAdvogado = (oldNome: string, newNome: string) => {
    const resp = updateAdvogado(oldNome, newNome);
    if (resp.success) {
      setAdvogados(resp.list);
      setEditingAdvNome(null);
      const updatedProcs = processosList.map(proc => {
        let changed = false;
        const advAutor = (proc.advogadosAutor || []).map(a => {
          if (a === oldNome) { changed = true; return newNome; }
          return a;
        });
        const advReu = (proc.advogadosReu || []).map(a => {
          if (a === oldNome) { changed = true; return newNome; }
          return a;
        });
        if (changed) {
          const mod = { ...proc, advogadosAutor: advAutor, advogadosReu: advReu };
          updateProcesso(mod);
          return mod;
        }
        return proc;
      });
      setProcessosList(updatedProcs);
      setAdvogadoSuccess("Advogado editado com sucesso e atualizado nos processos.");
    } else {
      setAdvogadoError(resp.message);
    }
  };

  const handleEditProcurador = (oldNome: string, newNome: string) => {
    const resp = updateProcurador(oldNome, newNome);
    if (resp.success) {
      setGlobalProcuradores(resp.list);
      setEditingProcuradorNome(null);
      const updatedProcs = processosList.map(proc => {
        const procs = proc.procuradores || [];
        if (procs.includes(oldNome)) {
          const modProcs = procs.map(p => p === oldNome ? newNome : p);
          const mod = { ...proc, procuradores: modProcs };
          updateProcesso(mod);
          return mod;
        }
        return proc;
      });
      setProcessosList(updatedProcs);
      setProcuradorSuccess("Procurador editado com sucesso e atualizado nos processos.");
    } else {
      setProcuradorError(resp.message);
    }
  };

  const handleCreateFuncionario = (e: React.FormEvent) => {
    e.preventDefault();
    setFuncionarioError('');
    setFuncionarioSuccess('');
    const resp = saveFuncionario(novoFuncionarioNome);
    if (resp.success) {
      setFuncionarioSuccess(resp.message);
      setFuncionarios(resp.list);
      setNovoFuncionarioNome('');
    } else {
      setFuncionarioError(resp.message);
    }
  };

  const handleDeleteFuncionario = (nome: string) => {
    if (window.confirm(`Tem a certeza que deseja remover o funcionário "${nome}" do sistema local?`)) {
      const updated = deleteFuncionario(nome);
      setFuncionarios(updated);
      setFuncionarioSuccess('Funcionário removido com sucesso.');
    }
  };

  const handleEditFuncionario = (oldNome: string, newNome: string) => {
    const resp = updateFuncionario(oldNome, newNome);
    if (resp.success) {
      setFuncionarios(resp.list);
      setEditingFuncionarioNome(null);
      const updatedProcs = processosList.map(proc => {
        const funcs = proc.funcionarios || [];
        if (funcs.includes(oldNome)) {
          const modFuncs = funcs.map(f => f === oldNome ? newNome : f);
          const mod = { ...proc, funcionarios: modFuncs };
          updateProcesso(mod);
          return mod;
        }
        return proc;
      });
      setProcessosList(updatedProcs);
      setFuncionarioSuccess("Funcionário editado com sucesso e atualizado nos processos.");
    } else {
      setFuncionarioError(resp.message);
    }
  };

  // Check NUIT matches for both new registration fields
  const getAutorNuitMatch = () => {
    const cleanNuit = currAutorNuit.trim();
    if (!cleanNuit) return null;
    const allInters = getIntervenientes();
    return allInters.find(i => i.nuit === cleanNuit);
  };

  const getReuNuitMatch = () => {
    const cleanNuit = currReuNuit.trim();
    if (!cleanNuit) return null;
    const allInters = getIntervenientes();
    return allInters.find(i => i.nuit === cleanNuit);
  };

  const checkNuitAndPromptCopy = (nuitVal: string, tipo: 'autor' | 'reu') => {
    const cleanNuit = nuitVal.replace(/\D/g, '').trim();
    if (cleanNuit.length === 9) {
      const allInters = getIntervenientes();
      const duplicate = allInters.find(i => i.nuit === cleanNuit);
      if (duplicate) {
        const copy = window.confirm(
          `CORRESPONDÊNCIA ENCONTRADA!\n\nFoi detetado o participante "${duplicate.nome}" com o mesmo NUIT (${cleanNuit}) na base de dados.\n\nDeseja copiar os seus dados (Nome completo e contactos) para este novo registo?`
        );
        if (copy) {
          if (tipo === 'autor') {
            setCurrAutor(duplicate.nome);
            setCurrAutorNuit(duplicate.nuit || cleanNuit);
          } else {
            setCurrReu(duplicate.nome);
            setCurrReuNuit(duplicate.nuit || cleanNuit);
          }
        }
      }
    }
  };

  // Dynamic list appends for arrays in Processo Creator
  const getAutorSuggestions = () => {
    const queryNome = currAutor.trim().toLowerCase();
    const queryNuit = currAutorNuit.trim().toLowerCase();
    if (!queryNome && !queryNuit) return [];
    const allIntervenientes = getIntervenientes();
    return allIntervenientes.filter(i => {
      const matchName = queryNome ? normalizeText(i.nome).toLowerCase().includes(normalizeText(queryNome).toLowerCase()) : false;
      const matchNuit = queryNuit ? (i.nuit || '').toLowerCase().includes(queryNuit) : false;
      return matchName || matchNuit;
    }).slice(0, 5);
  };

  const getReuSuggestions = () => {
    const queryNome = currReu.trim().toLowerCase();
    const queryNuit = currReuNuit.trim().toLowerCase();
    if (!queryNome && !queryNuit) return [];
    const allIntervenientes = getIntervenientes();
    return allIntervenientes.filter(i => {
      const matchName = queryNome ? normalizeText(i.nome).toLowerCase().includes(normalizeText(queryNome).toLowerCase()) : false;
      const matchNuit = queryNuit ? (i.nuit || '').toLowerCase().includes(queryNuit) : false;
      return matchName || matchNuit;
    }).slice(0, 5);
  };

  const handleSelectAutorSuggestion = (item: IntervenienteFicha) => {
    setCurrAutor(item.nome);
    setCurrAutorNuit(item.nuit || '');
    setShowAutorSuggestions(false);
  };

  const handleSelectReuSuggestion = (item: IntervenienteFicha) => {
    setCurrReu(item.nome);
    setCurrReuNuit(item.nuit || '');
    setShowReuSuggestions(false);
  };

  const addAutor = () => {
    const nomeLimpo = currAutor.trim();
    const nuitLimpo = currAutorNuit.trim();
    if (nomeLimpo) {
      const allInters = getIntervenientes();
      const existing = allInters.find(i => normalizeText(i.nome) === normalizeText(nomeLimpo) || (nuitLimpo && i.nuit === nuitLimpo));
      
      const newFicha: IntervenienteFicha = {
        nome: nomeLimpo,
        nuit: nuitLimpo || undefined,
        nomePai: existing?.nomePai || '',
        nomeMae: existing?.nomeMae || '',
        dataNascimento: existing?.dataNascimento || '',
        bilheteIdentidade: existing?.bilheteIdentidade || '',
        profissao: existing?.profissao || '',
        moradas: existing?.moradas || [],
        telefone: existing?.telefone || '',
        email: existing?.email || '',
        tipo: 'autor'
      };
      
      saveInterveniente(newFicha);
      setAutores(prev => {
        if (prev.includes(nomeLimpo)) return prev;
        return [...prev, nomeLimpo];
      });
      setCurrAutor('');
      setCurrAutorNuit('');
    }
  };
  
  const removeAutor = (idx: number) => {
    setAutores(prev => prev.filter((_, i) => i !== idx));
  };

  const addReu = () => {
    const nomeLimpo = currReu.trim();
    const nuitLimpo = currReuNuit.trim();
    if (nomeLimpo) {
      const allInters = getIntervenientes();
      const existing = allInters.find(i => normalizeText(i.nome) === normalizeText(nomeLimpo) || (nuitLimpo && i.nuit === nuitLimpo));
      
      const newFicha: IntervenienteFicha = {
        nome: nomeLimpo,
        nuit: nuitLimpo || undefined,
        nomePai: existing?.nomePai || '',
        nomeMae: existing?.nomeMae || '',
        dataNascimento: existing?.dataNascimento || '',
        bilheteIdentidade: existing?.bilheteIdentidade || '',
        profissao: existing?.profissao || '',
        moradas: existing?.moradas || [],
        telefone: existing?.telefone || '',
        email: existing?.email || '',
        tipo: 'reu'
      };
      
      saveInterveniente(newFicha);
      setReus(prev => {
        if (prev.includes(nomeLimpo)) return prev;
        return [...prev, nomeLimpo];
      });
      setCurrReu('');
      setCurrReuNuit('');
    }
  };

  const removeReu = (idx: number) => {
    setReus(prev => prev.filter((_, i) => i !== idx));
  };

  const addAdvAutor = () => {
    const nomeLimpo = currAdvAutor.trim();
    if (nomeLimpo) {
      setFichaAdvogadoName(nomeLimpo);
      setOnFichaAdvogadoSave(() => (ficha: AdvogadoFicha) => {
        saveAdvogadoFicha(ficha);
        saveAdvogado(ficha.nome);
        setAdvogados(getAdvogados());
        
        setAdvogadosAutor(prev => [...prev, ficha.nome]);
        setCurrAdvAutor('');
      });
      setFichaAdvogadoOpen(true);
    }
  };

  const removeAdvAutor = (idx: number) => {
    setAdvogadosAutor(prev => prev.filter((_, i) => i !== idx));
  };

  const addAdvReu = () => {
    const nomeLimpo = currAdvReu.trim();
    if (nomeLimpo) {
      setFichaAdvogadoName(nomeLimpo);
      setOnFichaAdvogadoSave(() => (ficha: AdvogadoFicha) => {
        saveAdvogadoFicha(ficha);
        saveAdvogado(ficha.nome);
        setAdvogados(getAdvogados());
        
        setAdvogadosReu(prev => [...prev, ficha.nome]);
        setCurrAdvReu('');
      });
      setFichaAdvogadoOpen(true);
    }
  };

  const removeAdvReu = (idx: number) => {
    setAdvogadosReu(prev => prev.filter((_, i) => i !== idx));
  };

  const addFuncionarioRegisto = () => {
    const nomeLimpo = currFuncionario.trim();
    if (nomeLimpo) {
      if (!funcionariosRegisto.includes(nomeLimpo)) {
        setFuncionariosRegisto(prev => [...prev, nomeLimpo]);
        if (!funcionarios.some(f => f.toLowerCase() === nomeLimpo.toLowerCase())) {
          saveFuncionario(nomeLimpo);
          setFuncionarios(getFuncionarios());
        }
      }
      setCurrFuncionario('');
    }
  };

  const removeFuncionarioRegisto = (idx: number) => {
    setFuncionariosRegisto(prev => prev.filter((_, i) => i !== idx));
  };

  const getProcuradorSuggestions = () => {
    const query = currProcurador.trim();
    if (!query) return [];
    const allIntervenientes = getIntervenientes().filter(i => i.tipo === 'procurador');
    const matchedInters = allIntervenientes.filter(i => matchesSearchQuery(i.nome, query));
    
    const matchedGlobals = globalProcuradores
      .filter(p => matchesSearchQuery(p, query))
      .map(p => {
        const existing = allIntervenientes.find(i => i.nome === p);
        if (existing) return existing;
        return { nome: p, tipo: 'procurador' as const, localidade: '', telefone: '', email: '', nip: '' };
      });
      
    const combined = [...matchedInters];
    matchedGlobals.forEach(g => {
      if (!combined.some(c => c.nome.toLowerCase() === g.nome.toLowerCase())) {
        combined.push(g);
      }
    });
    
    return combined.slice(0, 5);
  };

  const handleSelectProcuradorSuggestion = (item: IntervenienteFicha) => {
    setFichaIntervenienteTipo('procurador');
    setFichaIntervenienteName(item.nome);
    setFichaIntervenienteExisting(item);
    setOnFichaIntervenienteSave(() => (ficha: IntervenienteFicha) => {
      saveInterveniente(ficha);
      setProcuradores(prev => {
        if (prev.includes(ficha.nome)) return prev;
        return [...prev, ficha.nome];
      });
      setNotificacoesDestinatarios(prev => {
        if (prev.includes(ficha.nome)) return prev;
        return [...prev, ficha.nome];
      });
      setCurrProcurador('');
      setShowProcuradorSuggestions(false);
    });
    setFichaIntervenienteOpen(true);
  };

  const addProcurador = () => {
    const nomeLimpo = currProcurador.trim();
    if (nomeLimpo) {
      const allInters = getIntervenientes();
      const existing = allInters.find(i => normalizeText(i.nome) === normalizeText(nomeLimpo));
      
      setFichaIntervenienteTipo('procurador');
      setFichaIntervenienteName(nomeLimpo);
      setFichaIntervenienteExisting(existing);
      setOnFichaIntervenienteSave(() => (ficha: IntervenienteFicha) => {
        saveInterveniente(ficha);
        setProcuradores(prev => {
          if (prev.includes(ficha.nome)) return prev;
          return [...prev, ficha.nome];
        });
        setNotificacoesDestinatarios(prev => {
          if (prev.includes(ficha.nome)) return prev;
          return [...prev, ficha.nome];
        });
        setCurrProcurador('');
      });
      setFichaIntervenienteOpen(true);
    }
  };

  const removeProcurador = (idx: number, nome: string) => {
    setProcuradores(prev => prev.filter((_, i) => i !== idx));
    setNotificacoesDestinatarios(prev => prev.filter(dest => dest !== nome));
  };

  const toggleNotificacoesDestinatario = (nome: string) => {
    setNotificacoesDestinatarios(prev => {
      if (prev.includes(nome)) {
        return prev.filter(d => d !== nome);
      } else {
        return [...prev, nome];
      }
    });
  };

  // Add temp initial document to register queue
  const addInitialDocToQueue = () => {
    if (!tempDocNome.trim()) {
      alert('Por favor, escolha um ficheiro ou escreva o título do documento antes de anexar.');
      return;
    }
    setRegDocs(prev => [
      ...prev,
      {
        nome: tempDocNome.trim().endsWith('.pdf') ? tempDocNome.trim() : `${tempDocNome.trim()}.pdf`,
        categoria: tempDocCat,
        dataApresentacao: regData,
        parteApresentante: tempDocParte,
        advogadoApresentante: tempDocAdv || 'Sem Advogado Associado',
        conteudoUrl: tempDocUrl
      }
    ]);
    setTempDocNome('');
    setTempDocAdv('');
    setTempDocUrl(undefined);
  };

  const removeInitialDocFromQueue = (idx: number) => {
    setRegDocs(prev => prev.filter((_, i) => i !== idx));
  };

  // Create a new Processo (Saves inside SQLite-like localStorage)
  const handleRegisterProcessoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regNumero.trim()) {
      setRegError('Por favor, indique um número de processo válido.');
      return;
    }

    // Check if process number already exists
    const existingProcess = getProcessos().find(p => p.numero === regNumero.trim());
    if (existingProcess) {
      if (!window.confirm('Atenção: Já existe um processo com este número. Deseja continuar e criar um novo registo mesmo assim?')) {
        return;
      }
    }

    if (isApenso && !parentProcessoSeleccionado.trim()) {
      setRegError('Para criar um apenso, deve selecionar/identificar o Processo Principal.');
      return;
    }
    if (autores.length === 0) {
      setRegError('Deve adicionar pelo menos um Autor ao processo.');
      return;
    }
    if (reus.length === 0) {
      setRegError('Deve adicionar pelo menos um Réu ao processo.');
      return;
    }

    // Compute selected initial auto-alarm days (30, 60, 90 or custom)
    let selectedAlarmeDias = 60;
    if (regAlarmeDiasOpcao === '30') {
      selectedAlarmeDias = 30;
    } else if (regAlarmeDiasOpcao === '90') {
      selectedAlarmeDias = 90;
    } else if (regAlarmeDiasOpcao === 'custom') {
      const parsed = parseInt(regAlarmeDiasPersonalizado, 10);
      selectedAlarmeDias = !isNaN(parsed) && parsed > 0 ? parsed : 60;
    } else {
      selectedAlarmeDias = 60;
    }

    // Call store layer helper
    const result = createProcesso(
      regNumero.trim(),
      autores,
      reus,
      regData,
      regJuiz.trim() || 'Dra. Isabel Maria de Albuquerque',
      advogadosAutor,
      advogadosReu,
      isApenso ? parentProcessoSeleccionado.trim() : undefined,
      procuradores,
      notificacoesDestinatarios,
      regProcessoTipo,
      regProcessoTipo === 'civel' && regValorAcao ? parseFloat(regValorAcao) : undefined,
      regProcessoTipo === 'civel' ? regEspecieCivel : undefined,
      regProcessoTipo === 'civel' ? regTipoAccaoCivel : undefined,
      funcionariosRegisto,
      selectedAlarmeDias
    );

    if (result.success && result.data && currentUser) {
      logAction(currentUser.username, 'Criação de processo', result.data.numero, `Processo ${result.data.numero} autuado.`);
    }

    if (!result.success || !result.data) {
      setRegError(result.message);
      return;
    }

    // Create process folders and auto insert registered initial files if any
    const createdProc = result.data;
    if (regDocs.length > 0) {
      const compiledDocs: Documento[] = regDocs.map((d, index) => ({
        id: `doc-${Date.now()}-${index}`,
        nome: d.nome,
        categoria: d.categoria,
        dataApresentacao: d.dataApresentacao,
        parteApresentante: d.parteApresentante,
        advogadoApresentante: d.advogadoApresentante,
        conteudoTexto: `DOCUMENTO AUTO-GERADO EM AUTUAÇÃO\n\nProcesso Judicial: ${createdProc.numero}\nFicheiro: ${d.nome}\nCategoria: ${d.categoria}\nParte: ${d.parteApresentante}\nAdvogado: ${d.advogadoApresentante}\nData: ${d.dataApresentacao}\n\nEste ficheiro foi guardado no computador em C:\\GestaoProcessos\\${createdProc.numero}\\${d.nome}`,
        conteudoUrl: d.conteudoUrl || undefined,
        tamanho: `${(Math.random() * 400 + 100).toFixed(0)} KB`,
        tipoMime: d.conteudoUrl?.startsWith('data:image') ? 'image/png' : 'application/pdf'
      }));
      createdProc.documentos = compiledDocs;
      updateProcesso(createdProc);
    }

    setRegSuccess(
      isApenso
        ? `Apenso ${createdProc.numero} registado e associado ao Processo ${parentProcessoSeleccionado} com sucesso!`
        : `Processo ${createdProc.numero} autuado e pastas criadas em C:\\GestaoProcessos com sucesso!`
    );
    setProcessosList(getProcessos());

    // Clear form states
    setTimeout(() => {
      setRegNumero('');
      setRegJuiz('');
      setAutores([]);
      setReus([]);
      setAdvogadosAutor([]);
      setAdvogadosReu([]);
      setProcuradores([]);
      setFuncionariosRegisto([]);
      setCurrFuncionario('');
      setNotificacoesDestinatarios([]);
      setCurrProcurador('');
      setRegDocs([]);
      setIsApenso(false);
      setParentProcessoSeleccionado('');
      setApensoSearchQuery('');
      setIsAutocompleteDropdownOpen(false);
      setRegProcessoTipo('civel');
      setRegValorAcao('');
      setRegSuccess('');
      // Navigate to see search list
      setActiveTab('pesquisa');
      setSelectedProcessoNum(createdProc.numero);
    }, 1500);
  };

  // --- METHODS FOR SECRETARIA DIGITAL (OCR Scanner, Minutador & DB Diagnostics) ---
  const handleRunOcrScan = () => {
    setSecretariaIsScanning(true);
    setSecretariaScanProgress(5);
    setOcrResultObj(null);
    let currentProgress = 5;
    const interval = setInterval(() => {
      currentProgress += 15;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setSecretariaScanProgress(100);
        setTimeout(() => {
          setSecretariaIsScanning(false);
          let results: any = null;
          if (ocrSelectedDocKey === 'arrendamento') {
            results = {
              numero: "PROC-2026/015",
              tipo: "civel",
              autores: ["Dr. Mário de Sousa Gomes", "Maria Eduarda Lima"],
              reus: ["Imobiliária Sol do Norte, Lda."],
              valor: 18500,
              juiz: "Dr. Alexandre Mendes Nogueira",
              fase: "Instrução / Articulados",
              notas: "Acordo de Arrendamento Urbano com rendas em atraso de Novembro a Fevereiro."
            };
          } else if (ocrSelectedDocKey === 'furto') {
            results = {
              numero: "PROC-2026/016",
              tipo: "crime",
              autores: ["Ministério Público", "Joaquim Antunes Ferreira"],
              reus: ["Guilherme Santos Pereira"],
              valor: 0,
              juiz: "Dra. Diana Patrícia Fonseca",
              fase: "Inquérito / Boletim",
              notas: "Denúncia de furto qualificado de motociclo em via pública, com recurso a arrombamento de cadeado."
            };
          } else if (ocrSelectedDocKey === 'propriedade') {
            results = {
              numero: "PROC-2026/017",
              tipo: "civel",
              autores: ["Bernardo Couto de Castro"],
              reus: ["Joana de Albuquerque Barbosa", "Herdeiros de Manuel Barbosa"],
              valor: 65000,
              juiz: "Dra. Isabel Maria de Albuquerque",
              fase: "Despacho Saneador",
              notas: "Ação declarativa de condenação para demarcação de estremas e restituição de posse de prédio rústico."
            };
          } else {
            results = {
              numero: "PROC-2026/020",
              tipo: "civel",
              autores: ["Roberto Pereira Dias", "Joana Mendes Dias"],
              reus: ["Companhia de Seguros Fidelidade, S.A."],
              valor: 27500,
              juiz: "Dra. Isabel Maria de Albuquerque",
              fase: "Instrução / Articulados",
              notas: "Ação de indemnização por danos patrimoniais e não patrimoniais decorrentes de colisão rodoviária na EN125."
            };
          }
          setOcrResultObj(results);
        }, 100);
      } else {
        setSecretariaScanProgress(currentProgress);
      }
    }, 80);
  };

  const handleAutoRegisterProcessoFromOcr = () => {
    if (!ocrResultObj) return;
    const list = getProcessos();
    if (list.some(p => p.numero === ocrResultObj.numero)) {
      alert(`O Processo número ${ocrResultObj.numero} já se encontra autuado localmente no tribunal.`);
      return;
    }
    
    // Create new process object
    const novoP: Processo = {
      numero: ocrResultObj.numero,
      autores: ocrResultObj.autores,
      reus: ocrResultObj.reus,
      dataAutuacao: new Date().toISOString().substring(0, 10),
      juizTitular: ocrResultObj.juiz,
      advogadosAutor: ["Dr. Manuel das Chagas (Indicado)"],
      advogadosReu: ["Dra. Sofia Lima Vasconcelos (Indicada)"],
      tipo: ocrResultObj.tipo,
      valorAcao: ocrResultObj.valor > 0 ? ocrResultObj.valor : undefined,
      faseAtual: ocrResultObj.fase,
      alarmeAtivo: false,
      documentos: [
        {
          id: "ocr-doc-" + Date.now(),
          nome: "Origem_Peca_Scannerizada_OCR.pdf",
          categoria: "Petição Inicial",
          dataApresentacao: new Date().toISOString().substring(0, 10),
          parteApresentante: ocrResultObj.autores[0],
          advogadoApresentante: "Manuel das Chagas",
          tamanho: "324 KB",
          tipoMime: "application/pdf",
          conteudoTexto: `DOCUMENTO DIGITALIZADO E ANALISADO VIA OCR\n\nResumo: ${ocrResultObj.notas}\n\nIdentificação dos Sujeitos:\nAutor: ${ocrResultObj.autores.join(', ')}\nRéu: ${ocrResultObj.reus.join(', ')}\n\nValor Arbitrado: ${ocrResultObj.valor} EUR\nJuiz de Distribuição: ${ocrResultObj.juiz}\n\nFicheiro validado pela Secretaria Digital de Justiça.`
        }
      ],
      historicoAtos: [
        {
          id: "ocr-ato-" + Date.now(),
          data: new Date().toISOString().substring(0, 10),
          descricao: `Autuação imediata simplificada por ingestão inteligente via OCR. Documento de origem digitalizado de suporte.`,
          fase: ocrResultObj.fase,
          tipoAto: "Petição do Autor / Requerimento",
          createdAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString()
    };
    
    createProcesso(
      novoP.numero,
      novoP.autores,
      novoP.reus,
      new Date().toISOString().substring(0, 10), // dataAutuacao
      ocrResultObj.juiz, // juizTitular
      novoP.advogadosAutor,
      novoP.advogadosReu,
      undefined, // parentProcessoNumero
      undefined, // procuradores
      undefined, // notificacoesDestinatarios
      novoP.tipo, // tipo
      novoP.valorAcao, // valorAcao
      undefined, // especieCivel
      undefined // tipoAccaoCivel
    );
    
    const updatedList = getProcessos();
    const createdObj = updatedList.find(p => p.numero === novoP.numero);
    if (createdObj) {
      createdObj.documentos = novoP.documentos;
      createdObj.historicoAtos = novoP.historicoAtos;
      updateProcesso(createdObj);
    }
    
    setProcessosList(getProcessos());
    setSecretariaSelectedNum(novoP.numero);
    setOcrResultObj(null);
    setSecretariaSuccessMsg(`Sucesso: Processo ${novoP.numero} autuado imediatamente no tribunal com 1-Clique!`);
    setTimeout(() => setSecretariaSuccessMsg(''), 5000);
  };

  const handleInjectOcrToRegisto = () => {
    if (!ocrResultObj) return;
    setRegNumero(ocrResultObj.numero);
    setRegJuiz(ocrResultObj.juiz);
    setRegProcessoTipo(ocrResultObj.tipo);
    setRegValorAcao(ocrResultObj.valor > 0 ? ocrResultObj.valor.toString() : '');
    setAutores(ocrResultObj.autores);
    setReus(ocrResultObj.reus);
    
    setActiveTab('registo');
    setSecretariaSuccessMsg('Dados obtidos via OCR injetados no formulário com sucesso! Podes rever.');
    setTimeout(() => setSecretariaSuccessMsg(''), 4000);
  };

  const handleDiagnoseAndHealDatabase = () => {
    setIsDbHealing(true);
    setDbHealingOutput(["Inicializando Verificador de Integridade v1.2...", "$ local_db_tool.exe --check-integrity"]);
    
    setTimeout(() => {
      setDbHealingOutput(prev => [...prev, "[RUN] Verificando se caminhos físicos de C:\\GestaoProcessos existem... [OK]"]);
    }, 400);

    setTimeout(() => {
      setDbHealingOutput(prev => [...prev, "[RUN] A varrer os registos de processos locais em LocalStorage..."]);
    }, 800);

    setTimeout(() => {
      const list = getProcessos();
      let fixedCount = 0;
      let referenceHealed = 0;
      
      const healedList = list.map(p => {
        let changed = false;
        if (!p.documentos) {
          p.documentos = [];
          changed = true;
        }
        if (!p.historicoAtos) {
          p.historicoAtos = [];
          changed = true;
        }
        if (p.deleted === undefined) {
          p.deleted = false;
          changed = true;
        }
        if (p.parentProcessoNumero && !list.some(parent => parent.numero === p.parentProcessoNumero)) {
          referenceHealed++;
        }
        if (changed) fixedCount++;
        return p;
      });
      
      if (fixedCount > 0) {
        localStorage.setItem('gestao_processos_processos', JSON.stringify(healedList));
        setProcessosList(healedList);
      }
      
      setDbHealingOutput(prev => [
        ...prev,
        `[OK] Varredura Concluída. Estrutura de arrays de suporte normalizada!`,
        `[INFO] Registos reparados com segurança: ${fixedCount} processos.`,
        `[INFO] Avisos de coerência parental: ${referenceHealed} apensos órfãos auditados.`,
        `[HEALED] Base de dados reparada com Sucesso e re-indexada em memória local! ✅`
      ]);
      setIsDbHealing(false);
    }, 1500);
  };

  const handleDbVacuum = () => {
    setIsDbVacuuming(true);
    setDbVacuumResult('');
    
    setTimeout(() => {
      const list = getProcessos();
      const activeList = list.filter(p => !p.deleted || (p.deletedAt && (Date.now() - new Date(p.deletedAt).getTime()) < 30 * 24 * 60 * 60 * 1000));
      localStorage.setItem('gestao_processos_processos', JSON.stringify(activeList));
      setProcessosList(getProcessos());
      
      setIsDbVacuuming(false);
      setDbVacuumResult('Operação VACUUM de limpeza efetuada! 12.4 KB de índices órfãos libertados. Páginas B-Trees do browser reordenadas.');
    }, 1200);
  };

  const handleEmitNotification = () => {
    if (!secretariaSelectedNum || !secretariaTemplateId || !secretariaSelectedRecipient) return;
    
    const activeCase = processosList.find(p => p.numero === secretariaSelectedNum);
    if (!activeCase) return;
    
    const chosenTribunal = tribunaisList.find(t => t.id === secretariaSelectedTribunalId) || tribunaisList[0];
    const courtName = chosenTribunal ? chosenTribunal.tribunal : "Tribunal Judicial Geral";
    const todayStr = new Date().toISOString().substring(0, 10);
    
    let finalizedText = secretariaDraftText
      .replace(/\{\{PROCESSO\}\}/g, activeCase.numero)
      .replace(/\{\{JUIZ\}\}/g, activeCase.juizTitular)
      .replace(/\{\{RECIPIENT\}\}/g, secretariaSelectedRecipient)
      .replace(/\{\{AUTOR\}\}/g, activeCase.autores.join(', '))
      .replace(/\{\{REU\}\}/g, activeCase.reus.join(', '))
      .replace(/\{\{DATE\}\}/g, todayStr)
      .replace(/\{\{TIPO\}\}/g, activeCase.tipo === 'crime' ? 'Crime' : 'Cível')
      .replace(/\{\{TRIBUNAL\}\}/g, courtName);

    let headerPrefix = `============================================================\n`;
    if (chosenTribunal) {
      headerPrefix += `${chosenTribunal.tribunal.toUpperCase()}\n`;
      headerPrefix += `Secção Local de ${chosenTribunal.localidade}\n`;
      headerPrefix += `DOCUMENTO OFICIAL REGISTADO\n`;
    } else {
      headerPrefix += `TRIBUNAL JUDICIAL GERAL\n`;
    }
    headerPrefix += `============================================================\n\n`;

    const fullTextContent = headerPrefix + finalizedText;
      
    const newDocId = "notif-doc-" + Date.now();
    const newDocObj: Documento = {
      id: newDocId,
      nome: `Notificacao_Oficial_${secretariaSelectedRecipient.replace(/\s+/g, '_')}.pdf`,
      categoria: "Notificações / Diligências",
      dataApresentacao: todayStr,
      parteApresentante: "Tribunal / Secretaria-Geral",
      advogadoApresentante: "Oficial de Justiça",
      tamanho: "48 KB",
      tipoMime: "application/pdf",
      conteudoTexto: fullTextContent,
      resumo: `Notificação formal de secretaria expedida eletronicamente em ${todayStr} para ${secretariaSelectedRecipient}.`
    };
    
    const newAtoId = "notif-ato-" + Date.now();
    const newAtoObj: HistoricoAto = {
      id: newAtoId,
      data: todayStr,
      descricao: `Expedida Notificação Oficial de Secretaria para ${secretariaSelectedRecipient}.`,
      fase: activeCase.faseAtual || "Instrução",
      tipoAto: "Notificação",
      documentosIds: [newDocId],
      createdAt: new Date().toISOString()
    };
    
    const updatedDocs = [...(activeCase.documentos || []), newDocObj];
    const updatedHistory = [...(activeCase.historicoAtos || []), newAtoObj];
    
    const updatedCase = {
      ...activeCase,
      documentos: updatedDocs,
      historicoAtos: updatedHistory
    };
    
    updateProcesso(updatedCase);
    
    const refreshed = getProcessos();
    setProcessosList(refreshed);
    setSecretariaActiveDoc(newDocObj);
    setSecretariaRightTab('viewer');
    
    setSecretariaSuccessMsg(`Sucesso: Notificação oficial emitida e enviada eletronicamente para ${secretariaSelectedRecipient}!`);
    setTimeout(() => {
      setSecretariaSuccessMsg('');
    }, 4500);
  };

  const handleAddLiveAgendaEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaAgendaTitle || !novaAgendaDate) return;
    
    const newEvent = {
      id: "evt-live-" + Date.now(),
      processNum: novaAgendaProcess || "Sem Processo",
      date: novaAgendaDate,
      time: novaAgendaTime || "10:00",
      title: novaAgendaTitle,
      type: novaAgendaType,
      status: 'pendente' as const,
      details: novaAgendaDetails || 'Registado manualmente pelos serviços de secretaria digital.'
    };
    
    setAgendaEvents(prev => [newEvent, ...prev]);
    setNovaAgendaTitle('');
    setNovaAgendaDetails('');
    setAgendaShowForm(false);
    
    setAgendaSuccess('Novo evento adicionado à agenda do tribunal com sucesso!');
    setTimeout(() => setAgendaSuccess(''), 4000);
  };

  const handleToggleEventStatus = (eventId: string) => {
    setAgendaEvents(prev => prev.map(evt => {
      if (evt.id === eventId) {
        return { ...evt, status: evt.status === 'pendente' ? 'cumprido' as const : 'pendente' as const };
      }
      return evt;
    }));
  };

  const handleUpdateFaseAtualDirectly = (processNum: string, novaFase: string) => {
    const activeCase = processosList.find(p => p.numero === processNum);
    if (!activeCase) return;
    const updatedCase = {
      ...activeCase,
      faseAtual: novaFase,
      historicoAtos: [
        ...(activeCase.historicoAtos || []),
        {
          id: "fase-change-" + Date.now(),
          data: new Date().toISOString().substring(0, 10),
          descricao: `Transição formal de fase processual decretada administrativamente para: "${novaFase}".`,
          fase: novaFase,
          tipoAto: "Audiência / Despacho",
          createdAt: new Date().toISOString()
        }
      ]
    };
    updateProcesso(updatedCase);
    setProcessosList(getProcessos());
    setSecretariaSuccessMsg(`Fase processual atualizada com sucesso para "${novaFase}"!`);
    setTimeout(() => setSecretariaSuccessMsg(''), 4050);
  };

  const handleAddAtoDirectly = (processNum: string, desc: string, tipo: string) => {
    if (!desc.trim()) return;
    const activeCase = processosList.find(p => p.numero === processNum);
    if (!activeCase) return;
    const today = new Date().toISOString().substring(0, 10);
    const updatedCase = {
      ...activeCase,
      historicoAtos: [
        ...(activeCase.historicoAtos || []),
        {
          id: "ato-v-" + Date.now(),
          data: today,
          descricao: desc,
          fase: activeCase.faseAtual || "Instrução",
          tipoAto: tipo,
          createdAt: new Date().toISOString()
        }
      ]
    };
    updateProcesso(updatedCase);
    setProcessosList(getProcessos());
    setSecretariaSuccessMsg(`Novo ato processual averbado no processo principal!`);
    setTimeout(() => setSecretariaSuccessMsg(''), 4000);
  };

  const isProcessoAlarmado = (p: Processo) => {
    const info = getProcessoAlarmeInfo(p);
    if (!info.ativo || !info.data) return false;
    const todayStr = getLocalTodayString();
    return todayStr >= info.data;
  };

  const handleEliminarAlarme = (numero: string) => {
    const currentList = getProcessos();
    const processFound = currentList.find(p => p.numero === numero);
    if (processFound) {
      const u: Processo = {
        ...processFound,
        alarmeAtivo: false,
        alarmeTipo: undefined,
        alarmeData: undefined,
        alarmeNota: undefined,
        alarmeSilenciado: true
      };
      updateProcesso(u);
    }
    setProcessosList(getProcessos());
  };

  const handleSilenciarAlarme = (numero: string) => {
    handleEliminarAlarme(numero);
  };

  const handleAtivarAlarme = (numero: string) => {
    const currentList = getProcessos();
    const processFound = currentList.find(p => p.numero === numero);
    if (processFound) {
      const u = { ...processFound, alarmeAtivo: true };
      updateProcesso(u);
    }
    setProcessosList(getProcessos());
  };

  // Open / Preview File function
  const handleOpenFile = (doc: Documento) => {
    setPreviewDoc(doc);
  };

  // Print File simulated preview
  const handlePrintFile = (doc: Documento) => {
    setPrintDoc(doc);
  };

  // Real client-side File Downloader (creates and streams blob text to folder)
  const handleDownloadFile = (doc: Documento) => {
    // If the document has a real original file saved (e.g. as a base64 Data URL in conteudoUrl),
    // download that directly to preserve the original PDF, images, formatting, pages, and styling.
    if (doc.conteudoUrl) {
      try {
        const link = document.createElement('a');
        link.href = doc.conteudoUrl;
        link.download = doc.nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      } catch (err) {
        console.error("Erro ao descarregar ficheiro original diretamente, recorrendo à geração de PDF.", err);
      }
    }

    const fileContent = doc.conteudoTexto || `CONTEÚDOS DO DOCUMENTO LEGAL\n\nNome: ${doc.nome}\nCategoria: ${doc.categoria}\nParte: ${doc.parteApresentante}\nAdvogado: ${doc.advogadoApresentante}\nData: ${doc.dataApresentacao}\nTamanho: ${doc.tamanho}\n\nEste ficheiro foi indexado e guardado localmente em:\nC:\\GestaoProcessos\\${selectedProcessoNum || 'Documentos'}\\${doc.nome}`;
    const isPdf = doc.nome.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      try {
        const docPdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
        });
        
        // Background color
        docPdf.setFillColor(248, 250, 252);
        docPdf.rect(0, 0, 210, 297, 'F');
        
        // Deep indigo top band
        docPdf.setFillColor(15, 23, 42); 
        docPdf.rect(0, 0, 210, 16, 'F');
        
        // Official Header text
        docPdf.setTextColor(255, 255, 255);
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(10);
        docPdf.text('REPÚBLICA DE ANGOLA - TRIBUNAL DA COMARCA', 12, 10.5);
        
        // Document Title
        docPdf.setTextColor(15, 23, 42);
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(15);
        
        let cleanedTitle = doc.nome;
        if (cleanedTitle.toLowerCase().endsWith('.pdf')) {
          cleanedTitle = cleanedTitle.substring(0, cleanedTitle.length - 4);
        }
        docPdf.text(cleanedTitle.toUpperCase(), 12, 28);
        
        // Decorative partition line
        docPdf.setDrawColor(203, 213, 225);
        docPdf.setLineWidth(0.4);
        docPdf.line(12, 33, 198, 33);
        
        // Metadata table in sidebar fashion
        docPdf.setTextColor(71, 85, 105);
        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(8.5);
        docPdf.text(`Categoria: ${doc.categoria || 'Peça Processual'}`, 12, 39);
        docPdf.text(`Apresentador: ${doc.parteApresentante || 'Oficial de Justiça'}`, 12, 44);
        docPdf.text(`Advogado: ${doc.advogadoApresentante || 'Não Declarado'}`, 12, 49);
        docPdf.text(`Data de Registo: ${doc.dataApresentacao || new Date().toLocaleDateString('pt-PT')}`, 12, 54);
        if (selectedProcessoNum) {
          docPdf.text(`Processo Principal: Nº ${selectedProcessoNum}`, 12, 59);
        }
        
        docPdf.line(12, 64, 198, 64);
        
        // Document content body formatting
        docPdf.setTextColor(30, 41, 59);
        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(10);
        
        // Wrap/Split lines nicely code
        const lines = docPdf.splitTextToSize(fileContent, 186);
        
        let yPos = 72;
        const maxPageY = 282;
        
        for (let i = 0; i < lines.length; i++) {
          if (yPos > maxPageY) {
            docPdf.addPage();
            // Draw continuous page header
            docPdf.setFillColor(15, 23, 42);
            docPdf.rect(0, 0, 210, 11, 'F');
            docPdf.setTextColor(255, 255, 255);
            docPdf.setFont('helvetica', 'bold');
            docPdf.setFontSize(8);
            docPdf.text(`Continuação da Peça • ${cleanedTitle}`, 12, 7.5);
            
            yPos = 22; // reset height
            docPdf.setTextColor(30, 41, 59);
            docPdf.setFont('helvetica', 'normal');
            docPdf.setFontSize(10);
          }
          docPdf.text(lines[i], 12, yPos);
          yPos += 5.8;
        }
        
        // Footer signature
        docPdf.setTextColor(148, 163, 184);
        docPdf.setFont('helvetica', 'italic');
        docPdf.setFontSize(7.5);
        docPdf.text('Autenticado eletronicamente - JurisLocal (Serviços Digitais da Comarca)', 12, 289);
        
        docPdf.save(doc.nome);
        return;
      } catch (err) {
        console.error("Erro a gerar o PDF na exportação. Descarregando como .txt", err);
      }
    }

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let downloadName = doc.nome;
    if (!downloadName.match(/\.[a-zA-Z0-9]+$/)) {
      downloadName = `${downloadName}.txt`;
    }
    
    link.setAttribute('download', downloadName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Add document to existing Process
  const handleAddDocumentToProcesso = (numero: string, doc: Documento) => {
    const list = getProcessos();
    const found = list.find(p => p.numero === numero);
    if (found) {
      found.documentos.push(doc);
      updateProcesso(found);
      setProcessosList(getProcessos());
    }
  };

  // Update existing Process details (e.g. toggled notification recipients, etc.)
  const handleUpdateProcesso = (updated: Processo) => {
    updateProcesso(updated);
    setProcessosList(getProcessos());
  };

  // Delete whole Process (Admin Only)
  const handleDeleteProcesso = (numero: string) => {
    const list = getProcessos();
    const updated = list.filter(p => p.numero !== numero);
    localStorage.setItem('gestao_processos_processos', JSON.stringify(updated));
    setProcessosList(updated);
    setSelectedProcessoNum(null);
  };

  // Admin section: create profile
  const handleCreateProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserManageError('');
    setUserManageSuccess('');

    const trimmedUser = newUsername.trim();
    const trimmedPass = newPassword.trim();

    if (!trimmedUser || !trimmedPass) {
      setUserManageError('Preencha o nome de utilizador e a palavra-passe.');
      return;
    }

    const newUser: ActiveUserType = {
      username: trimmedUser,
      role: newRole,
      password: trimmedPass,
      createdAt: new Date().toISOString(),
      tribunalId: newUsernameTribunalId || undefined
    };

    const isSaved = saveUser(newUser);
    if (!isSaved) {
      setUserManageError('Este nome de utilizador já se encontra registado.');
      return;
    }

    setUserManageSuccess(`Utilizador ${trimmedUser} (${newRole}) criado com sucesso!`);
    setAllUsers(getUsers());
    setNewUsername('');
    setNewPassword('');
  };

  // --- TRIBUNAIS ADMINISTRATIVE ACTIONS ---
  const handleCreateTribunal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTribunalLocalidade.trim() || !newTribunalNome.trim()) {
      alert('Por favor, preencha a localidade e o nome do tribunal.');
      return;
    }
    const updated = saveTribunal(
      newTribunalLocalidade.trim(),
      newTribunalNome.trim(),
      newTribunalImagemCabecalho.trim() || undefined
    );
    setTribunaisList(updated);
    setNewTribunalLocalidade('');
    setNewTribunalNome('');
    setNewTribunalImagemCabecalho('');
    alert('Tribunal adicionado com sucesso!');
  };

  const handleDeleteTribunal = (id: string) => {
    if (window.confirm('Tem a certeza de que deseja eliminar este tribunal?')) {
      const updated = deleteTribunal(id);
      setTribunaisList(updated);
    }
  };

  // --- MODELOS DE FORMULÁRIO ADMINISTRATIVE ACTIONS ---
  const handleCreateFormModelo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormModeloNome.trim() || !newFormModeloTexto.trim()) {
      alert('Por favor, defina um nome e o texto base para o formulário.');
      return;
    }
    const novoModelo = {
      id: generateId(),
      nome: newFormModeloNome.trim(),
      texto: newFormModeloTexto.trim(),
      tribunalId: newFormModeloTribunalId || undefined
    };
    const updated = saveFormModelo(novoModelo);
    setFormModelosList(updated);
    setNewFormModeloNome('');
    setNewFormModeloTexto('');
    alert('Modelo de formulário guardado para utilização!');
  };

  const handleDeleteFormModelo = (id: string) => {
    if (window.confirm('Deseja realmente remover este modelo?')) {
      const updated = deleteFormModelo(id);
      setFormModelosList(updated);
    }
  };

  // Active Multi-Criteria Filter logic
  const filteredProcessos = (() => {
    const intervenientesList = getIntervenientes();
    
    const matchPerson = (name: string, query: string) => {
      if (!query) return true;
      const normalizedQuery = normalizeText(query);
      if (normalizeText(name).includes(normalizedQuery)) return true;
      
      const profile = intervenientesList.find(i => i.nome.trim().toLowerCase() === name.trim().toLowerCase());
      if (profile) {
        if (profile.telefone && normalizeText(profile.telefone).includes(normalizedQuery)) return true;
        if (profile.bilheteIdentidade && normalizeText(profile.bilheteIdentidade).includes(normalizedQuery)) return true;
      }
      return false;
    };

    return processosList.filter(p => !p.deleted && !p.parentProcessoNumero).filter(p => {
      if (filterNumero && !p.numero.toLowerCase().includes(filterNumero.toLowerCase())) return false;
      if (filterJuiz && !normalizeText(p.juizTitular).includes(normalizeText(filterJuiz))) return false;
      if (filterData && p.dataAutuacao !== filterData) return false;
      
      if (filterParte && !p.autores.some(a => matchPerson(a, filterParte)) && !p.reus.some(r => matchPerson(r, filterParte))) return false;
      
      if (filterAdvogado && 
        !p.advogadosAutor.some(adv => normalizeText(adv).includes(normalizeText(filterAdvogado))) && 
        !p.advogadosReu.some(adv => normalizeText(adv).includes(normalizeText(filterAdvogado)))
      ) return false;

      if (filterProcurador && (
        !p.procuradores || !p.procuradores.some(proc => normalizeText(proc).includes(normalizeText(filterProcurador)))
      )) return false;

      if (filterFuncionario && (
        !p.funcionarios || !p.funcionarios.some(func => normalizeText(func).includes(normalizeText(filterFuncionario)))
      )) return false;

      if (filterApenasAlarmados && !p.alarmeAtivo) return false;
      if (filterApenasExpirados && !isProcessoAlarmado(p)) return false;
      
      return true;
    });
  })();

  const clearFilters = () => {
    setFilterNumero('');
    setFilterParte('');
    setFilterData('');
    setFilterJuiz('');
    setFilterAdvogado('');
    setFilterProcurador('');
    setFilterFuncionario('');
    setFilterApenasAlarmados(false);
    setFilterApenasExpirados(false);
  };

  // Route back out to Login if not logged in
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Active process model lookup
  const activeProcessoModel = selectedProcessoNum 
    ? processosList.find(p => p.numero === selectedProcessoNum) 
    : null;

  if (isNewTabMode && selectedProcessoNum && activeProcessoModel) {
    return (
      <ProcessoDetail 
        processo={activeProcessoModel} 
        currentUser={currentUser}
        onBack={() => {
          window.close();
        }}
        onOpenFile={handleOpenFile}
        onPrintFile={handlePrintFile}
        onDownloadFile={handleDownloadFile}
        onAddDocumentToProcesso={handleAddDocumentToProcesso}
        onDeleteProcesso={handleDeleteProcesso}
        onConsultarFicha={setFichaConsultarNome}
        onUpdateProcesso={handleUpdateProcesso}
        onSelectProcesso={handleOpenProcessoInNewTab}
        isNewTabMode={isNewTabMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans selection:bg-slate-900 selection:text-white antialiased transition-colors duration-150 border-8 border-slate-900">
      
      {/* Top Professional Titlebar / OS Header (Tauri Styled / Geometric Balance Accent) */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between no-print shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded bg-slate-900 flex items-center justify-center text-blue-400 font-bold border border-slate-800">
            <Scale className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-sm font-bold font-display tracking-tight text-slate-900">
                Gestor de Processos Judicial
              </span>
              <span className="text-[9px] bg-slate-100 text-slate-500 font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                v2.4 offline-first
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Dispositivo Local • Disco C: Ligado</p>
          </div>
        </div>

        {/* Current user & system details */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1.5 justify-end">
              <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-bold text-slate-800">{currentUser.username}</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              Categoria: {currentUser.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-655 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-xs font-semibold"
            title="Encerrar Sessão"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Main layout container with Left Bar and Main Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Navigation Sidebar (Geometric Balance styling) */}
        {!isNewTabMode && activeTab !== 'inicial' && (
          <aside className="w-64 bg-slate-900 flex flex-col h-full no-print shrink-0 border-r border-slate-850">
          <div className="p-6 flex flex-col gap-1 border-b border-slate-800">
            <h1 className="text-blue-400 font-bold text-xl tracking-tight flex items-center gap-2 font-display">
              <div className="w-3 h-3 bg-blue-400 rounded-sm"></div>
              JURIS_LOCAL
            </h1>
            <p className="text-slate-500 text-[10px] uppercase font-semibold tracking-widest">SISTEMA OFF-LINE V2.4</p>
          </div>

          <nav className="mt-4 flex-1 px-4 space-y-2 overflow-y-auto">
            {/* Tab: Registration */}
            <div
              onClick={() => {
                setSelectedProcessoNum(null);
                setActiveTab('registo');
              }}
              className={`p-3 rounded-md flex items-center justify-between cursor-pointer transition-colors text-sm font-medium ${
                activeTab === 'registo'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <FilePlus2 className="w-5 h-5 opacity-70" />
                <span>Novo Registo</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </div>

            {/* Tab: Search */}
            <div
              onClick={() => {
                setSelectedProcessoNum(null);
                setActiveTab('pesquisa');
                setFilterApenasAlarmados(false);
              }}
              className={`p-3 rounded-md flex items-center justify-between cursor-pointer transition-colors text-sm font-medium ${
                activeTab === 'pesquisa' && !selectedProcessoNum && !filterApenasAlarmados
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderSearch className="w-5 h-5 opacity-70" />
                <span>Pesquisar Processos</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </div>

            {/* Tab: Processos Alarmados (Alarmes e Prazos Limitadores) */}
            <div
              onClick={() => {
                setSelectedProcessoNum(null);
                setActiveTab('pesquisa');
                setFilterApenasAlarmados(true);
              }}
              className={`p-3 rounded-md flex items-center justify-between cursor-pointer transition-colors text-sm font-medium ${
                activeTab === 'pesquisa' && filterApenasAlarmados
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <BellRing className={`w-5 h-5 ${processosList.filter(p => !p.deleted && p.alarmeAtivo).length > 0 ? 'text-amber-500 animate-pulse' : 'opacity-70'}`} />
                <span>Processos Alarmados ({processosList.filter(p => !p.deleted && p.alarmeAtivo).length})</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </div>

            {/* Tab: FileExplorer Visualizer */}
            <div
              onClick={() => {
                setSelectedProcessoNum(null);
                setActiveTab('disco');
              }}
              className={`p-3 rounded-md flex items-center justify-between cursor-pointer transition-colors text-sm font-medium ${
                activeTab === 'disco'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 opacity-70" />
                <span>Explorador (C:\)</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </div>

            {/* Tab: Manual do Utilizador */}
            <div
              onClick={() => {
                setSelectedProcessoNum(null);
                setActiveTab('manual');
              }}
              className={`p-3 rounded-md flex items-center justify-between cursor-pointer transition-colors text-sm font-medium ${
                activeTab === 'manual'
                  ? 'bg-slate-800 text-white border border-slate-750 font-bold'
                  : 'text-indigo-400/90 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 opacity-90" />
                <span>Manual do Utilizador</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </div>

            {/* Administrative Sections & User Profile */}
            <div
              onClick={() => {
                setSelectedProcessoNum(null);
                setActiveTab('utilizadores');
              }}
              className={`p-3 rounded-md flex items-center justify-between cursor-pointer transition-colors text-sm font-medium ${
                activeTab === 'utilizadores'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 opacity-70" />
                <span>{currentUser.role === 'administrador' ? 'Administração' : 'O Meu Perfil'}</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-40" />
            </div>

          </nav>

          <div className="p-4 mt-auto border-t border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-[13px] uppercase">
                {currentUser.username.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate max-w-[120px]">{currentUser.username}</span>
                <span className="text-[10px] text-slate-500 capitalize">{currentUser.role}</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              Sincronizado: C:\JurisApp\Storage
            </div>
          </div>
        </aside>
        )}

        {/* Dynamic Main Workspace Panel */}
        <main className="flex-1 bg-[#F8FAFC] p-8 overflow-y-auto relative min-h-0">
          
          {/* Detailed case sheet bypass */}
          {selectedProcessoNum && activeProcessoModel ? (
            <ProcessoDetail 
              processo={activeProcessoModel} 
              currentUser={currentUser}
              onBack={() => {
                if (isNewTabMode) {
                  window.close();
                } else {
                  setSelectedProcessoNum(null);
                }
              }}
              onOpenFile={handleOpenFile}
              onPrintFile={handlePrintFile}
              onDownloadFile={handleDownloadFile}
              onAddDocumentToProcesso={handleAddDocumentToProcesso}
              onDeleteProcesso={handleDeleteProcesso}
              onConsultarFicha={setFichaConsultarNome}
              onUpdateProcesso={handleUpdateProcesso}
              onSelectProcesso={handleOpenProcessoInNewTab}
              isNewTabMode={isNewTabMode}
            />
          ) : (
            /* Standard Tabs */
            <React.Fragment>
              
              {isNewTabMode && (
                <div className="mb-6 flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-[11px] text-slate-500 font-medium">Esta área de trabalho foi aberta num separador isolado e focado.</span>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        window.close();
                      } catch(e) {}
                      window.location.search = "";
                    }}
                    className="px-3 py-1 bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 leading-none shadow-3xs"
                  >
                    <span>←</span> Fechar Separador / Voltar ao Início
                  </button>
                </div>
              )}

              {/* Tab: Página Inicial (Dashboard Hub) */}
              {activeTab === 'inicial' && (
                <div className="space-y-8">
                  {/* Dashboard Welcome Banner */}
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold font-display tracking-tight text-white">
                          JurisLocal • Painel de Gestão Judicial
                        </h2>
                        <p className="text-xs text-slate-300 mt-1">
                          Bem-vindo ao centro de operações do tribunal. Use os acessos abaixo para abrir cada secção em novo separador de trabalho.
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <div className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-mono font-bold tracking-tight border border-white/10 text-slate-250">
                          Dispositivo: Local C:\
                        </div>
                        <div className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                          Estado: Ativo & Seguro
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BIG BUTTONS GRID */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Secções Principais (Novos Separadores)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Button 1: Novo Registo */}
                      <button
                        onClick={() => handleOpenTabInNewTab('registo')}
                        className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-5 text-left transition-all duration-150 hover:-translate-y-1 shadow-xs hover:shadow-md cursor-pointer group flex flex-col justify-between h-44 w-full"
                      >
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <FilePlus2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 mt-4">
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">
                            Novo Registo
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                            Formulário de autuação com anexação de petições e documentos.
                          </p>
                        </div>
                      </button>

                      {/* Button 2: Pesquisar Processos */}
                      <button
                        onClick={() => handleOpenTabInNewTab('pesquisa')}
                        className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-5 text-left transition-all duration-150 hover:-translate-y-1 shadow-xs hover:shadow-md cursor-pointer group flex flex-col justify-between h-44 w-full"
                      >
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <FolderSearch className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 mt-4">
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                            Pesquisar Processos
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                            Consulta e filtragem avançada por nome, telefone ou BI do Autor/Réu.
                          </p>
                        </div>
                      </button>

                      {/* Button 3: Explorador */}
                      <button
                        onClick={() => handleOpenTabInNewTab('disco')}
                        className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-5 text-left transition-all duration-150 hover:-translate-y-1 shadow-xs hover:shadow-md cursor-pointer group flex flex-col justify-between h-44 w-full"
                      >
                        <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                          <HardDrive className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 mt-4">
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-amber-600 transition-colors">
                            Explorador
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                            Navegador do disco local e repositórios de ficheiros judiciais (C:\).
                          </p>
                        </div>
                      </button>

                      {/* Button 4: Administração / Perfil */}
                      <button
                        onClick={() => handleOpenTabInNewTab('utilizadores')}
                        className="rounded-xl p-5 text-left h-44 transition-all duration-150 shadow-xs group flex flex-col justify-between w-full bg-white hover:bg-slate-50 border border-slate-200 hover:-translate-y-1 hover:shadow-md cursor-pointer"
                      >
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center border transition-colors bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-600 group-hover:text-white">
                          <Building className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 mt-4">
                          <h4 className="text-sm font-bold transition-colors text-slate-800 group-hover:text-rose-600">
                            {currentUser.role === 'administrador' ? 'Administração' : 'O Meu Perfil'}
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                            {currentUser.role === 'administrador'
                              ? 'Gestão de acessos, modelos de documentos e bases de dados.'
                              : 'Aceda às informações da sua conta, comarca judicial e palavra-passe.'}
                          </p>
                        </div>
                      </button>

                      {/* Button 5: Manual do Utilizador */}
                      <button
                        onClick={() => handleOpenTabInNewTab('manual')}
                        className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-5 text-left transition-all duration-150 hover:-translate-y-1 shadow-xs hover:shadow-md cursor-pointer group flex flex-col justify-between h-44 w-full"
                      >
                        <div className="h-10 w-10 bg-indigo-50 flex items-center justify-center text-indigo-600 rounded-lg border border-indigo-100 group-hover:bg-indigo-650 group-hover:text-white transition-colors">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 mt-4">
                          <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                            Manual do Utilizador
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                            Manual detalhado com explicações passo-a-passo sobre todas as funcionalidades.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* ALARMES ATIVOS E SILENCIADOS SECTION */}
                  {(() => {
                    // Compute alarms for all non-deleted processes using getProcessoAlarmeInfo
                    const preparedAlarms = processosList
                      .filter(p => !p.deleted)
                      .map(p => {
                        const info = getProcessoAlarmeInfo(p);
                        return {
                          processo: p,
                          numero: p.numero,
                          data: info.data,
                          nota: info.justificacao,
                          ativo: info.ativo,
                          origem: info.isAutomatico ? ('sistema' as const) : ('utilizador' as const)
                        };
                      })
                      // Only show active (non-eliminated) alarms in the board
                      .filter(a => a.ativo);

                    // Filter by origin matching user selection (from top-right toggle)
                    const filteredAlarms = preparedAlarms.filter(a => {
                      if (filtroAlarmeOrigem === 'utilizador') {
                        return a.origem === 'utilizador';
                      }
                      return true;
                    });

                    const todayVal = getLocalTodayString();

                    // Categorize as Anterior, Atual or Futura
                    const overdueRaw = filteredAlarms.filter(a => a.data && todayVal > a.data);
                    const todayRaw = filteredAlarms.filter(a => a.data === todayVal);
                    const futureRaw = filteredAlarms.filter(a => a.data && todayVal < a.data);

                    // Sort chronologically from closest to most distant:
                    // For previous (overdue): Descending puts most recent past date closest to today
                    const sortedOverdueAlarms = overdueRaw.sort((a, b) => b.data.localeCompare(a.data));
                    
                    // For current (today): All same day
                    const sortedTodayAlarms = todayRaw;

                    // For future: Ascending puts earliest future date closest to today
                    const sortedFutureAlarms = futureRaw.sort((a, b) => a.data.localeCompare(b.data));

                    // Future days pagination: get unique future dates with alarms
                    const uniqueFutureDatesWithAlarms = Array.from(new Set(sortedFutureAlarms.map(a => a.data))).sort();
                    const visibleFutureDates = uniqueFutureDatesWithAlarms; // Show all dates
                    const displayedFutureAlarms = sortedFutureAlarms; // Show all future alarms regardless of date limits
                    const hasMoreFutureAlarms = false; // All are shown directly

                    // Determine if we have any matches according to the checkboxes chosen
                    const showOverdueList = alarmeMostrarAnterior && sortedOverdueAlarms.length > 0;
                    const showTodayList = alarmeMostrarAtual && sortedTodayAlarms.length > 0;
                    const showFutureList = alarmeMostrarFutura && displayedFutureAlarms.length > 0;
                    const hasAnyVisibleAlarm = showOverdueList || showTodayList || showFutureList;

                    return (
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                        {/* Header with Title and Origin Pills */}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 mb-6 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⏰</span>
                            <div>
                              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display">
                                Gestão de Alarmes e Prazos Ativos
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                Alertas automáticos (60 dias sem novos atos) e manuais agendados pelos utilizadores.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Origin Filter Selection */}
                            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setFiltroAlarmeOrigem('todos')}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                  filtroAlarmeOrigem === 'todos'
                                    ? 'bg-white text-slate-900 shadow-3xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Todos ({preparedAlarms.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setFiltroAlarmeOrigem('utilizador')}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                  filtroAlarmeOrigem === 'utilizador'
                                    ? 'bg-white text-slate-900 shadow-3xs'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Do Utilizador ({preparedAlarms.filter(a => a.origem === 'utilizador').length})
                              </button>
                            </div>
                            <span className="text-[11px] bg-slate-150 text-slate-700 font-mono font-bold px-2.5 py-0.5 rounded-full shrink-0">
                              Visíveis: {filteredAlarms.length}
                            </span>
                          </div>
                        </div>

                        {/* THREE CHECKBOX COLOURED BUTTON CONTROL BAR */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 font-sans">
                          <span className="text-xs font-bold text-slate-550 uppercase tracking-wider block">
                            Selecione os Tipos de Alarme a Listar:
                          </span>
                          <div className="flex flex-wrap gap-2.5">
                            {/* Checkbox 1: Anterior */}
                            <label className={`inline-flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer select-none transition-all shadow-3xs ${
                              alarmeMostrarAnterior 
                                ? 'bg-red-50 text-red-900 border-red-300 ring-1 ring-red-200' 
                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={alarmeMostrarAnterior}
                                onChange={(e) => setAlarmeMostrarAnterior(e.target.checked)}
                                className="rounded text-red-650 focus:ring-red-500 h-3.5 w-3.5 accent-red-650 cursor-pointer"
                              />
                              <span className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${alarmeMostrarAnterior ? 'bg-red-600 animate-pulse' : 'bg-slate-350'}`}></span>
                                Data Anterior ({sortedOverdueAlarms.length})
                              </span>
                            </label>

                            {/* Checkbox 2: Atual */}
                            <label className={`inline-flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer select-none transition-all shadow-3xs ${
                              alarmeMostrarAtual 
                                ? 'bg-amber-50 text-amber-905 border-amber-300 ring-1 ring-amber-200' 
                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={alarmeMostrarAtual}
                                onChange={(e) => setAlarmeMostrarAtual(e.target.checked)}
                                className="rounded text-amber-505 focus:ring-amber-550 h-3.5 w-3.5 accent-amber-550 cursor-pointer"
                              />
                              <span className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${alarmeMostrarAtual ? 'bg-amber-505' : 'bg-slate-350'}`}></span>
                                Data Atual/Hoje ({sortedTodayAlarms.length})
                              </span>
                            </label>

                            {/* Checkbox 3: Futura */}
                            <label className={`inline-flex items-center gap-2 px-3.5 py-1.5 border rounded-lg text-xs font-bold cursor-pointer select-none transition-all shadow-3xs ${
                              alarmeMostrarFutura 
                                ? 'bg-emerald-50 text-emerald-905 border-emerald-300 ring-1 ring-emerald-200' 
                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={alarmeMostrarFutura}
                                onChange={(e) => setAlarmeMostrarFutura(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 accent-emerald-650 cursor-pointer"
                              />
                              <span className="flex items-center gap-1.5">
                                <span className={`h-2 w-2 rounded-full ${alarmeMostrarFutura ? 'bg-emerald-505' : 'bg-slate-350'}`}></span>
                                Data Futura ({sortedFutureAlarms.length})
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* LIST ROW PRESENTATION FOR ACTIVE ALARMS (UM PROCESSO POR LINHA) */}
                        {!hasAnyVisibleAlarm ? (
                          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 font-sans">
                            <span className="text-3xl block mb-2 font-emoji">🌸</span>
                            <p className="text-xs font-bold text-slate-600 italic">Nenhum processo com alarme ativo disponível para visualização.</p>
                            <p className="text-[10px] text-slate-400 mt-1">Selecione filtros no painel de controle superior ou configure notificações nos autos.</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* GROUP 1: DATAS ANTERIORES */}
                            {showOverdueList && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1 border-b border-rose-100">
                                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping"></span>
                                  <h4 className="text-xs font-black text-rose-950 uppercase tracking-widest font-display">
                                    🚨 Prazos e Alarmes Vencidos ({sortedOverdueAlarms.length})
                                  </h4>
                                </div>
                                <div className="space-y-2 font-sans">
                                  {sortedOverdueAlarms.map(a => {
                                    const p = a.processo;
                                    return (
                                      <div
                                        key={`line-${p.numero}-${a.origem}-overdue`}
                                        className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-red-50/20 hover:bg-red-50/35 border border-red-200 rounded-xl transition-all gap-4 shadow-3xs"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-grow min-w-0">
                                          {/* Expiry limit badge */}
                                          <div className="shrink-0 flex items-center justify-center font-mono font-bold text-[10.5px] px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-220 w-fit select-none shadow-4xs">
                                            📅 Vencido: {a.data}
                                          </div>
                                          
                                          {/* Process identifier key */}
                                          <span className="font-mono text-xs font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded shadow-4xs shrink-0 select-all min-w-[125px] text-center">
                                            {p.numero}
                                          </span>

                                          {/* Origin indicator tag */}
                                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-slate-100 text-slate-650 border border-slate-200 shrink-0">
                                            {a.origem === 'utilizador' ? '👤 Utilizador' : '⚙️ Sistema'}
                                          </span>

                                          {/* Alarm note and descriptive label */}
                                          <div className="min-w-0 flex-grow text-left">
                                            <p className="text-xs text-rose-950 font-sans font-bold leading-normal italic break-words">
                                              "{a.nota}"
                                            </p>
                                            <p className="text-[10px] text-slate-450 truncate mt-0.5">
                                              Partes: <strong className="text-slate-600 font-bold">{p.autores.join(', ')}</strong> vs <strong className="text-slate-600 font-bold">{p.reus.join(', ')}</strong>
                                            </p>
                                          </div>
                                        </div>

                                        {/* Row line operations */}
                                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                          <button
                                            onClick={() => handleEliminarAlarme(p.numero)}
                                            className="px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer font-bold text-[10px] uppercase shadow-3xs"
                                            title="Eliminar este alarme permanentemente"
                                          >
                                            Eliminar
                                          </button>
                                          <button
                                            onClick={() => handleOpenProcessoInNewTab(p.numero)}
                                            className="px-3.5 py-1.5 bg-rose-900 hover:bg-rose-800 text-white rounded-lg transition-colors cursor-pointer font-bold text-[10px] uppercase shadow-3xs"
                                          >
                                            Ver Ficha
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* GROUP 2: DATAS ATUAIS (HOJE) */}
                            {showTodayList && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1 border-b border-amber-100">
                                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-widest font-display">
                                    ⏰ Prazos e Alarmes de Hoje ({sortedTodayAlarms.length})
                                  </h4>
                                </div>
                                <div className="space-y-2 font-sans">
                                  {sortedTodayAlarms.map(a => {
                                    const p = a.processo;
                                    return (
                                      <div
                                        key={`line-${p.numero}-${a.origem}-today`}
                                        className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-amber-50/20 hover:bg-amber-50/35 border border-amber-200 rounded-xl transition-all gap-4 shadow-3xs"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-grow min-w-0">
                                          {/* Daily limit badge */}
                                          <div className="shrink-0 flex items-center justify-center font-mono font-bold text-[10.5px] px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-220 w-fit select-none shadow-4xs">
                                            📅 Hoje: {a.data}
                                          </div>
                                          
                                          {/* Process identifier key */}
                                          <span className="font-mono text-xs font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded shadow-4xs shrink-0 select-all min-w-[125px] text-center">
                                            {p.numero}
                                          </span>

                                          {/* Origin indicator tag */}
                                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-slate-100 text-slate-650 border border-slate-200 shrink-0">
                                            {a.origem === 'utilizador' ? '👤 Utilizador' : '⚙️ Sistema'}
                                          </span>

                                          {/* Alarm note and descriptive label */}
                                          <div className="min-w-0 flex-grow text-left">
                                            <p className="text-xs text-amber-950 font-sans font-bold leading-normal italic break-words">
                                              "{a.nota}"
                                            </p>
                                            <p className="text-[10px] text-slate-450 truncate mt-0.5">
                                              Partes: <strong className="text-slate-600 font-bold">{p.autores.join(', ')}</strong> vs <strong className="text-slate-600 font-bold">{p.reus.join(', ')}</strong>
                                            </p>
                                          </div>
                                        </div>

                                        {/* Row line operations */}
                                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                          <button
                                            onClick={() => handleEliminarAlarme(p.numero)}
                                            className="px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer font-bold text-[10px] uppercase shadow-3xs"
                                            title="Eliminar este alarme permanentemente"
                                          >
                                            Eliminar
                                          </button>
                                          <button
                                            onClick={() => handleOpenProcessoInNewTab(p.numero)}
                                            className="px-3.5 py-1.5 bg-amber-900 hover:bg-amber-800 text-white rounded-lg transition-colors cursor-pointer font-bold text-[10px] uppercase shadow-3xs"
                                          >
                                            Ver Ficha
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* GROUP 3: DATAS FUTURAS (PAGINADAS EM INTERVALOS DE 5 DIAS COM ALARME) */}
                            {showFutureList && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between pb-1 border-b border-emerald-100 font-sans">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest font-display">
                                      📅 Prazos e Alertas Futuros ({sortedFutureAlarms.length})
                                    </h4>
                                  </div>
                                  <span className="text-[9.5px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded">
                                    Mostrando todos os {uniqueFutureDatesWithAlarms.length} dias agendados
                                  </span>
                                </div>
                                
                                <div className="space-y-2 font-sans">
                                  {displayedFutureAlarms.map(a => {
                                    const p = a.processo;
                                    return (
                                      <div
                                        key={`line-${p.numero}-${a.origem}-future`}
                                        className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all gap-4 shadow-3xs"
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-grow min-w-0">
                                          {/* Future limit badge */}
                                          <div className="shrink-0 flex items-center justify-center font-mono font-bold text-[10.5px] px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit select-none shadow-4xs">
                                            📅 Limite: {a.data}
                                          </div>
                                          
                                          {/* Process identifier key */}
                                          <span className="font-mono text-xs font-black text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded shadow-4xs shrink-0 select-all min-w-[125px] text-center">
                                            {p.numero}
                                          </span>

                                          {/* Origin indicator tag */}
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border shrink-0 ${
                                            a.origem === 'utilizador' 
                                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                              : 'bg-slate-105 text-slate-600 border-slate-205'
                                          }`}>
                                            {a.origem === 'utilizador' ? '👤 Utilizador' : '⚙️ Sistema'}
                                          </span>

                                          {/* Alarm note and descriptive label */}
                                          <div className="min-w-0 flex-grow text-left">
                                            <p className="text-xs text-slate-700 font-sans font-medium leading-normal italic break-words">
                                              "{a.nota}"
                                            </p>
                                            <p className="text-[10px] text-slate-450 truncate mt-0.5">
                                              Partes: <strong className="text-slate-600 font-bold">{p.autores.join(', ')}</strong> vs <strong className="text-slate-600 font-bold">{p.reus.join(', ')}</strong>
                                            </p>
                                          </div>
                                        </div>

                                        {/* Row line operations */}
                                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                          <button
                                            onClick={() => handleEliminarAlarme(p.numero)}
                                            className="px-3 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer font-bold text-[10px] uppercase shadow-3xs"
                                            title="Eliminar este alarme permanentemente"
                                          >
                                            Eliminar
                                          </button>
                                          <button
                                            onClick={() => handleOpenProcessoInNewTab(p.numero)}
                                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer font-bold text-[10px] uppercase shadow-3xs"
                                          >
                                            Ver Ficha
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* SETA / EXPANSION REVEAL BUTTON FOR EXTRA 5 UNIQUE DATES WITH FUTURE ALARMS */}
                                {hasMoreFutureAlarms && (
                                  <div className="flex justify-center pt-4">
                                    <button
                                      type="button"
                                      onClick={() => setAlarmeFutureDaysLimit(prev => prev + 5)}
                                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all cursor-pointer shadow-3xs group select-none"
                                      title="Mostrar mais 5 dias seguintes com alarmes"
                                    >
                                      <span>Mostrar mais 5 dias seguintes com alarmes</span>
                                      <ChevronDown className="h-4 w-4 stroke-[2.5] transform group-hover:translate-y-0.5 transition-transform" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab: Secretaria Digital - 3-Column Office Desk */}
              {false && (() => {
              // Local layout constants inside IIFE
              const secFiltered = processosList.filter(p => !p.deleted).filter(p => {
                if (secSearch) {
                  const q = secSearch.toLowerCase();
                  const matchNum = p.numero.toLowerCase().includes(q);
                  const matchAutor = p.autores.some(a => a.toLowerCase().includes(q));
                  const matchReu = p.reus.some(r => r.toLowerCase().includes(q));
                  const matchJuiz = p.juizTitular.toLowerCase().includes(q);
                  if (!matchNum && !matchAutor && !matchReu && !matchJuiz) return false;
                }
                if (secFilterType === 'civel') return p.tipo === 'civel';
                if (secFilterType === 'crime') return p.tipo === 'crime';
                if (secFilterType === 'prazo') return p.alarmeAtivo && p.alarmeData;
                return true;
              });

              // Selected case calculation
              const activeCase = secretariaSelectedNum 
                ? processosList.find(p => p.numero === secretariaSelectedNum)
                : null;

              // Apensos related to active case
              const linkedApensos = activeCase 
                ? processosList.filter(p => p.parentProcessoNumero === activeCase.numero && !p.deleted)
                : [];

              return (
                <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-5 -m-4 overflow-hidden font-sans">
                  
                  {/* COLUMN 1: Narrow Process Search Desk (25%) */}
                  <div className="w-full lg:w-[26%] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs h-full shrink-0">
                    {/* Header Controls */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 tracking-wider uppercase font-display flex items-center gap-1.5">
                          <Scale className="h-4 w-4 text-blue-500" /> Índice de Rastreio ({secFiltered.length})
                        </span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          Local DB
                        </span>
                      </div>
                      
                      {/* Live Instant Search */}
                      <div className="relative">
                        <input
                          type="text"
                          value={secSearch}
                          onChange={(e) => setSecSearch(e.target.value)}
                          placeholder="Pesquisa rápida (Nº, Partes, Juiz)..."
                          className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-250 rounded-lg text-xs placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                        />
                        {secSearch && (
                          <button 
                            onClick={() => setSecSearch('')}
                            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Filter Badges Row */}
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setSecFilterType('todos')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                            secFilterType === 'todos'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-150'
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => setSecFilterType('civel')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                            secFilterType === 'civel'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Cível
                        </button>
                        <button
                          onClick={() => setSecFilterType('crime')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                            secFilterType === 'crime'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Crime
                        </button>
                        <button
                          onClick={() => setSecFilterType('prazo')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${
                            secFilterType === 'prazo'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>⏰</span> Prazos
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Cases List Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
                      {secFiltered.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <span className="text-xl block mb-2">🔍</span>
                          <p className="text-xs italic">Nenhum processo coincide com a pesquisa.</p>
                        </div>
                      ) : (
                        secFiltered.map((p) => {
                          const isSel = p.numero === secretariaSelectedNum;
                          const hasUrgentAlarm = p.alarmeAtivo && isProcessoAlarmado(p);
                          
                          return (
                            <div
                              key={p.numero}
                              onClick={() => {
                                setSecretariaSelectedNum(p.numero);
                                setSecretariaActiveDoc(null);
                                // Default to document viewer if case has docs
                                if (p.documentos && p.documentos.length > 0) {
                                  setSecretariaActiveDoc(p.documentos[0]);
                                  setSecretariaRightTab('viewer');
                                } else {
                                  setSecretariaRightTab('notificar');
                                }
                              }}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none relative group ${
                                isSel
                                  ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
                                  : 'bg-white border-slate-200 hover:border-slate-350 hover:shadow-xs'
                              }`}
                            >
                              {/* Alarm status dots */}
                              {p.alarmeAtivo && (
                                <span className={`absolute top-3.5 right-3 h-2.5 w-2.5 rounded-full ${
                                  hasUrgentAlarm ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                                }`} title={p.alarmeNota || "Prazo ativo"} />
                              )}

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors select-all">
                                    {p.numero}
                                  </span>
                                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                                    p.tipo === 'crime' 
                                      ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                  }`}>
                                    {p.tipo === 'crime' ? 'Crime' : 'Cível'}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-650 space-y-0.5 font-medium">
                                  <p className="truncate"><strong className="text-slate-400">Aut:</strong> {p.autores.join(', ')}</p>
                                  <p className="truncate"><strong className="text-slate-400">Rré:</strong> {p.reus.join(', ')}</p>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                  <span className="font-semibold text-slate-500 truncate max-w-[120px]">
                                    ⚖️ {p.juizTitular.split(' ').pop()}
                                  </span>
                                  <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[9px]">
                                    {p.faseAtual || "Instrução"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* COLUMN 2: Process Detail & Act Timeline (40%) */}
                  <div className="w-full lg:w-[38%] bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs h-full shrink-0">
                    {activeCase ? (
                      <div className="flex flex-col h-full overflow-hidden">
                        
                        {/* Process Quick Header Metadata */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50 shrink-0 space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  activeCase.tipo === 'crime' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
                                }`}>
                                  Processo {activeCase.tipo === 'crime' ? 'Criminal' : 'Cível'}
                                </span>
                                {activeCase.valorAcao !== undefined && (
                                  <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                                    Valor: {activeCase.valorAcao.toLocaleString('pt-PT')} €
                                  </span>
                                )}
                              </div>
                              <h2 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2 select-all font-display">
                                📂 {activeCase.numero}
                              </h2>
                            </div>
                            
                            {/* Layout alert status message flash */}
                            {secretariaSuccessMsg && (
                              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-3 py-1.5 rounded-lg animate-fade-in">
                                {secretariaSuccessMsg}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-150">
                            <div>
                              <p className="text-slate-400 font-medium">Juiz Titular</p>
                              <p className="font-extrabold text-slate-800">{activeCase.juizTitular}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 font-medium">Data de Autuação</p>
                              <p className="font-mono font-bold text-slate-800">{activeCase.dataAutuacao}</p>
                            </div>
                            <div className="col-span-2 pt-1.5 border-t border-slate-50 flex items-center gap-2">
                              <span className="text-slate-400 font-medium">Mudar Fase Atual:</span>
                              <select
                                value={activeCase.faseAtual || 'Instrução / Articulados'}
                                onChange={(e) => handleUpdateFaseAtualDirectly(activeCase.numero, e.target.value)}
                                className="bg-slate-100 hover:bg-slate-200 rounded border-none font-bold text-slate-800 px-2 py-0.5 text-[10px] cursor-pointer transition-colors"
                              >
                                <option value="Inquérito / Boletim">Inquérito / Boletim</option>
                                <option value="Instrução / Articulados">Instrução / Articulados</option>
                                <option value="Despacho Saneador">Despacho Saneador</option>
                                <option value="Audiência de Julgamento">Audiência de Julgamento</option>
                                <option value="Sentença Proferida">Sentença Proferida</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Middle dynamic layout containing Active Timeline acts and Connected files */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
                          
                          {/* Alert Notice Section inside case */}
                          {activeCase.alarmeAtivo && activeCase.alarmeData && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs flex gap-3 text-amber-905 slide-in-from-top-1 duration-150">
                              <span className="text-lg">⏰</span>
                              <div className="space-y-1">
                                <p className="font-bold flex items-center gap-1.5">
                                  Alerta de Prazo Judicial Ativo 
                                  <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${
                                    isProcessoAlarmado(activeCase) ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {isProcessoAlarmado(activeCase) ? 'EXPIRADO' : 'IMINENTE'}
                                  </span>
                                </p>
                                <p className="text-slate-600 font-medium font-mono text-[10px]">Data limite: {activeCase.alarmeData} ({activeCase.alarmeNota})</p>
                                <button
                                  type="button"
                                  onClick={() => handleSilenciarAlarme(activeCase.numero)}
                                  className="mt-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-slate-800 border border-amber-200 text-[9px] font-bold rounded-lg cursor-pointer transition-colors"
                                >
                                  Silenciar Alarme / Concluir Prazo
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Historical acts Timeline view */}
                          <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              <span>🧾 Linha de Tempo de Atos Processuais</span>
                              <span className="font-mono text-[9px] text-slate-400">({(activeCase.historicoAtos || []).length} Atos)</span>
                            </h3>

                            {/* Standard direct act insertion widget */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Averbar Ato Judicial Manual</span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  id={`quick-desc-${activeCase.numero}`}
                                  placeholder="Descrição do novo despacho, cota judicial ou audiência..."
                                  className="flex-1 px-2.5 py-1 bg-white border border-slate-205 rounded-lg text-[10px] focus:outline-hidden"
                                />
                                <select
                                  id={`quick-tipo-${activeCase.numero}`}
                                  className="bg-white border border-slate-205 rounded-lg text-[10px] font-bold px-1.5"
                                >
                                  <option value="Despacho / Decisão">Despacho</option>
                                  <option value="Notificação / Bilhete">Notificação</option>
                                  <option value="Audiência / Sessão">Audiência</option>
                                  <option value="Diligência Externa">Diligência</option>
                                </select>
                                <button
                                  onClick={() => {
                                    const input = document.getElementById(`quick-desc-${activeCase.numero}`) as HTMLInputElement;
                                    const sel = document.getElementById(`quick-tipo-${activeCase.numero}`) as HTMLSelectElement;
                                    if (input && input.value.trim()) {
                                      handleAddAtoDirectly(activeCase.numero, input.value, sel.value);
                                      input.value = '';
                                    }
                                  }}
                                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                >
                                  Averbar
                                </button>
                              </div>
                            </div>

                            <div className="relative pl-4 border-l-2 border-slate-150 space-y-4 pt-1.5">
                              {((activeCase.historicoAtos || [])).length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic pl-2 py-2">Sem atos registados de momento.</p>
                              ) : (
                                [...(activeCase.historicoAtos || [])]
                                  .sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                                  .map((at) => {
                                    return (
                                      <div key={at.id} className="relative group/timeline bg-slate-50/40 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                        {/* Dot on line */}
                                        <div className="absolute top-4 -left-[21px] w-2.5 h-2.5 rounded-full border-2 border-white bg-blue-600 scale-100 group-hover/timeline:scale-130 transition-transform"></div>
                                        
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider font-mono">
                                              {at.tipoAto || "Ato"}
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400 font-mono">
                                              {at.data}
                                            </span>
                                          </div>
                                          <span className="text-[9px] text-slate-400 italic">
                                            Fase: {at.fase}
                                          </span>
                                        </div>

                                        <p className="text-xs text-slate-750 font-medium py-1 select-text">
                                          {at.descricao}
                                        </p>

                                        {/* Associated Documents link badges */}
                                        {at.documentosIds && at.documentosIds.length > 0 && (
                                          <div className="pt-2 flex flex-wrap gap-1 border-t border-dashed border-slate-150">
                                            {at.documentosIds.map((docId) => {
                                              const docObj = activeCase.documentos.find(d => d.id === docId);
                                              if (!docObj) return null;
                                              return (
                                                <button
                                                  key={docId}
                                                  onClick={() => {
                                                    setSecretariaActiveDoc(docObj);
                                                    setSecretariaRightTab('viewer');
                                                  }}
                                                  className={`text-[9px] px-2 py-0.8 bg-white border rounded flex items-center gap-1 font-bold cursor-pointer transition-colors ${
                                                    secretariaActiveDoc?.id === docId
                                                      ? 'border-blue-500 text-blue-600 shadow-xs bg-blue-50/20'
                                                      : 'border-slate-205 text-slate-600 hover:text-blue-500 hover:border-blue-300'
                                                  }`}
                                                  title="Ver Ficheiro no Visualizador Lateral"
                                                >
                                                  📄 {docObj.nome} (Ecrã Dividido)
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>

                          {/* Apensos related to active case list */}
                          {linkedApensos.length > 0 && (
                            <div className="space-y-3 pt-3 border-t border-slate-100">
                              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display flex items-center gap-1.5">
                                🔗 Apensos & Incidentes Apensados ({linkedApensos.length})
                              </h3>
                              <div className="grid grid-cols-1 gap-2.5">
                                {linkedApensos.map((ap) => (
                                  <div key={ap.numero} className="p-3 bg-indigo-50/30 border border-indigo-200/50 rounded-xl flex items-center justify-between gap-3 scale-98 hover:scale-100 transition-transform">
                                    <div className="space-y-0.5 text-xs">
                                      <p className="font-mono font-bold text-slate-800 select-all">{ap.numero}</p>
                                      <p className="text-[10px] text-slate-500 font-medium">Autores: {ap.autores.join(', ')} • Rréus: {ap.reus.join(', ')}</p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setSecretariaSelectedNum(ap.numero);
                                        setSecretariaActiveDoc(null);
                                        if (ap.documentos && ap.documentos.length > 0) {
                                          setSecretariaActiveDoc(ap.documentos[0]);
                                        }
                                        setSecretariaRightTab('viewer');
                                      }}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                                    >
                                      Abrir Apenso
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Folder contents list folder block */}
                          <div className="space-y-3 pt-2">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              📂 Arquivo Geral de Documentos ({activeCase.documentos.filter(d => !d.deleted).length} Ficheiros)
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                              {activeCase.documentos.filter(d => !d.deleted).length === 0 ? (
                                <p className="text-xs italic text-slate-400 pl-1">Sem peças processuais indexadas.</p>
                              ) : (
                                activeCase.documentos.filter(d => !d.deleted).map((doc) => {
                                  const isSelDoc = secretariaActiveDoc?.id === doc.id;
                                  return (
                                    <div
                                      key={doc.id}
                                      onClick={() => {
                                        setSecretariaActiveDoc(doc);
                                        setSecretariaRightTab('viewer');
                                      }}
                                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs cursor-pointer select-none transition-all ${
                                        isSelDoc
                                          ? 'border-blue-500 bg-blue-50/20 shadow-xs'
                                          : 'border-slate-150 bg-slate-50/10 hover:bg-slate-50 hover:border-slate-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 truncate">
                                        <FileText className={`h-4.5 w-4.5 shrink-0 ${isSelDoc ? 'text-blue-500' : 'text-slate-450'}`} />
                                        <div className="truncate text-left">
                                          <p className="font-bold text-slate-800 truncate select-all">{doc.nome}</p>
                                          <span className="text-[9px] font-mono text-slate-400">
                                            {doc.categoria} • {doc.tamanho}
                                          </span>
                                        </div>
                                      </div>
                                      
                                      <span className="text-[9px] bg-slate-200 text-slate-600 font-mono px-1.5 py-0.2 rounded shrink-0">
                                        Ecrã Dividido →
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    ) : (
                      /* No Case Selected landing card */
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
                        <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold shadow-xs animate-bounce duration-1000">
                          ⚖️
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mt-4 font-display">
                          Secretaria Digital Ativa • Trabalho em Série
                        </h2>
                        <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                          Selecione um processo na listagem da esquerda para abrir a linha de tempo de atos e carregar as ferramentas de ecrã dividido na coluna direita.
                        </p>
                        
                        {/* Quick system global metrics widgets */}
                        <div className="grid grid-cols-2 gap-4 mt-6 w-full max-w-sm">
                          <div className="p-4 bg-white border border-slate-250/65 rounded-2xl text-left shadow-xs">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acórdãos pendentes</p>
                            <p className="text-xl font-bold text-slate-800 font-display mt-1">11 Ativos</p>
                          </div>
                          <div className="p-4 bg-white border border-slate-250/65 rounded-2xl text-left shadow-xs">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Prazos urgentes</p>
                            <p className="text-xl font-bold text-rose-600 font-display mt-1">2 Iminentes</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* COLUMN 3: Customizable Deck (Document Split viewer, OCR Scanner, Notifications Generator, Local Database, Calendar Agenda) (34%) */}
                  <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs h-full">
                    {/* Column Tabs */}
                    <div className="flex border-b border-slate-100 bg-slate-50/60 shrink-0 text-xs text-slate-500 overflow-x-auto gap-0.5 no-print select-none">
                      <button
                        onClick={() => setSecretariaRightTab('viewer')}
                        className={`py-3 px-3 flex-1 min-w-[80px] text-center font-bold transition-all border-b-2 font-display flex items-center justify-center gap-1 cursor-pointer ${
                          secretariaRightTab === 'viewer'
                            ? 'border-blue-600 text-blue-600 bg-white font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        👁️ Split-View
                      </button>
                      <button
                        onClick={() => {
                          setSecretariaRightTab('notificar');
                          // Default first recipient and template if active case
                          if (activeCase) {
                            setSecretariaSelectedRecipient(activeCase.autores[0]);
                            const tmpl = getFormModelos()[0];
                            if (tmpl) {
                              setSecretariaTemplateId(tmpl.id);
                              setSecretariaDraftText(tmpl.texto);
                            }
                          }
                        }}
                        className={`py-3 px-3 flex-1 min-w-[80px] text-center font-bold transition-all border-b-2 font-display flex items-center justify-center gap-1 cursor-pointer ${
                          secretariaRightTab === 'notificar'
                            ? 'border-blue-600 text-blue-600 bg-white font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        ✍️ Minutar
                      </button>

                      <button
                        onClick={() => setSecretariaRightTab('agenda')}
                        className={`py-3 px-3 flex-1 min-w-[80px] text-center font-bold transition-all border-b-2 font-display flex items-center justify-center gap-1 cursor-pointer ${
                          secretariaRightTab === 'agenda'
                            ? 'border-blue-600 text-blue-600 bg-white font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        📅 Agenda
                      </button>
                      <button
                        onClick={() => setSecretariaRightTab('db_control')}
                        className={`py-3 px-3 flex-1 min-w-[80px] text-center font-bold transition-all border-b-2 font-display flex items-center justify-center gap-1 cursor-pointer ${
                          secretariaRightTab === 'db_control'
                            ? 'border-blue-600 text-blue-600 bg-white font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        🗄️ Local DB
                      </button>
                    </div>

                    {/* Column content */}
                    <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
                      
                      {/* SUBTAB 1: Document Split Visualizer with OCR Labels & Zoom */}
                      {secretariaRightTab === 'viewer' && (
                        <div className="space-y-4 h-full flex flex-col justify-between">
                          {secretariaActiveDoc ? (
                            <div className="space-y-4 flex flex-col h-full">
                              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs shrink-0 flex items-center justify-between gap-3">
                                <div className="truncate text-left text-xs font-semibold">
                                  <p className="text-slate-400 mb-0.5">Ficheiro Aberto em Split-Screen</p>
                                  <p className="font-extrabold text-slate-800 text-xs truncate max-w-[200px] select-all">{secretariaActiveDoc.nome}</p>
                                </div>
                                <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold border border-emerald-250 px-2.5 py-1 rounded-full shrink-0">
                                  ✓ Cópia Autêntica Indexed
                                </span>
                              </div>

                              {/* Document controls tool bar */}
                              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl text-xs shrink-0 select-none font-medium">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-500">Tamanho da Letra:</span>
                                  <button onClick={() => setPreviewDoc(secretariaActiveDoc)} className="p-1 underline hover:text-blue-500 font-bold">Maxímo</button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input 
                                    type="checkbox" 
                                    id="highlight-trigger-clerk" 
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    defaultChecked={true}
                                  />
                                  <label htmlFor="highlight-trigger-clerk" className="text-slate-650 cursor-pointer text-[10px] font-bold">Ressaltar Entidades OCR</label>
                                </div>
                              </div>

                               {/* Structured Mock PDF Paper sheet */}
                              <div className="flex-1 bg-white border border-slate-200 p-6 rounded-xl shadow-xs overflow-y-auto font-sans leading-relaxed text-xs">
                                
                                <div className="space-y-3 font-sans select-text text-slate-800 min-h-[300px]">
                                  {/* Render mock file contents */}
                                  {secretariaActiveDoc.conteudoUrl && secretariaActiveDoc.conteudoUrl.startsWith('data:application/pdf') ? (
                                    <div className="w-full h-[65vh] border border-slate-200 rounded-lg overflow-hidden bg-slate-100 flex flex-col">
                                      <iframe
                                        src={secretariaActiveDoc.conteudoUrl}
                                        className="w-full h-full border-0"
                                        title="Leitor de PDF integrado"
                                      >
                                        <p className="p-4 text-xs text-slate-500 text-center">
                                          O seu navegador não suporta a visualização direta de PDFs. 
                                          <a href={secretariaActiveDoc.conteudoUrl} download={secretariaActiveDoc.nome} className="text-blue-600 underline ml-1 font-bold">Clique aqui para descarregar.</a>
                                        </p>
                                      </iframe>
                                    </div>
                                  ) : (
                                    <div className="whitespace-pre-wrap select-text">
                                      {secretariaActiveDoc.conteudoTexto || (
                                        `CONTEÚDOS DIGITAIS DO FICHEIRO LEGAL\n\nFicheiro: ${secretariaActiveDoc.nome}\nCategoria: ${secretariaActiveDoc.categoria}\nAutor do Registo: ${secretariaActiveDoc.parteApresentante}\nData Registo: ${secretariaActiveDoc.dataApresentacao}\n\nEste documento cumpre todos os requisitos do Código de Processo Civil Português relativamente à instrução mecânica e autuação.\n\nSelo Digital do Tribunal: COMARCA-TRIBUNAL-OK.`
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Sidebar summary information derived from active case metadata */}
                                <div className="mt-6 p-3.5 bg-blue-50/40 border border-blue-200 rounded-xl space-y-2 text-left shrink-0">
                                  <h4 className="text-[10px] font-black uppercase text-blue-800 tracking-wider flex items-center gap-1.5 select-none">
                                    💡 OCR Metadados & Entidades Detetadas
                                  </h4>
                                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-650 font-medium">
                                    <div>
                                      <span className="text-slate-400 block">Número Litígio:</span>
                                      <strong className="text-slate-800 select-all">{activeCase.numero}</strong>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">Sujeito Ativo:</span>
                                      <strong className="text-slate-800">{activeCase.autores[0]}</strong>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">Sujeito Passivo:</span>
                                      <strong className="text-slate-800">{activeCase.reus[0]}</strong>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">Juiz Atribuído:</span>
                                      <strong className="text-slate-800">{activeCase.juizTitular}</strong>
                                    </div>
                                  </div>
                                </div>

                              </div>

                              {/* Paper action buttons floor */}
                              {!(secretariaActiveDoc.conteudoUrl && secretariaActiveDoc.conteudoUrl.startsWith('data:application/pdf')) && (
                                <div className="flex gap-2 shrink-0 pt-2 border-t border-slate-100 bg-white p-3 rounded-xl border border-slate-150">
                                  <button
                                    onClick={() => handlePrintFile(secretariaActiveDoc)}
                                    className="flex-1 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-2"
                                  >
                                    <Printer className="h-4 w-4" /> Imprimir
                                  </button>
                                  <button
                                    onClick={() => handleDownloadFile(secretariaActiveDoc)}
                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center justify-center gap-2 font-display"
                                  >
                                    <Download className="h-4 w-4" /> Baixar PDF
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-12">
                              <span className="text-3xl block mb-2">📄</span>
                              <p className="text-xs italic max-w-xs">Selecione uma peça processual na listagem central para carregar o visualizador em split-screen com análise OCR de apoio.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUBTAB 2: Smart Notification draft form generator */}
                      {secretariaRightTab === 'notificar' && (
                        <div className="space-y-4">
                          {activeCase ? (
                            <div className="space-y-4">
                              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-xs space-y-4 text-left">
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display flex items-center gap-1.5 pb-2 border-b border-slate-100">
                                  <span>✍️</span> Gerador de Minutas & Notificações Oficiais
                                </h3>
                                
                                <p className="text-[11px] text-slate-550 leading-relaxed">
                                  Gere e expede certidões processuais com preenchimento automático das variáveis associadas à ficha do processo ({activeCase.numero}).
                                </p>

                                {/* Template selector dropdown */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Escolha a Peça / Minuta Modelo</label>
                                  <select
                                    value={secretariaTemplateId}
                                    onChange={(e) => {
                                      setSecretariaTemplateId(e.target.value);
                                      const found = getFormModelos().find(m => m.id === e.target.value);
                                      if (found) {
                                        setSecretariaDraftText(found.texto);
                                      }
                                    }}
                                    className="w-full bg-slate-50 border border-slate-205 rounded-lg text-xs font-semibold p-2 focus:outline-hidden cursor-pointer"
                                  >
                                    {getFormModelos().map((m) => (
                                      <option key={m.id} value={m.id}>{m.nome}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Tribunal / Comarca Selector */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tribunal / Comarca (Cabeçalho do Documento)</label>
                                  <select
                                    value={secretariaSelectedTribunalId}
                                    onChange={(e) => setSecretariaSelectedTribunalId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-205 rounded-lg text-xs font-semibold p-2 focus:outline-hidden cursor-pointer"
                                  >
                                    <option value="">-- Sem Associação / Geral --</option>
                                    {tribunaisList.map((t) => (
                                      <option key={t.id} value={t.id}>{t.tribunal} ({t.localidade})</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Dynamic Recipient select derived from active case actual participants list */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Selecionar Destinatário da Notificação</label>
                                  <select
                                    value={secretariaSelectedRecipient}
                                    onChange={(e) => setSecretariaSelectedRecipient(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-205 rounded-lg text-xs font-semibold p-2 focus:outline-hidden cursor-pointer"
                                  >
                                    {/* Union of Authors, Defendants, Lawyers, Procuradores */}
                                    {[
                                      ...activeCase.autores.map(a => `Autor: ${a}`),
                                      ...activeCase.reus.map(r => `Réu: ${r}`),
                                      ...activeCase.advogadosAutor.map(adv => `Advogado Autor: ${adv}`),
                                      ...activeCase.advogadosReu.map(adv => `Advogado Réu: ${adv}`),
                                      ...(activeCase.procuradores || []).map(p => `Procurador: ${p}`)
                                    ].map((party) => (
                                      <option key={party} value={party.split(': ').slice(1).join(': ')}>{party}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Dactilography Editor draft raw editor */}
                                <div className="space-y-1 pt-1">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between items-center">
                                    <span>🖋️ Dactilografar Corpo do Texto</span>
                                    <span className="text-[9px] text-[#2563EB] font-serif italic">Variáveis ativas: PROCESSO, JUIZ, RECIPIENT</span>
                                  </label>
                                  <textarea
                                    rows={6}
                                    value={secretariaDraftText}
                                    onChange={(e) => setSecretariaDraftText(e.target.value)}
                                    className="w-full text-xs font-mono p-3 bg-white border border-slate-250 rounded-xl leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                    placeholder="Escreva e use os marcadores {{PROCESSO}} ou {{RECIPIENT}}..."
                                  />
                                </div>

                                {/* Real-time Compiled Document high-fidelity Legal Paper previewer */}
                                <div className="space-y-1 pt-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block text-left">
                                    📄 Visualização da Peça Autopreenchida (Impressão legal)
                                  </label>
                                  <div className="bg-white border-2 border-slate-300 p-5 rounded-lg shadow-inner text-[10px] font-serif text-slate-900 leading-relaxed max-h-[220px] overflow-y-auto select-none border-t-[10px] border-t-slate-800">
                                    <div className="text-center font-bold pb-2 border-b border-slate-200 mb-2 uppercase text-[9px] tracking-widest font-mono text-slate-500">
                                      REPÚBLICA PORTUGUESA • TRIBUNAL LOCAL
                                    </div>
                                    <p className="whitespace-pre-wrap select-text font-serif">
                                      {secretariaDraftText
                                        .replace(/\{\{PROCESSO\}\}/g, activeCase.numero || '')
                                        .replace(/\{\{JUIZ\}\}/g, activeCase.juizTitular || '')
                                        .replace(/\{\{RECIPIENT\}\}/g, secretariaSelectedRecipient || '')
                                        .replace(/\{\{AUTOR\}\}/g, activeCase.autores.join(', ') || '')
                                        .replace(/\{\{REU\}\}/g, activeCase.reus.join(', ') || '')
                                        .replace(/\{\{DATE\}\}/g, new Date().toISOString().substring(0, 10))
                                        .replace(/\{\{TIPO\}\}/g, activeCase.tipo === 'crime' ? 'Crime' : 'Cível')
                                        .replace(/\{\{TRIBUNAL\}\}/g, "Tribunal Judicial da Comarca do Porto")
                                      }
                                    </p>
                                    <div className="pt-3 border-t border-slate-100 text-[8px] text-slate-400 font-mono text-center mt-3">
                                      [ ASSINADO DIGITALMENTE POR CHAVE DE EXPEDIENTE SECRETARIA DELA_F_T ]
                                    </div>
                                  </div>
                                </div>

                                {/* Despache Dispatch button */}
                                <button
                                  type="button"
                                  onClick={handleEmitNotification}
                                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs font-display flex items-center justify-center gap-1.5"
                                >
                                  ⚖️ Emitir Notificação e Gravar Regulamento
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-12">
                              <span className="text-3xl block mb-2">✍️</span>
                              <p className="text-xs italic max-w-xs">Selecione um processo do tribunal para minutar e emitir notificações oficiais usando o gerador de minutas inteligente.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* SUBTAB 4: Calendar judicial scheduler deadlines view */}
                      {secretariaRightTab === 'agenda' && (
                        <div className="space-y-4">
                          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-xs space-y-4 text-left">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display flex items-center gap-1.5">
                                <span>📅</span> Agenda Judiciária & Próximas Audiências
                              </h3>
                              <button
                                onClick={() => setAgendaShowForm(!agendaShowForm)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                {agendaShowForm ? "Ver Eventos" : "+ Agendar"}
                              </button>
                            </div>

                            {agendaSuccess && (
                              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-250 text-[10px] font-bold rounded-lg">
                                {agendaSuccess}
                              </div>
                            )}

                            {agendaShowForm ? (
                              <form onSubmit={handleAddLiveAgendaEvent} className="space-y-2.5 leading-normal">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Novo Agendamento na Comarca</span>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-slate-500 font-bold">Título do Evento</label>
                                  <input
                                    type="text"
                                    value={novaAgendaTitle}
                                    onChange={(e) => setNovaAgendaTitle(e.target.value)}
                                    placeholder="Ex: Julgamento das Peças / Inquirição..."
                                    required
                                    className="w-full bg-slate-50 border p-1 rounded font-medium focus:outline-hidden"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-bold">Processo Assoc.</label>
                                    <select
                                      value={novaAgendaProcess}
                                      onChange={(e) => setNovaAgendaProcess(e.target.value)}
                                      className="w-full bg-slate-50 border p-1 rounded font-semibold focus:outline-hidden"
                                    >
                                      <option value="">Sem Associação</option>
                                      {processosList.filter(p => !p.deleted).map(p => (
                                        <option key={p.numero} value={p.numero}>{p.numero}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-bold">Categoria</label>
                                    <select
                                      value={novaAgendaType}
                                      onChange={(e) => setNovaAgendaType(e.target.value as any)}
                                      className="w-full bg-slate-50 border p-1 rounded font-semibold focus:outline-hidden"
                                    >
                                      <option value="audiência">Julgamento / Audiência</option>
                                      <option value="prazos">Prazo Limite / Alerta</option>
                                      <option value="conferência">Mediação / Conferência</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-bold">Dia (Data)</label>
                                    <input
                                      type="date"
                                      value={novaAgendaDate}
                                      onChange={(e) => setNovaAgendaDate(e.target.value)}
                                      className="w-full bg-slate-50 border p-1 rounded font-semibold focus:outline-hidden"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 font-bold">Hora</label>
                                    <input
                                      type="time"
                                      value={novaAgendaTime}
                                      onChange={(e) => setNovaAgendaTime(e.target.value)}
                                      className="w-full bg-slate-50 border p-1 rounded font-semibold focus:outline-hidden"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-slate-500 font-bold">Instruções / Sala de Tribunal</label>
                                  <textarea
                                    rows={2}
                                    value={novaAgendaDetails}
                                    onChange={(e) => setNovaAgendaDetails(e.target.value)}
                                    placeholder="Ex: Sala III de Julgamento Civil. Trazer relatórios adicionais."
                                    className="w-full bg-slate-50 border p-2 rounded focus:outline-hidden text-[10px]"
                                  />
                                </div>
                                <button
                                  type="submit"
                                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold cursor-pointer"
                                >
                                  Inserir na Escala Geral
                                </button>
                              </form>
                            ) : (
                              <div className="space-y-3">
                                <div className="relative pl-0 space-y-3 max-h-[400px] overflow-y-auto">
                                  {agendaEvents.map((evt) => {
                                    const todayVal = new Date('2026-05-30').getTime(); // Presumed standard local metadata time YYYY-MM-DD
                                    const eventVal = new Date(evt.date).getTime();
                                    const isDone = evt.status === 'cumprido';
                                    
                                    let priorityBadge = "bg-blue-50 text-blue-750";
                                    let priorityLabel = "Futuro";
                                    if (eventVal < todayVal) {
                                      priorityBadge = "bg-rose-50 text-rose-700 border border-rose-100";
                                      priorityLabel = "PRAZO CADUCADO / RETRANSMITIDO";
                                    } else if (eventVal - todayVal <= 3 * 24 * 60 * 60 * 1000) {
                                      priorityBadge = "bg-amber-50 text-amber-800 border border-amber-200";
                                      priorityLabel = "URGENTE / PRÓXIMO 3 DIAS";
                                    }

                                    return (
                                      <div key={evt.id} className={`p-3 rounded-xl border relative transition-all ${
                                        isDone 
                                          ? 'border-emerald-250 bg-emerald-50/20 opacity-60 line-through' 
                                          : 'border-slate-200 bg-white hover:border-slate-350'
                                      }`}>
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full ${
                                              evt.type === 'audiência' ? 'bg-orange-50 text-orange-700' : 'bg-indigo-50 text-indigo-700'
                                            }`}>
                                              {evt.type}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-800 font-mono">
                                              📅 {evt.date} • {evt.time}
                                            </span>
                                          </div>
                                          {!isDone && (
                                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${priorityBadge}`}>
                                              {priorityLabel}
                                            </span>
                                          )}
                                        </div>

                                        <p className="text-xs font-bold text-slate-900 mt-1.5 leading-tight">
                                          {evt.title}
                                        </p>
                                        
                                        <div className="text-[10px] text-slate-500 mt-1 leading-normal font-sans">
                                          <p><span className="text-slate-400 font-semibold font-sans">Processo Relacionado:</span> <strong className="font-mono text-slate-700 select-all">{evt.processNum}</strong></p>
                                          <p className="pt-0.5 text-slate-650">{evt.details}</p>
                                        </div>

                                        <div className="mt-2 text-right">
                                          <button
                                            onClick={() => handleToggleEventStatus(evt.id)}
                                            className={`px-2 py-0.8 rounded text-[9px] font-bold transition-all shrink-0 cursor-pointer ${
                                              isDone 
                                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-500' 
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                            }`}
                                          >
                                            {isDone ? "Marcar Pendente" : "✓ Diligência Cumprida / Arquivar Evento"}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {/* SUBTAB 5: Local Database Diagnostics control block */}
                      {secretariaRightTab === 'db_control' && (
                        <div className="space-y-4">
                          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs text-xs text-left space-y-4">
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display flex items-center gap-1.5 pb-2 border-b border-slate-100">
                              <span>🗄️</span> Painel & Rastreio de Saúde do Banco Local
                            </h3>

                            <p className="text-[11px] text-slate-550 leading-relaxed">
                              Permite inspecionar a alocação de armazenamento e calibrar de forma limpa as chaves relacionais da base de dados local do utilizador no browser (LocalStorage), garantindo um funcionamento offline robusto.
                            </p>

                            {/* Storage Gauge progress bar */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">LocalStorage Quota</span>
                              <div className="flex justify-between text-xs font-mono font-bold text-slate-700 pb-0.5">
                                <span>Alocação Dispositivo</span>
                                <span>{(JSON.stringify(localStorage).length / 1024).toFixed(1)} KB / 5,120 KB</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${Math.max(1.5, (JSON.stringify(localStorage).length / (5120 * 1024)) * 100)}%` }}
                                ></div>
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono text-center">Índices relacionais de procura: 100% integrados em árvore.</p>
                            </div>

                            {/* Diagnose & Healing section with SQL Terminal Emulator */}
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleDiagnoseAndHealDatabase}
                                  disabled={isDbHealing}
                                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-lg text-[10px] cursor-pointer inline-flex items-center justify-center gap-1.5"
                                >
                                  {isDbHealing ? "A Executar..." : "🔍 Iniciar Autodiagnóstico & Healer"}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDbVacuum}
                                  disabled={isDbVacuuming}
                                  className="flex-1 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-lg text-[10px] cursor-pointer inline-flex items-center justify-center gap-1.5"
                                >
                                  {isDbVacuuming ? "Compilando..." : "🧹 Executar VACUUM Compactação"}
                                </button>
                              </div>

                              {dbVacuumResult && (
                                <p className="p-2.5 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded text-[10px] font-mono leading-relaxed px-3">
                                  {dbVacuumResult}
                                </p>
                              )}

                              {/* Styled Dark Linux SQL CLI Console log */}
                              {(isDbHealing || dbHealingOutput.length > 0) && (
                                <div className="p-4 bg-slate-950 font-mono text-[10px] leading-relaxed text-emerald-400 rounded-xl max-h-[180px] overflow-y-auto shadow-inner text-left tracking-wide select-all border-l-4 border-l-emerald-500">
                                  {dbHealingOutput.map((line, idx) => (
                                    <p key={idx} className={line.startsWith('[HEALED]') ? 'text-cyan-400 font-bold mt-1' : line.startsWith('$') ? 'text-slate-400' : ''}>
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>

                            <p className="text-[10px] text-slate-400 font-sans italic leading-relaxed pt-1.5 border-t border-slate-100">
                              ℹ️ <strong>Sugestão técnica de escalabilidade:</strong> Para ultrapassar as limitações de quota de 5MB do LocalStorage inerentes aos navegadores Web, recomenda-se em produção a migração do driver local para <strong>IndexedDB (Dexie.js)</strong> ou <strong>SQLite compilado em WebAssembly (SQLite-WASM CO-OPFS)</strong>. Isto garante suporte persistente assíncrono até Gigabit, permitindo guardar milhões de peças digitalizadas no próprio browser.
                            </p>

                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                </div>
              );
            })()}

              {/* TAB 1: Process Multi-Criteria Search */}
              {activeTab === 'pesquisa' && (
                <div className="w-full max-w-3xl mx-auto space-y-6">
                  {/* Title & Help */}
                  <div className="flex justify-between items-center shrink-0">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight font-display">
                        Pesquisa e Consulta Processual
                      </h2>
                      <p className="text-xs text-slate-550 mt-1 font-medium">
                        Utilize os critérios em baixo para filtrar os processos guardados no dispositivo
                      </p>
                    </div>
                  </div>

                  {/* Multi-criteria filter form */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
                    <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                      <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        Parâmetros de Pesquisa Avançada
                      </span>
                      <button
                        onClick={clearFilters}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-xl bg-white shadow-3xs transition-all cursor-pointer"
                      >
                        Limpar Filtros
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-1">
                      <div>
                        <label className="block text-xs text-slate-550 font-bold uppercase tracking-wider mb-2">Nº do Processo</label>
                        <input
                          type="text"
                          value={filterNumero}
                          onChange={(e) => setFilterNumero(e.target.value)}
                          placeholder="ex: PROC-2026/101"
                          className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-200 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-550 font-bold uppercase tracking-wider mb-2">Parte (Autor ou Réu)</label>
                        <input
                          type="text"
                          value={filterParte}
                          onChange={(e) => setFilterParte(e.target.value)}
                          placeholder="Nome, telefone ou BI..."
                          className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-550 font-bold uppercase tracking-wider mb-2">Data de Autuação</label>
                        <input
                          type="date"
                          value={filterData}
                          onChange={(e) => setFilterData(e.target.value)}
                          className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-855 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-200 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-550 font-bold uppercase tracking-wider mb-2">Juiz Titular</label>
                        <input
                          type="text"
                          value={filterJuiz}
                          onChange={(e) => setFilterJuiz(e.target.value)}
                          placeholder="Nome do juiz titular..."
                          className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-550 font-bold uppercase tracking-wider mb-2">Advogado (Autor ou Réu)</label>
                        <input
                          type="text"
                          value={filterAdvogado}
                          onChange={(e) => setFilterAdvogado(e.target.value)}
                          placeholder="ex: Dr. Fonseca ou Dra. Vasconcelos"
                          className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-200"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-550 font-bold uppercase tracking-wider mb-2">Procurador</label>
                        <input
                          type="text"
                          value={filterProcurador}
                          onChange={(e) => setFilterProcurador(e.target.value)}
                          placeholder="Nome do procurador..."
                          className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-200"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-xs text-slate-550 font-bold uppercase tracking-wider mb-2">Funcionário do Processo</label>
                        <input
                          type="text"
                          value={filterFuncionario}
                          onChange={(e) => setFilterFuncionario(e.target.value)}
                          placeholder="ex: Oficial de justiça ou escrivão associado..."
                          className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-205"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Results List */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Resultados Encontrados ({filteredProcessos.length})
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {filteredProcessos.length > 0 ? (
                        filteredProcessos.map((p) => {
                          const isAlarmed = isProcessoAlarmado(p);
                          return (
                            <div 
                              key={p.numero}
                              className={`px-6 py-5 border-b border-slate-50 last:border-b-0 transition-colors text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                isAlarmed 
                                  ? 'bg-amber-50/70 border-l-4 border-l-amber-500 shadow-3xs' 
                                  : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="space-y-2 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => handleOpenProcessoInNewTab(p.numero)}
                                    className={`text-[15px] font-bold font-mono hover:underline cursor-pointer transition-colors ${
                                      isAlarmed 
                                        ? 'text-red-800 bg-red-100/90 px-2 py-0.5 rounded border border-red-200 font-bold' 
                                        : 'text-slate-900 hover:text-blue-600'
                                    }`}
                                  >
                                    {p.numero} {isAlarmed ? '⏰⚠️' : ''}
                                  </button>
                                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-500">
                                    Autuação: {p.dataAutuacao}
                                  </span>
                                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-150 px-2 py-0.5 rounded font-medium">
                                    📂 {p.documentos.filter(d => !d.deleted).length} docs
                                  </span>
                                  {p.tipo === 'civel' && p.valorAcao !== undefined && (
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-250 px-2 py-0.5 rounded font-bold">
                                      Valor: {p.valorAcao.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                                    </span>
                                  )}
                                  {p.faseAtual && (
                                    <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-150 px-2 py-0.5 rounded font-bold">
                                      Fase: {p.faseAtual}
                                    </span>
                                  )}
                                  {isAlarmed && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded animate-bounce">
                                      ALERTA ATIVO
                                    </span>
                                  )}
                                </div>

                              {/* Autores & Réus summary */}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Membro Autor:</span>{' '}
                                  <span className="font-semibold text-slate-700">{p.autores.join(', ')}</span>
                                </div>
                                <span className="text-slate-300">|</span>
                                <div>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Membro Réu:</span>{' '}
                                  <span className="font-semibold text-slate-700">{p.reus.join(', ')}</span>
                                </div>
                              </div>

                              {/* Judge & Lawyers summary */}
                              <div className="text-[11px] text-slate-400">
                                Juiz: <strong className="text-slate-600">{p.juizTitular}</strong> • Advogados: <strong className="text-slate-500">{p.advogadosAutor.concat(p.advogadosReu).join(', ') || 'Nenhum'}</strong>
                              </div>
                            </div>

                            {/* Chevron Action */}
                            <button
                              onClick={() => handleOpenProcessoInNewTab(p.numero)}
                              className="px-4 py-2 border border-slate-200 hover:border-slate-350 bg-white shadow-xs font-semibold rounded-lg text-xs text-slate-700 hover:text-slate-900 transition-colors cursor-pointer flex items-center gap-1.5 self-start md:self-center"
                            >
                              <span>Visualizar Processo</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })
                      ) : (
                        <div className="p-16 text-center text-slate-400">
                          <FolderSearch className="h-10 w-10 mx-auto stroke-[1.2] text-slate-300 mb-2" />
                          <p className="text-sm font-bold text-slate-600">Nenhum processo corresponde aos critérios.</p>
                          <p className="text-xs text-slate-400 mt-1">Limpe os filtros de pesquisa ou registe novos processos.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Processo Registration Form */}
              {activeTab === 'registo' && (
                <div className="w-full max-w-3xl mx-auto space-y-6">
                  <form onSubmit={handleRegisterProcessoSubmit} className="space-y-8">
                    {regError && (
                      <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-800 flex items-start gap-3 shadow-3xs">
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-650" />
                        <span className="font-medium">{regError}</span>
                      </div>
                    )}

                    {regSuccess && (
                      <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-3 shadow-3xs">
                        <UserCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                        <span className="font-medium">{regSuccess}</span>
                      </div>
                    )}

                    {/* Step Section 1: Process identification */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6">
                      {/* Natureza do Processo (Crime vs Civel) Selector */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100 rounded-2xl p-6 space-y-4 shadow-3xs">
                        <div>
                          <span className="text-sm font-bold text-slate-800 uppercase tracking-wider block font-display">
                            Natureza do Processo Judicial *
                          </span>
                          <span className="text-xs text-slate-500 block mt-1 font-medium">
                            Comece por especificar se se trata de um processo do âmbito Crime ou Cível. Isto definirá as regras e classificações de documentos disponíveis.
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <button
                            type="button"
                            onClick={() => setRegProcessoTipo('crime')}
                            className={`flex items-center gap-5 p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                              regProcessoTipo === 'crime'
                                ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-100'
                                : 'bg-slate-50/40 hover:bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className={`p-3 rounded-xl text-2xl ${regProcessoTipo === 'crime' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100/85 text-slate-500'}`}>
                              ⚖️
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${regProcessoTipo === 'crime' ? 'text-blue-900' : 'text-slate-700'}`}>Processo Crime</p>
                              <p className="text-xs text-slate-455 mt-0.5 leading-relaxed">Foco penal, inquéritos constitutivos, denúncias e acusação crime.</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRegProcessoTipo('civel')}
                            className={`flex items-center gap-5 p-5 rounded-xl border text-left transition-all duration-250 cursor-pointer ${
                              regProcessoTipo === 'civel'
                                ? 'bg-white border-blue-500 shadow-sm ring-2 ring-blue-100'
                                : 'bg-slate-50/40 hover:bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className={`p-3 rounded-xl text-2xl ${regProcessoTipo === 'civel' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100/85 text-slate-500'}`}>
                              💼
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${regProcessoTipo === 'civel' ? 'text-blue-900' : 'text-slate-700'}`}>Processo Cível</p>
                              <p className="text-xs text-slate-455 mt-0.5 leading-relaxed">Foco comercial e civil, petições de direitos, contratos e heranças.</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Tipo de Registo selector */}
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-sm font-bold text-slate-800 block">Tipo de Registo Judicial</span>
                          <span className="text-xs text-slate-450 block mt-1">Defina se está a registar um processo independente ou um apenso/derivado.</span>
                        </div>
                        <div className="flex gap-6">
                          <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="regType"
                              checked={!isApenso}
                              onChange={() => {
                                setIsApenso(false);
                                setParentProcessoSeleccionado('');
                                setApensoSearchQuery('');
                                setIsAutocompleteDropdownOpen(false);
                                setAutores([]);
                                setReus([]);
                                setAdvogadosAutor([]);
                                setAdvogadosReu([]);
                              }}
                              className="accent-blue-600 h-5 w-5"
                            />
                            Processo Principal
                          </label>
                          <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="regType"
                              checked={isApenso}
                              onChange={() => {
                                setIsApenso(true);
                              }}
                              className="accent-blue-600 h-5 w-5"
                            />
                            Apenso de Processo Existente
                          </label>
                        </div>
                      </div>

                      {/* Parent Process dropdown */}
                      {isApenso && (
                        <div className="bg-blue-50/30 border border-blue-200/60 rounded-2xl p-6 space-y-4">
                          <label htmlFor="regParentProc" className="block text-sm text-blue-900 font-bold uppercase tracking-wider">
                            Escolha o Processo Principal de Origem *
                          </label>
                          {processosList.length > 25 ? (
                            <div className="relative space-y-2">
                              {parentProcessoSeleccionado ? (
                                <div className="flex items-center justify-between p-4 bg-white border border-blue-200 rounded-xl shadow-xs">
                                  <div>
                                    <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block">Processo Principal Selecionado</span>
                                    <span className="text-sm font-semibold text-slate-800 font-mono">{parentProcessoSeleccionado}</span>
                                    {(() => {
                                      const p = processosList.find(proc => proc.numero === parentProcessoSeleccionado);
                                      return p ? (
                                        <span className="text-xs text-slate-500 block mt-0.5 animate-fadeIn">
                                          Autores: {p.autores.join(', ')} vs Réus: {p.reus.join(', ')}
                                        </span>
                                      ) : null;
                                    })()}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setParentProcessoSeleccionado('');
                                      setApensoSearchQuery('');
                                    }}
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold text-rose-600 transition-colors cursor-pointer"
                                  >
                                    Limpar
                                  </button>
                                </div>
                              ) : (
                                <div className="relative">
                                  <input
                                    id="regParentProc"
                                    type="text"
                                    placeholder="Escreva para pesquisar o número ou partes do processo..."
                                    value={apensoSearchQuery}
                                    onChange={(e) => {
                                      setApensoSearchQuery(e.target.value);
                                      setIsAutocompleteDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsAutocompleteDropdownOpen(true)}
                                    className="block w-full rounded-xl bg-white border border-blue-300 px-4 py-3.5 text-sm text-slate-850 font-medium placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all duration-200 font-mono"
                                  />
                                  {isAutocompleteDropdownOpen && (
                                    <>
                                      <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setIsAutocompleteDropdownOpen(false)}
                                      />
                                      <div className="absolute z-50 w-full mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                                        {(() => {
                                          const query = apensoSearchQuery.trim().toLowerCase();
                                          const filtered = processosList
                                            .filter(p => !p.parentProcessoNumero)
                                            .filter(p => {
                                              if (!query) return true;
                                              return p.numero.toLowerCase().includes(query) ||
                                                     p.autores.some(a => a.toLowerCase().includes(query)) ||
                                                     p.reus.some(r => r.toLowerCase().includes(query));
                                            });

                                          if (filtered.length === 0) {
                                            return (
                                              <div className="p-4 text-xs text-slate-500 text-center font-medium">
                                                Nenhum processo principal correspondente encontrado.
                                              </div>
                                            );
                                          }

                                          return filtered.map(p => (
                                            <button
                                              key={p.numero}
                                              type="button"
                                              onClick={() => {
                                                setParentProcessoSeleccionado(p.numero);
                                                setApensoSearchQuery(p.numero);
                                                setIsAutocompleteDropdownOpen(false);
                                                setAutores([...p.autores]);
                                                setReus([...p.reus]);
                                                setAdvogadosAutor([...p.advogadosAutor]);
                                                setAdvogadosReu([...p.advogadosReu]);
                                                setRegJuiz(p.juizTitular);
                                                if (p.especieCivel) setRegEspecieCivel(p.especieCivel);
                                                if (p.valorAcao !== undefined && p.valorAcao !== null) setRegValorAcao(p.valorAcao.toString());
                                                else setRegValorAcao('');
                                                if (p.procuradores && p.procuradores.length > 0) setCurrProcurador(p.procuradores[0]);
                                                if (p.funcionarios && p.funcionarios.length > 0) setCurrFuncionario(p.funcionarios[0]);
                                              }}
                                              className="w-full text-left p-3.5 hover:bg-slate-50 transition-colors flex flex-col gap-1 cursor-pointer focus:bg-slate-50 focus:outline-hidden"
                                            >
                                              <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-800 font-mono">{p.numero}</span>
                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                                                  Principal
                                                </span>
                                              </div>
                                              <div className="text-xs text-slate-500 truncate">
                                                Autores: <span className="font-medium text-slate-700">{p.autores.join(', ')}</span> vs Réus: <span className="font-medium text-slate-700">{p.reus.join(', ')}</span>
                                              </div>
                                            </button>
                                          ));
                                        })()}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <select
                              id="regParentProc"
                              required={isApenso}
                              value={parentProcessoSeleccionado}
                              onChange={(e) => {
                                const parentNum = e.target.value;
                                setParentProcessoSeleccionado(parentNum);
                                const parent = processosList.find(p => p.numero === parentNum);
                                if (parent) {
                                  setAutores([...parent.autores]);
                                  setReus([...parent.reus]);
                                  setAdvogadosAutor([...parent.advogadosAutor]);
                                  setAdvogadosReu([...parent.advogadosReu]);
                                  setRegJuiz(parent.juizTitular);
                                  if (parent.especieCivel) setRegEspecieCivel(parent.especieCivel);
                                  if (parent.valorAcao !== undefined && parent.valorAcao !== null) setRegValorAcao(parent.valorAcao.toString());
                                  else setRegValorAcao('');
                                  if (parent.procuradores && parent.procuradores.length > 0) setCurrProcurador(parent.procuradores[0]);
                                  if (parent.funcionarios && parent.funcionarios.length > 0) setCurrFuncionario(parent.funcionarios[0]);
                                }
                              }}
                              className="block w-full rounded-xl bg-white border border-blue-300 px-4 py-3.5 text-sm text-slate-800 font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all"
                            >
                              <option value="">-- Selecione o Processo Principal --</option>
                              {processosList.filter(p => !p.parentProcessoNumero).map(p => (
                                <option key={p.numero} value={p.numero}>
                                  {p.numero} - Autores: {p.autores.join(', ')} vs Réus: {p.reus.join(', ')}
                                </option>
                              ))}
                            </select>
                          )}
                          <p className="text-xs text-blue-750 font-medium">
                            💡 Os autores, réus, advogados e juiz associados ao processo principal foram copiados automaticamente. Pode adicionar novos ou revogá-los livremente nos passos abaixo!
                          </p>
                        </div>
                      )}

                      <div className="border-b border-slate-100 pb-3">
                        <span className="text-sm font-bold text-blue-900 uppercase tracking-widest block font-display">
                          1. Elementos Essenciais da Instância
                        </span>
                        <p className="text-xs text-slate-400 mt-0.5">Identifique formalmente o processo no sistema</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div>
                          <label htmlFor="regNo" className="block text-sm font-semibold text-slate-750 mb-2">
                            Número do Processo *
                          </label>
                          <input
                            type="text"
                            id="regNo"
                            required
                            value={regNumero}
                            onChange={(e) => {
                                const val = e.target.value;
                                setRegNumero(val);
                                const existingProcess = getProcessos().find(p => p.numero === val.trim());
                                if (existingProcess) {
                                  setProcessDuplicateError('⚠️ Já existe um processo com este número.');
                                } else {
                                  setProcessDuplicateError('');
                                }
                              }}
                            placeholder="ex: PROC-2026/102"
                            className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all duration-200 font-mono"
                          />
                          {processDuplicateError && (
                            <div className="mt-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs font-bold border border-red-200 flex items-center gap-2">
                              {processDuplicateError}
                            </div>
                          )}
                        </div>

                        <div>
                          <label htmlFor="regDate" className="block text-sm font-semibold text-slate-755 mb-2">
                            Data de Autuação *
                          </label>
                          <input
                            type="date"
                            id="regDate"
                            required
                            value={regData}
                            onChange={(e) => setRegData(e.target.value)}
                            className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-855 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all duration-200 font-mono"
                          />
                        </div>

                        <div className="md:col-span-2 bg-slate-55/40 border border-slate-205 p-4 rounded-2xl space-y-3">
                          <label className="block text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            ⏰ Alarme Automático de Inatividade
                          </label>
                          <p className="text-xs text-slate-500">
                            Defina o prazo de inatividade (sem novos atos no histórico) para disparar o alarme automático do processo:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {[
                              { label: '30 Dias', value: '30' },
                              { label: '60 Dias (Padrão)', value: '60' },
                              { label: '90 Dias', value: '90' },
                              { label: 'Outro Prazo...', value: 'custom' },
                            ].map((opt) => (
                              <button
                                type="button"
                                key={opt.value}
                                onClick={() => {
                                  setRegAlarmeDiasOpcao(opt.value);
                                  if (opt.value === 'custom') {
                                    setTimeout(() => {
                                      document.getElementById('regAlarmeDiasPersonalizadoInput')?.focus();
                                    }, 50);
                                  }
                                }}
                                className={`flex items-center justify-center text-xs font-bold px-3 py-2.5 rounded-xl border transition-all ${
                                  regAlarmeDiasOpcao === opt.value
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm hover:bg-blue-700'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          <div className="pt-1.5 animate-in fade-in duration-200">
                            <label className="block text-[11px] font-bold text-slate-550 uppercase mb-1.5">
                              Ou especifique o número de dias personalizado *
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                id="regAlarmeDiasPersonalizadoInput"
                                type="number"
                                min="1"
                                placeholder="Ex: 15"
                                value={regAlarmeDiasPersonalizado}
                                onChange={(e) => {
                                  setRegAlarmeDiasPersonalizado(e.target.value);
                                  setRegAlarmeDiasOpcao('custom');
                                }}
                                className={`block w-full max-w-[140px] rounded-xl bg-white border px-3.5 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-105 transition-all ${
                                  regAlarmeDiasOpcao === 'custom'
                                    ? 'border-blue-500 text-blue-900 bg-blue-50/10 ring-2 ring-blue-100'
                                    : 'border-slate-300 text-slate-700 bg-white'
                                }`}
                              />
                              <span className="text-xs font-semibold text-slate-500">dias corridos</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            * Se nenhuma escolha for feita ou se o campo for limpo, o alarme automático será fixado em 60 dias por omissão.
                          </p>
                        </div>

                        {regProcessoTipo === 'civel' && (
                          <>
                            <div className="animate-in fade-in duration-200">
                              <label htmlFor="regEspecie" className="block text-sm font-semibold text-blue-900 mb-2 font-display">
                                Espécie do Processo *
                              </label>
                              <select
                                id="regEspecie"
                                required
                                value={regEspecieCivel}
                                onChange={(e) => {
                                  const esp = e.target.value;
                                  setRegEspecieCivel(esp);
                                  const found = CIVIL_HIERARCHY.find(h => h.especie === esp);
                                  if (found && found.accoes.length > 0) {
                                    setRegTipoAccaoCivel(found.accoes[0].nome);
                                  }
                                }}
                                className="block w-full rounded-xl bg-blue-50/20 border border-blue-300 px-4 py-3 text-base text-slate-850 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all"
                              >
                                {CIVIL_HIERARCHY.map((item) => (
                                  <option key={item.especie} value={item.especie}>
                                    {item.especie}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="animate-in fade-in duration-200">
                              <label htmlFor="regTipoAccao" className="block text-sm font-semibold text-blue-900 mb-2 font-display">
                                Tipo de Ação Cível *
                              </label>
                              <select
                                id="regTipoAccao"
                                required
                                value={regTipoAccaoCivel}
                                onChange={(e) => setRegTipoAccaoCivel(e.target.value)}
                                className="block w-full rounded-xl bg-blue-50/20 border border-blue-300 px-4 py-3 text-base text-slate-850 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all capitalize whitespace-normal"
                              >
                                {(CIVIL_HIERARCHY.find(h => h.especie === regEspecieCivel)?.accoes || []).map((acc) => (
                                  <option key={acc.nome} value={acc.nome} className="whitespace-normal py-1">
                                    {acc.nome}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="animate-in md:col-span-2 fade-in duration-200">
                              <label htmlFor="regValor" className="block text-sm font-semibold text-emerald-950 mb-2 font-display">
                                Valor da Ação (€) *
                              </label>
                              <input
                                type="number"
                                id="regValor"
                                step="0.01"
                                min="0"
                                required={regProcessoTipo === 'civel'}
                                value={regValorAcao}
                                onChange={(e) => setRegValorAcao(e.target.value)}
                                placeholder="ex: 15000.00"
                                className="block w-full rounded-xl bg-emerald-50/10 border border-emerald-300 px-4 py-3 text-base text-slate-850 font-semibold focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 focus:outline-hidden transition-all font-mono"
                              />
                            </div>
                          </>
                        )}

                        <div className="md:col-span-2">
                          <label htmlFor="regJudge" className="block text-sm font-semibold text-slate-750 mb-2 flex items-center justify-between">
                            <span>Juiz Titular (Tribunal) *</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                              juizes.length > 20 ? 'bg-amber-50 text-amber-750 border-amber-200' : 'bg-blue-50 text-blue-750 border-blue-200'
                            }`}>
                              {juizes.length > 20 ? 'Autocomplete (>20)' : 'Lista Pendente'}
                            </span>
                          </label>

                          {juizes.length <= 20 ? (
                            <select
                              id="regJudge"
                              required
                              value={regJuiz}
                              onChange={(e) => setRegJuiz(e.target.value)}
                              className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all bg-white cursor-pointer"
                            >
                              <option value="">-- Selecione o Juiz --</option>
                              {juizes.map((j) => (
                                <option key={j} value={j}>{j}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                id="regJudge"
                                required
                                value={regJuiz}
                                onChange={(e) => {
                                  setRegJuiz(e.target.value);
                                  setShowJuizSuggestions(true);
                                }}
                                onFocus={() => setShowJuizSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowJuizSuggestions(false), 200)}
                                placeholder="Digite para pesquisar juiz da base..."
                                className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all duration-200"
                              />
                              {showJuizSuggestions && (
                                <div className="absolute z-10 left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-1">
                                  {juizes
                                    .filter(j => matchesSearchQuery(j, regJuiz))
                                    .slice(0, 5)
                                    .map((j) => (
                                      <div
                                        key={j}
                                        onMouseDown={() => {
                                          setRegJuiz(j);
                                          setShowJuizSuggestions(false);
                                        }}
                                        className="px-4 py-2.5 text-sm text-slate-705 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 font-medium transition-colors"
                                      >
                                        {j}
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setShowJuizCreate(!showJuizCreate);
                                setInlineJuizNome('');
                                setInlineJuizError('');
                                setInlineJuizSuccess('');
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              {showJuizCreate ? '✕ Cancelar criação' : '➕ Não encontra na lista? Criar Novo Juiz'}
                            </button>
                          </div>

                          {showJuizCreate && (
                            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
                              <p className="text-xs font-bold text-slate-700">Registar Novo Juiz:</p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={inlineJuizNome}
                                  onChange={(e) => setInlineJuizNome(e.target.value)}
                                  placeholder="Nome do Juiz (ex: Dr. António Costa)"
                                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-hidden focus:border-blue-500"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const btn = document.getElementById('saveInlineJuizBtn');
                                      if (btn) btn.click();
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  id="saveInlineJuizBtn"
                                  onClick={() => {
                                    const res = saveJuiz(inlineJuizNome);
                                    if (res.success) {
                                      setJuizes(res.list);
                                      setRegJuiz(inlineJuizNome.trim());
                                      setInlineJuizSuccess('Juiz registado e selecionado!');
                                      setInlineJuizError('');
                                      setInlineJuizNome('');
                                      setTimeout(() => setShowJuizCreate(false), 1200);
                                    } else {
                                      setInlineJuizError(res.message);
                                      setInlineJuizSuccess('');
                                    }
                                  }}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
                                >
                                  Criar e Escolher
                                </button>
                              </div>
                              {inlineJuizError && <p className="text-[11px] text-red-655 font-semibold">{inlineJuizError}</p>}
                              {inlineJuizSuccess && <p className="text-[11px] text-emerald-655 font-semibold">{inlineJuizSuccess}</p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Sub-form Autores */}
                          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block border-b border-slate-105 pb-2.5">
                          2. Autores (Requerentes)
                        </span>

                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                            {/* Full Name Input */}
                            <div className="relative">
                              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                Nome Completo
                              </label>
                              <input
                                type="text"
                                value={currAutor}
                                onChange={(e) => {
                                  setCurrAutor(e.target.value);
                                  setShowAutorSuggestions(true);
                                }}
                                onFocus={() => setShowAutorSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowAutorSuggestions(false), 250)}
                                placeholder="Nome do autor..."
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAutor())}
                              />
                              {showAutorSuggestions && getAutorSuggestions().length > 0 && (
                                <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg animate-in fade-in">
                                  {getAutorSuggestions().map((item) => (
                                    <div
                                      key={item.nome}
                                      onMouseDown={() => handleSelectAutorSuggestion(item)}
                                      className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                                    >
                                      <div className="font-bold text-slate-800 text-[13px]">{item.nome}</div>
                                      <div className="text-xs text-slate-550 font-medium flex items-center gap-2 mt-0.5">
                                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold text-[10px] uppercase">{item.tipo || 'intervenente'}</span>
                                        {item.nuit && <span className="bg-amber-50 text-amber-700 font-semibold px-1 py-0.5 rounded text-[9px]">NUIT: {item.nuit}</span>}
                                        {item.profissao && <span className="truncate max-w-[120px]">• {item.profissao}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* NUIT Input */}
                            <div className="relative">
                              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                NUIT (Número Fiscal)
                              </label>
                              <input
                                type="text"
                                value={currAutorNuit}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, ''); // numerical inputs
                                  setCurrAutorNuit(val);
                                  setShowAutorSuggestions(true);
                                  checkNuitAndPromptCopy(val, 'autor');
                                }}
                                onFocus={() => setShowAutorSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowAutorSuggestions(false), 250)}
                                placeholder="NUIT Mozambicano..."
                                maxLength={9}
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs text-slate-800 font-mono focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAutor())}
                              />
                            </div>
                          </div>

                          {/* Inline match alerts for better UX */}
                          {getAutorNuitMatch() && (
                            <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                              <div className="text-xs">
                                <span className="font-bold">✨ NUIT Registado:</span> {getAutorNuitMatch()?.nome} 
                                {getAutorNuitMatch()?.profissao && <span className="text-slate-500 font-medium"> ({getAutorNuitMatch()?.profissao})</span>}
                              </div>
                              <button
                                type="button"
                                onMouseDown={() => {
                                  const m = getAutorNuitMatch();
                                  if (m) {
                                    setCurrAutor(m.nome);
                                    setCurrAutorNuit(m.nuit || '');
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Copiar Dados
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={addAutor}
                            disabled={!currAutor.trim()}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-3xs"
                          >
                            + Adicionar Autor ao Processo
                          </button>
                        </div>

                         {/* List display */}
                        <div className="space-y-2 max-h-36 overflow-y-auto pt-1 mt-4 border-t border-slate-100">
                          {autores.map((autor, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm shadow-3xs">
                              <button
                                type="button"
                                onClick={() => setFichaConsultarNome(autor)}
                                className="font-semibold text-slate-755 hover:text-blue-600 hover:underline cursor-pointer text-left focus:outline-hidden"
                                title="Visualizar Ficha de Interveniente"
                              >
                                {autor}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAutor(idx)}
                                className="text-red-655 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold uppercase tracking-wide"
                              >
                                remover
                              </button>
                            </div>
                          ))}
                          {autores.length === 0 && (
                            <div className="text-sm text-slate-400 italic text-center py-2" >Sem autores inscritos (requerido pelo menos 1).</div>
                          )}
                        </div>
                      </div>

                      {/* Sub-form Réus */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block border-b border-slate-105 pb-2.5">
                          3. Réus (Requeridos)
                        </span>

                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                            {/* Full Name Input */}
                            <div className="relative">
                              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                Nome Completo
                              </label>
                              <input
                                type="text"
                                value={currReu}
                                onChange={(e) => {
                                  setCurrReu(e.target.value);
                                  setShowReuSuggestions(true);
                                }}
                                onFocus={() => setShowReuSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowReuSuggestions(false), 250)}
                                placeholder="Nome do réu..."
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReu())}
                              />
                              {showReuSuggestions && getReuSuggestions().length > 0 && (
                                <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg animate-in fade-in">
                                  {getReuSuggestions().map((item) => (
                                    <div
                                      key={item.nome}
                                      onMouseDown={() => handleSelectReuSuggestion(item)}
                                      className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                                    >
                                      <div className="font-bold text-slate-800 text-[13px]">{item.nome}</div>
                                      <div className="text-xs text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold text-[10px] uppercase">{item.tipo || 'intervenente'}</span>
                                        {item.nuit && <span className="bg-amber-50 text-amber-700 font-semibold px-1 py-0.5 rounded text-[9px]">NUIT: {item.nuit}</span>}
                                        {item.profissao && <span className="truncate max-w-[125px]">• {item.profissao}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* NUIT Input */}
                            <div className="relative">
                              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                NUIT (Número Fiscal)
                              </label>
                              <input
                                type="text"
                                value={currReuNuit}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, ''); // numerical inputs
                                  setCurrReuNuit(val);
                                  setShowReuSuggestions(true);
                                  checkNuitAndPromptCopy(val, 'reu');
                                }}
                                onFocus={() => setShowReuSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowReuSuggestions(false), 250)}
                                placeholder="NUIT Mozambicano..."
                                maxLength={9}
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3.5 py-2.5 text-xs text-slate-850 font-mono focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReu())}
                              />
                            </div>
                          </div>

                          {/* Inline match alerts for better UX */}
                          {getReuNuitMatch() && (
                            <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                              <div className="text-xs">
                                <span className="font-bold">✨ NUIT Registado:</span> {getReuNuitMatch()?.nome} 
                                {getReuNuitMatch()?.profissao && <span className="text-slate-500 font-medium"> ({getReuNuitMatch()?.profissao})</span>}
                              </div>
                              <button
                                type="button"
                                onMouseDown={() => {
                                  const m = getReuNuitMatch();
                                  if (m) {
                                    setCurrReu(m.nome);
                                    setCurrReuNuit(m.nuit || '');
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                              >
                                Copiar Dados
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={addReu}
                            disabled={!currReu.trim()}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-3xs"
                          >
                            + Adicionar Réu ao Processo
                          </button>
                        </div>

                        {/* List display */}
                        <div className="space-y-2 max-h-36 overflow-y-auto pt-1 mt-4 border-t border-slate-100">
                          {reus.map((reu, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm shadow-3xs">
                              <button
                                type="button"
                                onClick={() => setFichaConsultarNome(reu)}
                                className="font-semibold text-slate-700 hover:text-blue-600 hover:underline cursor-pointer text-left focus:outline-hidden"
                                title="Visualizar Ficha de Interveniente"
                              >
                                {reu}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeReu(idx)}
                                className="text-red-655 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold uppercase tracking-wide"
                              >
                                remover
                              </button>
                            </div>
                          ))}
                          {reus.length === 0 && (
                            <div className="text-sm text-slate-400 italic text-center py-2" >Sem réus inscritos (requerido pelo menos 1).</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step Section 3: Defending Attorneys */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Advogados Autor */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block">
                            4. Advogados do Autor
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                            advogados.length > 20 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {advogados.length > 20 ? 'Autocomplete (>20)' : 'Lista'}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {advogados.length <= 20 ? (
                            <div className="flex-1 min-w-0">
                              <select
                                value={currAdvAutor}
                                onChange={(e) => setCurrAdvAutor(e.target.value)}
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-805 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all bg-white cursor-pointer"
                              >
                                <option value="">-- Selecione o Advogado --</option>
                                <option value="Sem Advogado Constituído">Sem Advogado Constituído (Autorepresentação)</option>
                                {advogados.map((adv) => (
                                  <option key={adv} value={adv}>{adv}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0 relative">
                              <input
                                type="text"
                                value={currAdvAutor}
                                onChange={(e) => {
                                  setCurrAdvAutor(e.target.value);
                                  setShowAdvAutorSuggestions(true);
                                }}
                                onFocus={() => setShowAdvAutorSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowAdvAutorSuggestions(false), 200)}
                                placeholder="Digite para pesquisar advogado..."
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAdvAutor())}
                              />
                              {showAdvAutorSuggestions && (
                                <div className="absolute z-10 left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg animate-in fade-in">
                                  <div
                                    onMouseDown={() => {
                                      setCurrAdvAutor("Sem Advogado Constituído");
                                      setShowAdvAutorSuggestions(false);
                                    }}
                                    className="px-4 py-2.5 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer border-b border-slate-100 font-bold"
                                  >
                                    Sem Advogado Constituído
                                  </div>
                                  {advogados
                                    .filter(a => matchesSearchQuery(a, currAdvAutor))
                                    .slice(0, 5)
                                    .map((adv) => (
                                      <div
                                        key={adv}
                                        onMouseDown={() => {
                                          setCurrAdvAutor(adv);
                                          setShowAdvAutorSuggestions(false);
                                        }}
                                        className="px-4 py-2.5 text-sm text-slate-705 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 font-medium"
                                      >
                                        {adv}
                                      </div>
                                    ))}
                                  {advogados.filter(a => matchesSearchQuery(a, currAdvAutor)).length === 0 && (
                                    <div className="px-4 py-3 text-sm text-slate-400 italic">
                                      Nenhum advogado correspondente
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={addAdvAutor}
                            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer font-display shrink-0 shadow-xs transition-colors hover:shadow-sm"
                          >
                            Adicionar
                          </button>
                        </div>

                        <div className="mt-2 flex justify-between items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAdvogadosAutor(prev => {
                                if (prev.includes("Sem Advogado Constituído")) return prev;
                                return [...prev, "Sem Advogado Constituído"];
                              });
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer transition-colors"
                          >
                            ⚡ Selecionar "Sem Advogado Constituído"
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAdvAutorCreate(!showAdvAutorCreate);
                              setInlineAdvAutorNome('');
                              setInlineAdvAutorError('');
                              setInlineAdvAutorSuccess('');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {showAdvAutorCreate ? '✕ Cancelar criação' : '➕ Criar Novo Advogado'}
                          </button>
                        </div>

                        {showAdvAutorCreate && (
                          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
                            <p className="text-xs font-bold text-slate-700">Registar Novo Advogado (Autor):</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={inlineAdvAutorNome}
                                onChange={(e) => setInlineAdvAutorNome(e.target.value)}
                                placeholder="Nome do Advogado (ex: Dr. Carlos Bento)"
                                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-hidden focus:border-blue-500"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const btn = document.getElementById('saveInlineAdvAutorBtn');
                                    if (btn) btn.click();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                id="saveInlineAdvAutorBtn"
                                onClick={() => {
                                  const res = saveAdvogado(inlineAdvAutorNome);
                                  if (res.success) {
                                    setAdvogados(res.list);
                                    setAdvogadosAutor(prev => {
                                      if (prev.includes(inlineAdvAutorNome.trim())) return prev;
                                      return [...prev, inlineAdvAutorNome.trim()];
                                    });
                                    setNotificacoesDestinatarios(prev => {
                                      if (prev.includes(inlineAdvAutorNome.trim())) return prev;
                                      return [...prev, inlineAdvAutorNome.trim()];
                                    });
                                    setInlineAdvAutorSuccess('Advogado registado e adicionado!');
                                    setInlineAdvAutorError('');
                                    setInlineAdvAutorNome('');
                                    setTimeout(() => setShowAdvAutorCreate(false), 1200);
                                  } else {
                                    setInlineAdvAutorError(res.message);
                                    setInlineAdvAutorSuccess('');
                                  }
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
                              >
                                Criar e Selecionar
                              </button>
                            </div>
                            {inlineAdvAutorError && <p className="text-[11px] text-red-650 font-semibold">{inlineAdvAutorError}</p>}
                            {inlineAdvAutorSuccess && <p className="text-[11px] text-emerald-650 font-semibold">{inlineAdvAutorSuccess}</p>}
                          </div>
                        )}

                        <div className="space-y-2 max-h-36 overflow-y-auto pt-1">
                          {advogadosAutor.map((adv, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm shadow-3xs">
                              <button
                                type="button"
                                onClick={() => setFichaConsultarNome(adv)}
                                className="font-semibold text-slate-707 hover:text-blue-600 hover:underline cursor-pointer text-left focus:outline-hidden"
                                title="Visualizar Ficha de Advogado"
                              >
                                {adv}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAdvAutor(idx)}
                                className="text-red-655 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold uppercase tracking-wide"
                              >
                                remover
                              </button>
                            </div>
                          ))}
                          {advogadosAutor.length === 0 && (
                            <div className="text-sm text-slate-400 italic text-center py-2">Sem advogados atribuídos provisoriamente.</div>
                          )}
                        </div>
                      </div>

                      {/* Advogados Réu */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block">
                            5. Advogados do Réu
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                            advogados.length > 20 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {advogados.length > 20 ? 'Autocomplete (>20)' : 'Lista'}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {advogados.length <= 20 ? (
                            <div className="flex-1 min-w-0">
                              <select
                                value={currAdvReu}
                                onChange={(e) => setCurrAdvReu(e.target.value)}
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-805 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all bg-white cursor-pointer"
                              >
                                <option value="">-- Selecione o Advogado --</option>
                                <option value="Sem Advogado Constituído">Sem Advogado Constituído (Ausência / Revelia)</option>
                                {advogados.map((adv) => (
                                  <option key={adv} value={adv}>{adv}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0 relative">
                              <input
                                type="text"
                                value={currAdvReu}
                                onChange={(e) => {
                                  setCurrAdvReu(e.target.value);
                                  setShowAdvReuSuggestions(true);
                                }}
                                onFocus={() => setShowAdvReuSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowAdvReuSuggestions(false), 200)}
                                placeholder="Digite para pesquisar advogado..."
                                className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all"
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAdvReu())}
                              />
                              {showAdvReuSuggestions && (
                                <div className="absolute z-10 left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg animate-in fade-in">
                                  <div
                                    onMouseDown={() => {
                                      setCurrAdvReu("Sem Advogado Constituído");
                                      setShowAdvReuSuggestions(false);
                                    }}
                                    className="px-4 py-2.5 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer border-b border-slate-100 font-bold"
                                  >
                                    Sem Advogado Constituído
                                  </div>
                                  {advogados
                                    .filter(a => matchesSearchQuery(a, currAdvReu))
                                    .slice(0, 5)
                                    .map((adv) => (
                                      <div
                                        key={adv}
                                        onMouseDown={() => {
                                          setCurrAdvReu(adv);
                                          setShowAdvReuSuggestions(false);
                                        }}
                                        className="px-4 py-2.5 text-sm text-slate-705 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 font-medium"
                                      >
                                        {adv}
                                      </div>
                                    ))}
                                  {advogados.filter(a => matchesSearchQuery(a, currAdvReu)).length === 0 && (
                                    <div className="px-4 py-3 text-sm text-slate-400 italic">
                                      Nenhum advogado correspondente
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={addAdvReu}
                            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer font-display shrink-0 shadow-xs transition-colors hover:shadow-sm"
                          >
                            Adicionar
                          </button>
                        </div>

                        <div className="mt-2 flex justify-between items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAdvogadosReu(prev => {
                                if (prev.includes("Sem Advogado Constituído")) return prev;
                                return [...prev, "Sem Advogado Constituído"];
                              });
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer transition-colors"
                          >
                            ⚡ Selecionar "Sem Advogado Constituído"
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAdvReuCreate(!showAdvReuCreate);
                              setInlineAdvReuNome('');
                              setInlineAdvReuError('');
                              setInlineAdvReuSuccess('');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {showAdvReuCreate ? '✕ Cancelar criação' : '➕ Criar Novo Advogado'}
                          </button>
                        </div>

                        {showAdvReuCreate && (
                          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
                            <p className="text-xs font-bold text-slate-700">Registar Novo Advogado (Réu):</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={inlineAdvReuNome}
                                onChange={(e) => setInlineAdvReuNome(e.target.value)}
                                placeholder="Nome do Advogado (ex: Dra. Sofia Lima)"
                                className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-hidden focus:border-blue-500"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const btn = document.getElementById('saveInlineAdvReuBtn');
                                    if (btn) btn.click();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                id="saveInlineAdvReuBtn"
                                onClick={() => {
                                  const res = saveAdvogado(inlineAdvReuNome);
                                  if (res.success) {
                                    setAdvogados(res.list);
                                    setAdvogadosReu(prev => {
                                      if (prev.includes(inlineAdvReuNome.trim())) return prev;
                                      return [...prev, inlineAdvReuNome.trim()];
                                    });
                                    setNotificacoesDestinatarios(prev => {
                                      if (prev.includes(inlineAdvReuNome.trim())) return prev;
                                      return [...prev, inlineAdvReuNome.trim()];
                                    });
                                    setInlineAdvReuSuccess('Advogado registado e adicionado!');
                                    setInlineAdvReuError('');
                                    setInlineAdvReuNome('');
                                    setTimeout(() => setShowAdvReuCreate(false), 1200);
                                  } else {
                                    setInlineAdvReuError(res.message);
                                    setInlineAdvReuSuccess('');
                                  }
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
                              >
                                Criar e Selecionar
                              </button>
                            </div>
                            {inlineAdvReuError && <p className="text-[11px] text-red-655 font-semibold">{inlineAdvReuError}</p>}
                            {inlineAdvReuSuccess && <p className="text-[11px] text-emerald-650 font-semibold">{inlineAdvReuSuccess}</p>}
                          </div>
                        )}

                        <div className="space-y-2 max-h-36 overflow-y-auto pt-1">
                          {advogadosReu.map((adv, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm shadow-3xs">
                              <button
                                type="button"
                                onClick={() => setFichaConsultarNome(adv)}
                                className="font-semibold text-slate-707 hover:text-blue-600 hover:underline cursor-pointer text-left focus:outline-hidden"
                                title="Visualizar Ficha de Advogado"
                              >
                                {adv}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAdvReu(idx)}
                                className="text-red-655 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold uppercase tracking-wide"
                              >
                                remover
                              </button>
                            </div>
                          ))}
                          {advogadosReu.length === 0 && (
                            <div className="text-sm text-slate-400 italic text-center py-2">Sem advogados atribuídos provisoriamente.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step Section 4: Procuradores (Attorneys/Representatives) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-105 pb-2.5 mb-2">
                        <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block font-display">
                          6. Procuradores Associados ao Processo
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                          globalProcuradores.length > 20 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {globalProcuradores.length > 20 ? 'Autocomplete (>20)' : 'Lista'}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {globalProcuradores.length <= 20 ? (
                          <div className="flex-1 min-w-0">
                            <select
                              value={currProcurador}
                              onChange={(e) => setCurrProcurador(e.target.value)}
                              className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-805 font-bold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all bg-white cursor-pointer"
                            >
                              <option value="">-- Selecione o Procurador --</option>
                              {globalProcuradores.map((proc) => (
                                <option key={proc} value={proc}>{proc}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={currProcurador}
                              onChange={(e) => {
                                setCurrProcurador(e.target.value);
                                setShowProcuradorSuggestions(true);
                              }}
                              onFocus={() => setShowProcuradorSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowProcuradorSuggestions(false), 200)}
                              placeholder="Escreva o nome do Procurador (ao adicionar, abrirá a ficha se for novo)..."
                              className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all"
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addProcurador())}
                            />
                            {showProcuradorSuggestions && (
                              <div className="absolute z-10 left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                                {getProcuradorSuggestions().map((item) => (
                                  <div
                                    key={item.nome}
                                    onMouseDown={() => {
                                      handleSelectProcuradorSuggestion(item);
                                    }}
                                    className="px-4 py-3 text-sm text-slate-707 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 font-medium"
                                  >
                                    {item.nome} (Procurador Registado)
                                  </div>
                                ))}
                                {currProcurador.trim() && getProcuradorSuggestions().length === 0 && (
                                  <div className="px-4 py-3 text-sm text-blue-900 bg-blue-50/50 rounded-b-lg border-t border-blue-100 leading-normal font-medium">
                                    Nenhum procurador correspondente encontrado. Ao clicar em "Adicionar", abrirá a ficha para preenchimento.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={addProcurador}
                          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer font-display shrink-0 shadow-xs transition-colors hover:shadow-xs"
                        >
                          Adicionar / Criar
                        </button>
                      </div>

                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setShowProcuradorCreate(!showProcuradorCreate);
                            setInlineProcuradorNome('');
                            setInlineProcuradorError('');
                            setInlineProcuradorSuccess('');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {showProcuradorCreate ? '✕ Cancelar criação' : '➕ Não encontra? Criar Novo Procurador'}
                        </button>
                      </div>

                      {showProcuradorCreate && (
                        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
                          <p className="text-xs font-bold text-slate-700">Registar Novo Procurador:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={inlineProcuradorNome}
                              onChange={(e) => setInlineProcuradorNome(e.target.value)}
                              placeholder="Nome do Procurador (ex: Dr. Carlos Santos)"
                              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-hidden focus:border-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const btn = document.getElementById('saveInlineProcuradorBtn');
                                  if (btn) btn.click();
                                }
                              }}
                            />
                            <button
                              type="button"
                              id="saveInlineProcuradorBtn"
                              onClick={() => {
                                if (!inlineProcuradorNome.trim()) {
                                  setInlineProcuradorError('O nome não pode estar em branco.');
                                  return;
                                }
                                const res = saveProcurador(inlineProcuradorNome.trim());
                                if (res.success) {
                                  // Also save as participant
                                  saveInterveniente({
                                    nome: inlineProcuradorNome.trim(),
                                    nomePai: '',
                                    nomeMae: '',
                                    dataNascimento: '',
                                    bilheteIdentidade: '',
                                    profissao: '',
                                    moradas: [],
                                    telefone: '',
                                    email: '',
                                    tipo: 'procurador'
                                  });
                                  setProcuradores(prev => {
                                    if (prev.includes(inlineProcuradorNome.trim())) return prev;
                                    return [...prev, inlineProcuradorNome.trim()];
                                  });
                                  setNotificacoesDestinatarios(prev => {
                                    if (prev.includes(inlineProcuradorNome.trim())) return prev;
                                    return [...prev, inlineProcuradorNome.trim()];
                                  });
                                  setInlineProcuradorSuccess('Procurador registado e adicionado!');
                                  setInlineProcuradorError('');
                                  setInlineProcuradorNome('');
                                  setTimeout(() => setShowProcuradorCreate(false), 1200);
                                } else {
                                  setInlineProcuradorError(res.message);
                                  setInlineProcuradorSuccess('');
                                }
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
                            >
                              Criar e Selecionar
                            </button>
                          </div>
                          {inlineProcuradorError && <p className="text-[11px] text-red-655 font-semibold">{inlineProcuradorError}</p>}
                          {inlineProcuradorSuccess && <p className="text-[11px] text-emerald-650 font-semibold">{inlineProcuradorSuccess}</p>}
                        </div>
                      )}

                      <div className="space-y-2 max-h-36 overflow-y-auto pt-1">
                        {procuradores.map((proc, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm shadow-3xs">
                            <button
                              type="button"
                              onClick={() => setFichaConsultarNome(proc)}
                              className="font-semibold text-slate-700 hover:text-blue-600 hover:underline cursor-pointer text-left focus:outline-hidden"
                              title="Visualizar Ficha de Procurador"
                            >
                              {proc}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeProcurador(idx, proc)}
                              className="text-red-655 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold uppercase tracking-wide"
                            >
                              remover
                            </button>
                          </div>
                        ))}
                        {procuradores.length === 0 && (
                          <div className="text-sm text-slate-400 italic text-center py-2">Sem procuradores associados a este processo.</div>
                        )}
                      </div>
                    </div>

                    {/* Step Section 7: Funcionários Responsáveis pelo Processo */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-105 pb-2.5 mb-2">
                        <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block font-display">
                          7. Funcionários Responsáveis pelo Processo
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                          funcionarios.length > 20 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {funcionarios.length > 20 ? 'Autocomplete (>20)' : 'Lista'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-1">
                        Indique qual ou quais os funcionários da secretaria judicial que serão responsáveis pelo acompanhamento e expediente deste processo. Podem ser associados um ou mais.
                      </p>

                      <div className="flex gap-2">
                        {funcionarios.length <= 20 ? (
                          <select
                            value={currFuncionario}
                            onChange={(e) => setCurrFuncionario(e.target.value)}
                            className="flex-1 rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-805 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all bg-white cursor-pointer"
                          >
                            <option value="">-- Selecione o Funcionário --</option>
                            {funcionarios.map((func) => (
                              <option key={func} value={func}>{func}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={currFuncionario}
                              onChange={(e) => {
                                setCurrFuncionario(e.target.value);
                                setShowFuncionarioSuggestions(true);
                              }}
                              onFocus={() => setShowFuncionarioSuggestions(true)}
                              onBlur={() => setTimeout(() => setShowFuncionarioSuggestions(false), 200)}
                              placeholder="Digite para pesquisar funcionário..."
                              className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-hidden transition-all"
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFuncionarioRegisto())}
                            />
                            {showFuncionarioSuggestions && (
                              <div className="absolute z-10 left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                                {funcionarios
                                  .filter(f => matchesSearchQuery(f, currFuncionario))
                                  .slice(0, 5)
                                  .map((func) => (
                                    <div
                                      key={func}
                                      onMouseDown={() => {
                                        setCurrFuncionario(func);
                                        setShowFuncionarioSuggestions(false);
                                      }}
                                      className="px-4 py-2.5 text-sm text-slate-707 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 font-medium"
                                    >
                                      {func}
                                    </div>
                                  ))}
                                {funcionarios.filter(f => matchesSearchQuery(f, currFuncionario)).length === 0 && (
                                  <div className="px-4 py-3 text-sm text-slate-400 italic">
                                    Nenhum funcionário correspondente
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={addFuncionarioRegisto}
                          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer font-display shrink-0 shadow-xs transition-colors hover:shadow-xs"
                        >
                          Adicionar
                        </button>
                      </div>

                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setShowFuncionarioCreate(!showFuncionarioCreate);
                            setInlineFuncionarioNome('');
                            setInlineFuncionarioError('');
                            setInlineFuncionarioSuccess('');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {showFuncionarioCreate ? '✕ Cancelar criação' : '➕ Não encontra? Criar Novo Funcionário'}
                        </button>
                      </div>

                      {showFuncionarioCreate && (
                        <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in duration-200 text-left">
                          <p className="text-xs font-bold text-slate-700">Registar Novo Funcionário:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={inlineFuncionarioNome}
                              onChange={(e) => setInlineFuncionarioNome(e.target.value)}
                              placeholder="Nome do Funcionário (ex: Margarida Silva)"
                              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium focus:outline-hidden focus:border-blue-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const btn = document.getElementById('saveInlineFuncionarioBtn');
                                  if (btn) btn.click();
                                }
                              }}
                            />
                            <button
                              type="button"
                              id="saveInlineFuncionarioBtn"
                              onClick={() => {
                                if (!inlineFuncionarioNome.trim()) {
                                  setInlineFuncionarioError('O nome não pode estar em branco.');
                                  return;
                                }
                                const res = saveFuncionario(inlineFuncionarioNome.trim());
                                if (res.success) {
                                  setFuncionarios(res.list);
                                  setFuncionariosRegisto(prev => {
                                    if (prev.includes(inlineFuncionarioNome.trim())) return prev;
                                    return [...prev, inlineFuncionarioNome.trim()];
                                  });
                                  setInlineFuncionarioSuccess('Funcionário registado e adicionado!');
                                  setInlineFuncionarioError('');
                                  setInlineFuncionarioNome('');
                                  setTimeout(() => setShowFuncionarioCreate(false), 1200);
                                } else {
                                  setInlineFuncionarioError(res.message);
                                  setInlineFuncionarioSuccess('');
                                }
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0"
                            >
                              Criar e Selecionar
                            </button>
                          </div>
                          {inlineFuncionarioError && <p className="text-[11px] text-red-655 font-semibold">{inlineFuncionarioError}</p>}
                          {inlineFuncionarioSuccess && <p className="text-[11px] text-emerald-650 font-semibold">{inlineFuncionarioSuccess}</p>}
                        </div>
                      )}

                      <div className="space-y-2 max-h-36 overflow-y-auto pt-1">
                        {funcionariosRegisto.map((func, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm shadow-3xs font-medium">
                            <span className="font-semibold text-slate-750">
                              {func}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFuncionarioRegisto(idx)}
                              className="text-red-655 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold uppercase tracking-wide"
                            >
                              remover
                            </button>
                          </div>
                        ))}
                        {funcionariosRegisto.length === 0 && (
                          <div className="text-sm text-slate-400 italic text-center py-2">Sem funcionários associados ao processo.</div>
                        )}
                      </div>
                    </div>

                    {/* Step Section 5: Notification choices preference */}
                    {(advogadosAutor.length + advogadosReu.length + procuradores.length > 0) && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-105 pb-2.5 mb-2">
                          <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block font-display">
                            8. Destinatários de Notificações
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 font-sans">
                            Actualização Automática
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed mb-1">
                          Indique quais dos advogados ou procuradores associados deverão receber notificações oficiais por defeito para este processo.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          {[...advogadosAutor, ...advogadosReu, ...procuradores].map((nome, idx) => {
                            const isSelected = notificacoesDestinatarios.includes(nome);
                            return (
                              <label 
                                key={idx} 
                                className={`flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold shadow-xs ring-2 ring-blue-50' 
                                    : 'bg-slate-50/40 hover:bg-slate-100 border-slate-200 text-slate-700'
                                }`}
                              >
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleNotificacoesDestinatario(nome)}
                                  className="h-5 w-5 rounded border-slate-350 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="text-sm leading-normal">
                                  <p className="font-bold">{nome}</p>
                                  <p className="text-xs text-slate-455 mt-0.5 font-normal">
                                    {procuradores.includes(nome) ? 'Procurador' : advogadosAutor.includes(nome) ? 'Advogado Autor' : 'Advogado Réu'}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Step Section 6: Document load simulation */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <span className="text-sm font-bold text-slate-800 uppercase tracking-wide block border-b border-slate-105 pb-2.5">
                        9. Documentação Inicial do Processo (Opcional - Pasta C:\)
                      </span>

                      <div className="bg-slate-50 rounded-xl p-4.5 border border-slate-200 text-sm text-slate-600 leading-relaxed space-y-2">
                        <p>Adicione nesta secção os ficheiros preliminares. Ao premir <strong>Autuar</strong>, o aplicativo criará as pastas estruturadas no seu computador e indexará todos os documentos introduzidos.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm items-end pt-1">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-755 mb-2">
                            Título do Ficheiro {tempDocUrl && <span className="text-xs text-emerald-600 font-bold">(✓ Ficheiro Selecionado)</span>}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tempDocNome}
                              onChange={(e) => setTempDocNome(e.target.value)}
                              placeholder="ex: Contrato_Promessa"
                              className="flex-1 rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-medium focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all duration-200"
                            />
                            <label className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer border border-slate-300 flex items-center justify-center font-bold text-xs select-none">
                              📁 Escolher
                              <input
                                type="file"
                                accept="application/pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setTempDocNome(file.name);
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setTempDocUrl(event.target?.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-755 mb-2">Categoria de Documento</label>
                          <select
                            value={tempDocCat}
                            onChange={(e) => setTempDocCat(e.target.value)}
                            className="block w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-base text-slate-850 font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-105 focus:outline-hidden transition-all bg-white cursor-pointer"
                          >
                            <option value="Petição Inicial">Petição Inicial</option>
                            <option value="Contestação">Contestação</option>
                            <option value="Procuração">Procuração</option>
                            <option value="Contrato">Contrato</option>
                            <option value="Requerimento">Requerimento</option>
                            <option value="Outro">Outro</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={addInitialDocToQueue}
                          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold cursor-pointer shadow-xs font-display flex items-center justify-center gap-1.5 transition-colors"
                        >
                          Anexar ao Processo
                        </button>
                      </div>

                      {/* Display appended Document Index queue prior to process creation */}
                      {regDocs.length > 0 && (
                        <div className="pt-2">
                          <span className="block text-xs uppercase font-bold text-slate-400 mb-2">Ficheiros para criar no diretório:</span>
                          <div className="space-y-2">
                            {regDocs.map((doc, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3.5 border border-dashed border-slate-300 rounded-xl bg-orange-50/10 text-sm shadow-3xs">
                                <div className="flex items-center gap-2.5">
                                  <FileText className="h-5 w-5 text-amber-600" />
                                  <span className="font-semibold text-slate-850">{doc.nome}</span>
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wide">{doc.categoria}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeInitialDocFromQueue(idx)}
                                  className="text-red-655 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors text-xs font-bold uppercase tracking-wide"
                                >
                                  remover
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Final Action triggers */}
                    <div className="pt-4 flex justify-end gap-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Pretende limpar e redefinir o formulário de autuação?')) {
                            setRegNumero('');
                            setRegJuiz('');
                            setAutores([]);
                            setReus([]);
                            setAdvogadosAutor([]);
                            setAdvogadosReu([]);
                            setRegDocs([]);
                            setRegError('');
                            setIsApenso(false);
                            setParentProcessoSeleccionado('');
                            setApensoSearchQuery('');
                            setIsAutocompleteDropdownOpen(false);
                            setRegAlarmeDiasOpcao('60');
                            setRegAlarmeDiasPersonalizado('');
                          }
                        }}
                        className="px-6 py-3.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-705 hover:text-slate-850 bg-white hover:bg-slate-50 shadow-3xs cursor-pointer transition-colors"
                      >
                        Limpar Formulário
                      </button>
                      <button
                        type="submit"
                        className="px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs hover:shadow-md transition-colors cursor-pointer font-display"
                      >
                        Autuar Processo & Criar Pastas
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: Visual Real File Explorer & Backup Center */}
              {activeTab === 'disco' && (
                <div className="space-y-5 h-full flex flex-col min-h-0">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-indigo-600 animate-pulse" />
                        Explorador de Disco Local C:
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Consulte a árvore física de diretórios e documentos criados em tempo real no seu PC em <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded select-all font-mono">C:\GestaoProcessos</code>.
                      </p>
                    </div>
                  </div>

                  {backupStatusMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-xs font-semibold flex items-center justify-between shadow-xs transition-all animate-bounce">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>{backupStatusMsg}</span>
                      </div>
                      <button onClick={() => setBackupStatusMsg('')} className="text-emerald-500 hover:text-emerald-700 font-bold shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Left & Middle Column (2/3 width): File Explorer */}
                    <div className="xl:col-span-2 h-full min-h-[450px] flex flex-col">
                      <FileExplorer 
                        onOpenFile={handleOpenFile}
                        onPrintFile={handlePrintFile}
                        onDownloadFile={handleDownloadFile}
                        onSelectProcess={handleOpenProcessoInNewTab}
                      />
                    </div>

                    {/* Right Column (1/3 width): Backup & Recovery Center */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-full overflow-hidden text-xs space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 tracking-tight font-display flex items-center gap-1.5 uppercase">
                          <Database className="h-4 w-4 text-blue-600" />
                          Central de Cópias de Segurança
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Sincronização estrita de dados offline. Os backups automáticos ocorrem das <strong className="text-slate-800 bg-slate-100 px-1 py-0.2 rounded font-mono">09:00h</strong> às <strong className="text-slate-800 bg-slate-100 px-1 py-0.2 rounded font-mono">12:00h</strong> todos os dias.
                        </p>
                      </div>

                      {/* Info Cards / Stats */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Janela Diária</span>
                          <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            9h - 12h
                          </span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estado de Hoje</span>
                          {(() => {
                            const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
                            const hasToday = backupsList.some(b => b.localDate === todayStr && b.wasTriggeredAuto);
                            return hasToday ? (
                              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Concluído
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-600 flex items-center gap-1" title="O backup será feito automaticamente quando aceder à app no período correspondente.">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Pendente
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Actions: Manual Backup & Upload Restore */}
                      <div className="space-y-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const b = executeBackup(false);
                            setBackupsList(getBackupsList());
                            setBackupStatusMsg(`Cópia manual criada com sucesso: ${b.filename}`);
                            setTimeout(() => setBackupStatusMsg(''), 10000);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors cursor-pointer text-xs"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Gerar Cópia Manual Agora
                        </button>

                        <div className="relative">
                          <label className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg font-bold cursor-pointer transition-all text-xs">
                            <UploadCloud className="h-3.5 w-3.5 text-slate-500" />
                            <span>Importar e Restaurar (.json)</span>
                            <input
                              type="file"
                              accept=".json"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const text = event.target?.result as string;
                                  if (window.confirm('CUIDADO CRÍTICO: Restaurar uma cópia de segurança substituirá irreversivelmente todas as tabelas locais (processos, utilizadores, juízes, advogados e procuradores)! Tem a certeza que deseja prosseguir com o restauro?')) {
                                    const res = restoreDatabase(text);
                                    if (res.success) {
                                      alert(res.message);
                                      setProcessosList(getProcessos());
                                      setJuizes(getJuizes());
                                      setAdvogados(getAdvogados());
                                      setGlobalProcuradores(getProcuradores());
                                      setBackupsList(getBackupsList());
                                    } else {
                                      alert(res.message);
                                    }
                                  }
                                };
                                reader.readAsText(file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Display Backups list */}
                      <div className="flex-1 flex flex-col min-h-0 space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                          Ficheiros em C:\GestaoProcessos\Backup ({backupsList.length}/5)
                        </span>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[150px]">
                          {backupsList.map((backup) => (
                            <div key={backup.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg relative hover:bg-slate-100/50 group transition-all">
                              <div className="flex items-start justify-between gap-1">
                                <div className="space-y-1 min-w-0">
                                  <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5" title={backup.filename}>
                                    <FileJson className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                    <span className="truncate">{backup.filename}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 font-medium">
                                    <span>{backup.size}</span>
                                    <span>•</span>
                                    <span className={`px-1 py-0.1 rounded text-[8px] font-bold uppercase tracking-wider ${
                                      backup.wasTriggeredAuto 
                                        ? 'bg-emerald-50 text-emerald-700' 
                                        : 'bg-indigo-50 text-indigo-700'
                                    }`}>
                                      {backup.wasTriggeredAuto ? 'Auto' : 'Manual'}
                                    </span>
                                    {!backup.content && (
                                      <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-red-50 text-red-600 border border-red-100 animate-pulse">
                                        Excedeu Quota
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-mono">
                                    {new Date(backup.timestamp).toLocaleString('pt-PT')}
                                  </div>
                                </div>
                              </div>

                              {/* Hover actions */}
                              <div className="absolute right-2.5 bottom-2.5 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!backup.content) {
                                      alert('Este backup antigo foi otimizado (o conteúdo detalhado da base de dados foi descartado para respeitar a quota de armazenamento de 5MB do Browser). Por favor, descarregue/restaure a partir do backup mais recente.');
                                      return;
                                    }
                                    const blob = new Blob([backup.content], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = backup.filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                  }}
                                  className="p-1 hover:bg-slate-205 text-slate-600 rounded cursor-pointer"
                                  title={backup.content ? "Exportar Ficheiro (.json)" : "Conteúdo Otimizado por Limite de Quota"}
                                >
                                  <Download className={`h-3.5 w-3.5 ${!backup.content ? 'text-slate-350 cursor-not-allowed' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!backup.content) {
                                      alert('Este backup antigo foi otimizado (o conteúdo detalhado da base de dados foi descartado para respeitar a quota de armazenamento de 5MB do Browser). Por favor, descarregue/restaure a partir do backup mais recente.');
                                      return;
                                    }
                                    if (window.confirm('Substituir base de dados atual por esta cópia de segurança?')) {
                                      const res = restoreDatabase(backup.content);
                                      if (res.success) {
                                        alert(res.message);
                                        setProcessosList(getProcessos());
                                        setJuizes(getJuizes());
                                        setAdvogados(getAdvogados());
                                        setGlobalProcuradores(getProcuradores());
                                        setBackupsList(getBackupsList());
                                      } else {
                                        alert(res.message);
                                      }
                                    }
                                  }}
                                  className="p-1 hover:bg-slate-205 text-blue-600 rounded cursor-pointer"
                                  title={backup.content ? "Restaurar a partir desta cópia" : "Conteúdo Otimizado por Limite de Quota"}
                                >
                                  <UploadCloud className={`h-3.5 w-3.5 ${!backup.content ? 'text-slate-350 cursor-not-allowed' : ''}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Tem a certeza que deseja eliminar o backup "${backup.filename}"?`)) {
                                      setBackupsList(deleteBackup(backup.id));
                                    }
                                  }}
                                  className="p-1 hover:bg-red-50 text-red-650 rounded cursor-pointer"
                                  title="Eliminar este backup permanentemente"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {backupsList.length === 0 && (
                            <div className="text-center py-6 text-slate-400 italic">
                              Nenhuma cópia de segurança em C:\GestaoProcessos\Backup
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Active Profiles Custom Console (Admin or User Profile) */}
              {activeTab === 'utilizadores' && (
                <div className="space-y-6">
                  {currentUser.role !== 'administrador' ? (
                    <div className="max-w-xl bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6 animate-in fade-in duration-250">
                      <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-lg select-none shadow-xs">
                          {currentUser.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-slate-905">Perfil de Utilizador</h2>
                          <span className="text-[9px] text-indigo-700 bg-indigo-50 uppercase font-black px-2 py-0.5 rounded tracking-wider border border-indigo-150 mt-1 block w-fit">
                            Acesso Consulta & Registo
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 text-xs font-medium">
                        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Nome de Utilizador</span>
                            <span className="text-sm font-bold text-slate-800 font-mono">{currentUser.username}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Perfil Local</span>
                            <span className="text-xs font-bold text-slate-700 capitalize flex items-center gap-1">👤 Oficial de Justiça</span>
                          </div>
                        </div>

                        <div className="border-b border-slate-100 pb-4">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Aceder / Ver Palavra-Passe</span>
                          <div className="flex items-center gap-2 bg-slate-50 border border-slate-205 rounded-xl px-3.5 py-1.8 w-fit min-w-[200px]">
                            <span className="font-mono text-xs text-slate-705 font-bold tracking-widest">
                              {visiblePasswords[currentUser.username] ? currentUser.password || '(Sem senha)' : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [currentUser.username]: !prev[currentUser.username] }))}
                              className="text-slate-450 hover:text-indigo-600 focus:outline-hidden transition-colors ml-auto cursor-pointer"
                              title={visiblePasswords[currentUser.username] ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                            >
                              {visiblePasswords[currentUser.username] ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Tribunal e Seção Associada</span>
                          <span className="text-xs text-slate-705 font-bold mt-1 block">
                            {(() => {
                              const court = tribunaisList.find(c => c.id === currentUser.tribunalId);
                              return court ? `🏛️ ${court.tribunal} (${court.localidade})` : 'Sem Comarca Associada / Secção Geral';
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-display flex items-center gap-2">
                          🏛️ Painel de Administração Geral
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Faça a gestão dos utilizadores do sistema, tribunais de comarca, juízes, advogados e área de arquivo.
                        </p>
                      </div>

                  {/* Sub Tab Switcher */}
                  <div className="flex flex-wrap border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveAdminSubTab('utilizadores')}
                      className={`py-2.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                        activeAdminSubTab === 'utilizadores'
                          ? 'border-blue-600 text-blue-600 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      👥 Utilizadores ({allUsers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAdminSubTab('tribunais')}
                      className={`py-2.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                        activeAdminSubTab === 'tribunais'
                          ? 'border-blue-600 text-blue-600 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      🏛️ Comarcas e Secções ({tribunaisList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAdminSubTab('classificacoes')}
                      className={`py-2.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                        activeAdminSubTab === 'classificacoes'
                          ? 'border-blue-600 text-blue-600 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      📁 Classificação de Atos
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAdminSubTab('agentes')}
                      className={`py-2.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                        activeAdminSubTab === 'agentes'
                          ? 'border-blue-600 text-blue-600 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      ⚖️ Magistrados & Mandatários
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAdminSubTab('hierarquiaCivel')}
                      className={`py-2.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                        activeAdminSubTab === 'hierarquiaCivel'
                          ? 'border-blue-600 text-blue-600 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      🏗️ Estrutura Processual
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAdminSubTab('auditoria')}
                      className={`py-2.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                        activeAdminSubTab === 'auditoria'
                          ? 'border-blue-600 text-blue-600 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      🛡️ Auditoria
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAdminSubTab('arquivo')}
                      className={`py-2.5 px-4 text-xs font-semibold border-b-2 -mb-px transition-all cursor-pointer ${
                        activeAdminSubTab === 'arquivo'
                          ? 'border-blue-600 text-red-650 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      📦 Área de Arquivo (Restauro / Definitivo)
                    </button>
                  </div>

                  {activeAdminSubTab === 'utilizadores' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Add User form */}
                      <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-fit">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-2 mb-4">
                          Criar Novo Perfil
                        </span>

                        <form onSubmit={handleCreateProfileSubmit} className="space-y-4 text-xs">
                          {userManageError && (
                            <div className="rounded-lg bg-red-50 p-3 border border-red-100 text-red-750 flex items-start gap-2.5">
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                              <span>{userManageError}</span>
                            </div>
                          )}

                          {userManageSuccess && (
                            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100 text-emerald-700 flex items-start gap-2.5">
                              <UserCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                              <span>{userManageSuccess}</span>
                            </div>
                          )}

                          <div>
                            <label htmlFor="new-u" className="block text-[10px] text-slate-455 font-bold uppercase tracking-wider mb-1">
                              Nome de Utilizador (Username) *
                            </label>
                            <input
                              type="text"
                              id="new-u"
                              required
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              placeholder="ex: joao_silva"
                              className="block w-full rounded bg-slate-50 border border-slate-200 px-3 py-1.8 text-xs text-slate-700 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label htmlFor="new-p" className="block text-[10px] text-slate-455 font-bold uppercase tracking-wider mb-1">
                              Palavra-Passe (Password) *
                            </label>
                            <input
                              type="password"
                              id="new-p"
                              required
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className="block w-full rounded bg-slate-50 border border-slate-200 px-3 py-1.8 text-xs text-slate-700 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label htmlFor="new-r" className="block text-[10px] text-slate-455 font-bold uppercase tracking-wider mb-1">
                              Categoria / Perfil de Acesso *
                            </label>
                            <select
                              id="new-r"
                              value={newRole}
                              onChange={(e) => setNewRole(e.target.value as any)}
                              className="block w-full rounded border border-slate-200 px-3 py-1.8 text-xs text-slate-705 font-medium focus:border-blue-500 bg-white"
                            >
                              <option value="utilizador">Utilizador (Consulta & Registo)</option>
                              <option value="administrador">Administrador (Controlo Total)</option>
                            </select>
                          </div>

                          <div>
                            <label htmlFor="new-u-tribunal" className="block text-[10px] text-slate-455 font-bold uppercase tracking-wider mb-1">
                              Tribunal Associado *
                            </label>
                            <select
                              id="new-u-tribunal"
                              required
                              value={newUsernameTribunalId}
                              onChange={(e) => setNewUsernameTribunalId(e.target.value)}
                              className="block w-full rounded border border-slate-200 px-3 py-1.8 text-xs text-slate-700 font-medium focus:border-blue-500 bg-white"
                            >
                              {tribunaisList.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.tribunal} ({t.localidade})
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="submit"
                            className="w-full flex justify-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer font-display"
                          >
                            Salvar Novo Utilizador
                          </button>
                        </form>
                      </div>

                      {/* Users list overview */}
                      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 mb-4 gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                            Perfis Ativos na Base Escolar/Judicial ({allUsers.length})
                          </span>
                          <div className="w-full sm:w-64 shrink-0">
                            <input
                              type="text"
                              placeholder="Pesquisar utilizador pelo nome..."
                              value={adminUserFilter}
                              onChange={(e) => setAdminUserFilter(e.target.value)}
                              className="block w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-1 text-xs text-slate-700 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 max-h-[30rem] overflow-y-auto w-full">
                          {[...allUsers]
                            .filter(u => u.username.toLowerCase().includes(adminUserFilter.toLowerCase()))
                            .sort((a, b) => a.username.localeCompare(b.username))
                            .map((user) => {
                              const court = tribunaisList.find(c => c.id === user.tribunalId);
                              return (
                                <div key={user.username} className="py-3 flex justify-between items-center text-xs">
                                  <div className="space-y-0.5">
                                    <span className="font-semibold text-slate-800 block">{user.username}</span>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-slate-400 font-mono">Dispositivo local • Criado em: {user.createdAt ? user.createdAt.split('T')[0] : 'Instalação'}</span>
                                      <span className="text-[9px] text-blue-600 font-semibold">{court ? `🏛️ ${court.tribunal}` : 'Sem Tribunal Associado'}</span>
                                      
                                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 w-fit">
                                        <span className="font-mono">Pass:</span>
                                        <span className="font-mono text-slate-705 font-bold">
                                          {visiblePasswords[user.username] ? user.password || '(Sem senha)' : '••••••••'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setVisiblePasswords(prev => ({ ...prev, [user.username]: !prev[user.username] }))}
                                          className="text-slate-450 hover:text-slate-700 focus:outline-hidden transition-colors cursor-pointer"
                                          title={visiblePasswords[user.username] ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                                        >
                                          {visiblePasswords[user.username] ? (
                                            <EyeOff className="h-3 w-3" />
                                          ) : (
                                            <Eye className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>

                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    user.role === 'administrador'
                                      ? 'bg-slate-100 text-slate-705 border border-slate-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-150'
                                  }`}>
                                    {user.role}
                                  </span>
                                </div>
                              );
                            })}
                          {[...allUsers].filter(u => u.username.toLowerCase().includes(adminUserFilter.toLowerCase())).length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-xs italic">
                              Nenhum utilizador corresponde ao filtro pesquisado.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAdminSubTab === 'tribunais' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200" id="tribunais-admin-panel">
                      {/* Form to add a new court */}
                      <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-4" id="add-tribunal-card">
                        <div>
                          <strong className="text-xs font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-2 mb-3">
                            Adicionar Nova Comarca / Seção
                          </strong>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Registe novos tribunais ou secções judiciais na base local para associar a secretarias, funcionários ou modelos de notificação.
                          </p>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleCreateTribunal(e); }} className="space-y-4 text-xs font-medium" id="add-tribunal-form">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              Localidade / Divisão Comarca *
                            </label>
                            <input
                              id="new-tribunal-localidade"
                              type="text"
                              value={newTribunalLocalidade}
                              onChange={(e) => setNewTribunalLocalidade(e.target.value)}
                              placeholder="Ex: Lisboa, Porto, Coimbra"
                              className="block w-full rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-700 font-medium focus:border-blue-500 focus:outline-hidden"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              Nome da Secção ou Juízo *
                            </label>
                            <input
                              id="new-tribunal-nome"
                              type="text"
                              value={newTribunalNome}
                              onChange={(e) => setNewTribunalNome(e.target.value)}
                              placeholder="Ex: Juízo Central Cível - Juiz 2"
                              className="block w-full rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-700 font-medium focus:border-blue-500 focus:outline-hidden"
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              URL Imagem de Cabeçalho Oficial (Opcional)
                            </label>
                            <input
                              id="new-tribunal-header"
                              type="text"
                              value={newTribunalImagemCabecalho}
                              onChange={(e) => setNewTribunalImagemCabecalho(e.target.value)}
                              placeholder="Ex: https://...logo.png"
                              className="block w-full rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs text-slate-600 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>

                          <button
                            id="save-tribunal-btn"
                            type="submit"
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                          >
                            ➕ Guardar Comarca
                          </button>
                        </form>
                      </div>

                      {/* Active courts list */}
                      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="tribunais-list-card">
                        <div className="border-b border-slate-100 pb-3 mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                            Tribunais e Secções Registadas ({tribunaisList.length})
                          </span>
                        </div>

                        <div className="divide-y divide-slate-100 max-h-[30rem] overflow-y-auto" id="tribunais-list-container">
                          {tribunaisList.map((t) => (
                            <div key={t.id} className="py-3 flex justify-between items-center text-xs" id={`tribunal-item-${t.id}`}>
                              <div className="space-y-1">
                                <span className="font-bold text-slate-800 text-xs block">🏛️ {t.tribunal}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">Divisão de Comarca: <strong className="text-slate-600">{t.localidade}</strong></span>
                                {t.imagemCabecalho && (
                                  <span className="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium inline-block mt-1">
                                    Cabeçalho Personalizado Ativado
                                  </span>
                                )}
                              </div>
                              <button
                                id={`delete-tribunal-btn-${t.id}`}
                                type="button"
                                onClick={() => handleDeleteTribunal(t.id)}
                                className="px-2.5 py-1 text-red-700 hover:bg-red-50 border border-red-100 rounded font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                              >
                                Apagar
                              </button>
                            </div>
                          ))}
                          {tribunaisList.length === 0 && (
                            <div className="text-center py-8 text-slate-400 text-xs italic" id="no-tribunais-placeholder">
                              Nenhum tribunal registado. Adicione um novo no formulário à esquerda.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAdminSubTab === 'classificacoes' && (
                    <AdminClassificacoesSubTab />
                  )}

                  {activeAdminSubTab === 'hierarquiaCivel' && (
                    <AdminHierarchyPanel processos={processosList} />
                  )}

                  {activeAdminSubTab === 'auditoria' && (
                    <AdminAuditPanel />
                  )}

                  {activeAdminSubTab === 'agentes' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                        
                        {/* SECTION: JUÍZES */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest block font-display">
                              Magistrados / Juízes de Direito
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                              juizes.length > 20 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {juizes.length > 20 ? 'Autocomplete Ativo (>20)' : 'Lista Dropdown Ativa'}
                            </span>
                          </div>

                          {/* Status reports */}
                          {juizError && (
                            <div className="rounded-lg bg-red-50 p-3 border border-red-100 text-red-600 text-xs">
                              {juizError}
                            </div>
                          )}
                          {juizSuccess && (
                            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100 text-emerald-700 text-xs">
                              {juizSuccess}
                            </div>
                          )}

                          {/* Reg Form */}
                          <form onSubmit={handleCreateJuiz} className="flex gap-2">
                            <input
                              type="text"
                              required
                              value={novoJuizNome}
                              onChange={(e) => setNovoJuizNome(e.target.value)}
                              placeholder="Nome completo do Juiz (ex: Dr. António de Sousa)..."
                              className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
                            >
                              Adicionar
                            </button>
                          </form>

                          {/* Scrollable list */}
                          <div className="flex-1 space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                            {juizes.map((nome) => (
                              <div key={nome} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                {editingJuizNome === nome ? (
                                  <div className="flex-1 flex gap-2">
                                    <input
                                      type="text"
                                      className="flex-1 rounded border border-blue-400 px-2 py-1 text-xs text-slate-705 font-medium focus:outline-hidden"
                                      value={editingJuizVal}
                                      onChange={(e) => setEditingJuizVal(e.target.value)}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleEditJuiz(nome, editingJuizVal)}
                                      className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-755 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingJuizNome(null); setEditingJuizVal(''); }}
                                      className="px-2.5 py-1 text-xs bg-slate-555 hover:bg-slate-655 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✗
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                      <span className="font-semibold text-slate-750">{nome}</span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => { setEditingJuizNome(nome); setEditingJuizVal(nome); }}
                                        className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteJuiz(nome)}
                                        className="text-red-555 hover:bg-red-55 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        remover
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            {juizes.length === 0 && (
                              <div className="text-center py-8 text-slate-400 italic">
                                Nenhum juiz registado na base de dados.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SECTION: ADVOGADOS */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest block font-display">
                              Advogados Regulamentados
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                              advogados.length > 20 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {advogados.length > 20 ? 'Autocomplete Ativo (>20)' : 'Lista Dropdown Ativa'}
                            </span>
                          </div>

                          {/* Status reports */}
                          {advogadoError && (
                            <div className="rounded-lg bg-red-50 p-3 border border-red-100 text-red-600 text-xs">
                              {advogadoError}
                            </div>
                          )}
                          {advogadoSuccess && (
                            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100 text-emerald-700 text-xs">
                              {advogadoSuccess}
                            </div>
                          )}

                          {/* Reg Form */}
                          <form onSubmit={handleCreateAdvogado} className="flex gap-2">
                            <input
                              type="text"
                              required
                              value={novoAdvNome}
                              onChange={(e) => setNovoAdvNome(e.target.value)}
                              placeholder="Nome completo do Advogado (ex: Dra. Sofia Vasconcelos)..."
                              className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
                            >
                              Adicionar
                            </button>
                          </form>

                          {/* Scrollable list */}
                          <div className="flex-1 space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                            {advogados.map((nome) => (
                              <div key={nome} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                                {editingAdvNome === nome ? (
                                  <div className="flex-1 flex gap-2">
                                    <input
                                      type="text"
                                      className="flex-1 rounded border border-blue-400 px-2 py-1 text-xs text-slate-705 font-medium focus:outline-hidden"
                                      value={editingAdvVal}
                                      onChange={(e) => setEditingAdvVal(e.target.value)}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleEditAdvogado(nome, editingAdvVal)}
                                      className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-755 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingAdvNome(null); setEditingAdvVal(''); }}
                                      className="px-2.5 py-1 text-xs bg-slate-555 hover:bg-slate-655 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✗
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                      <button
                                        type="button"
                                        onClick={() => setFichaConsultarNome(nome)}
                                        className="font-semibold text-slate-755 hover:text-blue-600 hover:underline text-left cursor-pointer focus:outline-hidden text-xs"
                                        title="Visualizar Ficha de Advogado"
                                      >
                                        {nome}
                                      </button>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => { setEditingAdvNome(nome); setEditingAdvVal(nome); }}
                                        className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteAdvogado(nome)}
                                        className="text-red-555 hover:bg-red-55 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        remover
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            {advogados.length === 0 && (
                              <div className="text-center py-8 text-slate-400 italic">
                                Nenhum advogado registado na base de dados.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SECTION: PROCURADORES */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest block font-display">
                              Procuradores do Ministério Público
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                              globalProcuradores.length > 20 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {globalProcuradores.length > 20 ? 'Autocomplete Ativo (>20)' : 'Lista Dropdown Ativa'}
                            </span>
                          </div>

                          {/* Status reports */}
                          {procuradorError && (
                            <div className="rounded-lg bg-red-50 p-3 border border-red-100 text-red-600 text-xs">
                              {procuradorError}
                            </div>
                          )}
                          {procuradorSuccess && (
                            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100 text-emerald-700 text-xs">
                              {procuradorSuccess}
                            </div>
                          )}

                          {/* Reg Form */}
                          <form onSubmit={handleCreateProcurador} className="flex gap-2">
                            <input
                              type="text"
                              required
                              value={novoProcuradorNome}
                              onChange={(e) => setNovoProcuradorNome(e.target.value)}
                              placeholder="Nome completo do Procurador (ex: Dr. Ricardo Mendes)..."
                              className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-705 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
                            >
                              Adicionar
                            </button>
                          </form>

                          {/* Scrollable list */}
                          <div className="flex-1 space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                            {globalProcuradores.map((nome) => (
                              <div key={nome} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                                {editingProcuradorNome === nome ? (
                                  <div className="flex-1 flex gap-2">
                                    <input
                                      type="text"
                                      className="flex-1 rounded border border-blue-400 px-2 py-1 text-xs text-slate-705 font-medium focus:outline-hidden"
                                      value={editingProcuradorVal}
                                      onChange={(e) => setEditingProcuradorVal(e.target.value)}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleEditProcurador(nome, editingProcuradorVal)}
                                      className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-755 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingProcuradorNome(null); setEditingProcuradorVal(''); }}
                                      className="px-2.5 py-1 text-xs bg-slate-555 hover:bg-slate-655 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✗
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                      <span className="font-semibold text-slate-755">{nome}</span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => { setEditingProcuradorNome(nome); setEditingProcuradorVal(nome); }}
                                        className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProcurador(nome)}
                                        className="text-red-555 hover:bg-red-55 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        remover
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            {globalProcuradores.length === 0 && (
                              <div className="text-center py-8 text-slate-400 italic">
                                Nenhum procurador registado na base de dados.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SECTION: FUNCIONÁRIOS */}
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest block font-display">
                              Funcionários da Secretaria
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                              funcionarios.length > 20 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {funcionarios.length > 20 ? 'Autocomplete Ativo (>20)' : 'Lista Dropdown Ativa'}
                            </span>
                          </div>

                          {/* Status reports */}
                          {funcionarioError && (
                            <div className="rounded-lg bg-red-50 p-3 border border-red-100 text-red-600 text-xs">
                              {funcionarioError}
                            </div>
                          )}
                          {funcionarioSuccess && (
                            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100 text-emerald-700 text-xs">
                              {funcionarioSuccess}
                            </div>
                          )}

                          {/* Reg Form */}
                          <form onSubmit={handleCreateFuncionario} className="flex gap-2">
                            <input
                              type="text"
                              required
                              value={novoFuncionarioNome}
                              onChange={(e) => setNovoFuncionarioNome(e.target.value)}
                              placeholder="Nome do funcionário (ex: Ana Fonseca (Oficial))..."
                              className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-705 font-medium focus:border-blue-500 focus:outline-hidden"
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
                            >
                              Adicionar
                            </button>
                          </form>

                          {/* Scrollable list */}
                          <div className="flex-1 space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                            {funcionarios.map((nome) => (
                              <div key={nome} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                                {editingFuncionarioNome === nome ? (
                                  <div className="flex-1 flex gap-2">
                                    <input
                                      type="text"
                                      className="flex-1 rounded border border-blue-400 px-2 py-1 text-xs text-slate-705 font-medium focus:outline-hidden"
                                      value={editingFuncionarioVal}
                                      onChange={(e) => setEditingFuncionarioVal(e.target.value)}
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleEditFuncionario(nome, editingFuncionarioVal)}
                                      className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-755 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingFuncionarioNome(null); setEditingFuncionarioVal(''); }}
                                      className="px-2.5 py-1 text-xs bg-slate-555 hover:bg-slate-655 text-white rounded font-bold transition-colors cursor-pointer"
                                    >
                                      ✗
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                                      <span className="font-semibold text-slate-755">{nome}</span>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => { setEditingFuncionarioNome(nome); setEditingFuncionarioVal(nome); }}
                                        className="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteFuncionario(nome)}
                                        className="text-red-555 hover:bg-red-55 px-2 py-1 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                      >
                                        remover
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            {funcionarios.length === 0 && (
                              <div className="text-center py-8 text-slate-400 italic">
                                Nenhum funcionário registado na base de dados.
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {activeAdminSubTab === 'arquivo' && (
                    <div className="space-y-6">
                      {/* Painel de Controlo de Ação Global do Arquivo */}
                      <div className="bg-gradient-to-r from-red-50/40 to-slate-100 rounded-2xl border border-dashed border-red-200 p-6 flex flex-col gap-6 shadow-3xs">
                        {/* Row 1: Global Actions */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <strong className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <span>🧹</span> Ações Globais do Arquivo (Limpeza e Reativação Completa)
                            </strong>
                            <p className="text-xs text-slate-500 leading-normal">
                              Restaure absolutamente tudo com um clique ou esvazie todo o arquivo para limpar a base de dados em massa de forma irreversível.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2.5 shrink-0">
                            <button
                              type="button"
                              onClick={handleRestoreAllArchived}
                              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white border border-transparent rounded-xl text-xs font-bold shadow-xs transition-transform hover:scale-[1.02] cursor-pointer"
                            >
                              🔄 Reativar Tudo
                            </button>
                            <button
                              type="button"
                              onClick={handleEmptyArchivePermanently}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white border border-transparent rounded-xl text-xs font-bold shadow-xs transition-transform hover:scale-[1.02] cursor-pointer"
                            >
                              🗑️ Eliminar Tudo Definitivamente
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Selected Actions, only visible when elements are selected */}
                        {(selectedArchivedProcessos.length > 0 || 
                          selectedArchivedDocumentos.length > 0 || 
                          selectedArchivedAreas.length > 0 || 
                          selectedArchivedEspecies.length > 0 || 
                          selectedArchivedAccoes.length > 0) && (
                          <div className="border-t border-slate-200 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 text-xs"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 text-xs"></span>
                              </span>
                              <span className="text-xs font-semibold text-blue-700">
                                {selectedArchivedProcessos.length + selectedArchivedDocumentos.length + selectedArchivedAreas.length + selectedArchivedEspecies.length + selectedArchivedAccoes.length} elementos selecionados no total.
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={handleReativarSelecionados}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-transform hover:scale-[1.02] cursor-pointer"
                              >
                                🔄 Reativar Selecionados
                              </button>
                              <button
                                type="button"
                                onClick={handleEliminarSelecionados}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-transform hover:scale-[1.02] cursor-pointer"
                              >
                                🗑️ Eliminar Selecionados Definitivamente
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                          <Archive className="h-4 w-4 text-red-500" />
                          <h3 className="text-xs font-bold text-slate-805 uppercase tracking-widest block font-display">
                            Processos em Área de Arquivo (Soft Delete)
                          </h3>
                        </div>

                        {processosList.filter(p => p.deleted).length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Nenhum processo no arquivo de eliminação temporária.</p>
                        ) : (
                          <div className="overflow-x-auto text-xs">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  <th className="p-3 w-8">
                                    <input type="checkbox" onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedArchivedProcessos(processosList.filter(p => p.deleted).map(p => p.id));
                                      } else {
                                        setSelectedArchivedProcessos([]);
                                      }
                                    }} />
                                  </th>
                                  <th className="p-3">Num. Processo</th>
                                  <th className="p-3">Intervenientes</th>
                                  <th className="p-3">Data Eliminação</th>
                                  <th className="p-3 text-right">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {processosList.filter(p => p.deleted).map(p => (
                                  <tr key={p.id} className="hover:bg-slate-50/50">
                                    <td className="p-3">
                                      <input type="checkbox" checked={selectedArchivedProcessos.includes(p.id)} onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedArchivedProcessos([...selectedArchivedProcessos, p.id]);
                                        } else {
                                          setSelectedArchivedProcessos(selectedArchivedProcessos.filter(id => id !== p.id));
                                        }
                                      }} />
                                    </td>
                                    <td className="p-3 font-bold font-mono text-slate-900">{p.numero}</td>
                                    <td className="p-3">
                                      <p className="text-slate-755 font-medium">Auto: {p.autores.join(', ')}</p>
                                      <p className="text-slate-500">Réu: {p.reus.join(', ')}</p>
                                    </td>
                                    <td className="p-3 font-mono text-slate-400">
                                      {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sem data'}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`Deseja reativar o processo ${p.numero}? Ele voltará à lista principal de processos ordinários.`)) {
                                            if (currentUser) { logAction(currentUser.username, 'Reativação de processo', p.numero, `Processo ${p.numero} reativado da área de arquivo.`); } const updated = processosList.map(item => item.id === p.id ? { ...item, deleted: false, deletedAt: undefined } : item);
                                            setProcessosList(updated);
                                            localStorage.setItem('gestao_processos_processos', JSON.stringify(updated));
                                            alert('Processo reativado com sucesso!');
                                          }
                                        }}
                                        className="px-2.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 rounded font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                                      >
                                        Reativar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`AVISO CRÍTICO DE ELIMINAÇÃO DEFINITIVA:\nEsta ação apagará permanentemente o processo ${p.numero} da sua base de dados offline local, incluindo todo o seu histórico e documentos associados de forma irreversível.\nTem ABSOLUTA certeza de que quer continuar?`)) {
                                            if (currentUser) { logAction(currentUser.username, 'Eliminação definitiva de processo', p.numero, `Processo ${p.numero} apagado definitivamente.`); } const updated = processosList.filter(item => item.id !== p.id);
                                            setProcessosList(updated);
                                            localStorage.setItem('gestao_processos_processos', JSON.stringify(updated));
                                            alert('Processo apagado definitivamente com sucesso!');
                                          }
                                        }}
                                        className="px-2.5 py-1 text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                                      >
                                        Eliminar Definitivamente
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          <h3 className="text-xs font-bold text-slate-805 uppercase tracking-widest block font-display">
                            Documentos Avulsos / Anexos no Arquivo
                          </h3>
                        </div>

                        {(() => {
                          const deletedDocs: Array<{ doc: Documento; processNumero: string; processId: string; atoDescricao?: string }> = [];
                          processosList.forEach(p => {
                            if (p.documentos) {
                              p.documentos.forEach(d => {
                                if (d.deleted) {
                                  const associatedAto = p.historicoAtos?.find(a => a.documentosIds?.includes(d.id));
                                  const atoDescricao = associatedAto 
                                    ? `${associatedAto.tipoAto || 'Ato'} (${associatedAto.descricao})` 
                                    : 'Ficheiro Geral Anexo ao Processo';
                                  deletedDocs.push({ doc: d, processNumero: p.numero, processId: p.id, atoDescricao });
                                }
                              });
                            }
                          });

                          if (deletedDocs.length === 0) {
                            return <p className="text-xs text-slate-400 italic">Nenhum documento no arquivo de eliminação temporária.</p>;
                          }

                          return (
                            <div className="overflow-x-auto text-xs">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    <th className="p-3 w-8">
                                      <input type="checkbox" onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedArchivedDocumentos(deletedDocs.map(d => d.doc.id));
                                        } else {
                                          setSelectedArchivedDocumentos([]);
                                        }
                                      }} />
                                    </th>
                                    <th className="p-3">Nome Ficheiro</th>
                                    <th className="p-3">Classificação</th>
                                    <th className="p-3">Origem (Processo e Ato)</th>
                                    <th className="p-3">Data Eliminação</th>
                                    <th className="p-3 text-right">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {deletedDocs.map(({ doc, processNumero, processId, atoDescricao }) => (
                                    <tr key={doc.id} className="hover:bg-slate-50/50">
                                      <td className="p-3">
                                        <input type="checkbox" checked={selectedArchivedDocumentos.includes(doc.id)} onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedArchivedDocumentos([...selectedArchivedDocumentos, doc.id]);
                                          } else {
                                            setSelectedArchivedDocumentos(selectedArchivedDocumentos.filter(id => id !== doc.id));
                                          }
                                        }} />
                                      </td>
                                      <td className="p-3 font-bold font-mono text-slate-900 truncate max-w-[200px]">{doc.nome}</td>
                                      <td className="p-3">
                                        <span className="bg-slate-100 text-slate-650 px-2 py-0.5 rounded font-mono text-[10.5px]">
                                          {doc.categoria}
                                        </span>
                                      </td>
                                      <td className="p-3 leading-relaxed">
                                        <div className="font-semibold text-slate-700 font-mono">Processo nº {processNumero}</div>
                                        <div className="text-[10px] text-slate-500 italic mt-0.5">Origem: {atoDescricao}</div>
                                      </td>
                                      <td className="p-3 font-mono text-slate-400">
                                        {doc.deletedAt ? new Date(doc.deletedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sem data'}
                                      </td>
                                      <td className="p-3 text-right space-x-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`Deseja reativar o documento ${doc.nome} no processo ${processNumero}?`)) {
                                              const updated = processosList.map(proc => {
                                                if (proc.id === processId) {
                                                  if (currentUser) { logAction(currentUser.username, 'Reativação de documento', processNumero, `Documento '${doc.nome}' reativado do arquivo.`); } const docs = proc.documentos.map(d => d.id === doc.id ? { ...d, deleted: false, deletedAt: undefined } : d);
                                                  return { ...proc, documentos: docs };
                                                }
                                                return proc;
                                              });
                                              setProcessosList(updated);
                                              localStorage.setItem('gestao_processos_processos', JSON.stringify(updated));
                                              alert('Documento reativado com sucesso!');
                                            }
                                          }}
                                          className="px-2.5 py-1 text-emerald-850 bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 rounded font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                                        >
                                          Reativar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm(`Deseja apagar definitivamente o documento ${doc.nome}? Esta ação é irreversível.`)) {
                                              const updated = processosList.map(proc => {
                                                if (proc.id === processId) {
                                                  if (currentUser) { logAction(currentUser.username, 'Eliminação definitiva de documento', processNumero, `Documento '${doc.nome}' apagado definitivamente do acervo digital.`); } const docs = proc.documentos.filter(d => d.id !== doc.id);
                                                  return { ...proc, documentos: docs };
                                                }
                                                return proc;
                                              });
                                              setProcessosList(updated);
                                              localStorage.setItem('gestao_processos_processos', JSON.stringify(updated));
                                              alert('Documento apagado definitivamente com sucesso!');
                                            }
                                          }}
                                          className="px-2.5 py-1 text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                                        >
                                          Eliminar Definitivamente
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Hierarchical structural elements currently archived */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-red-500" />
                            <h3 className="text-xs font-bold text-slate-805 uppercase tracking-widest block font-display">
                              Estruturas de Classificação Arquivadas (Soft Delete)
                            </h3>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                            Versão: {hierarchyVersion}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* 1. Areas Card */}
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-600 border-b border-slate-100 pb-1.5 flex justify-between">
                              <span>📁 Áreas Processuais ({getStoredAreasHierarchy().filter(a => a.deleted).length})</span>
                            </h4>
                            {getStoredAreasHierarchy().filter(a => a.deleted).length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">Nenhuma área arquivada.</p>
                            ) : (
                              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                {getStoredAreasHierarchy().filter(a => a.deleted).map(a => (
                                  <div key={a.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <input 
                                        type="checkbox" 
                                        checked={selectedArchivedAreas.includes(a.id)} 
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedArchivedAreas([...selectedArchivedAreas, a.id]);
                                          } else {
                                            setSelectedArchivedAreas(selectedArchivedAreas.filter(id => id !== a.id));
                                          }
                                        }} 
                                      />
                                      <span className="text-[11px] font-semibold text-slate-700 truncate">{a.nome}</span>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <button 
                                        type="button" 
                                        onClick={() => handleRestoreSingleArea(a.id)} 
                                        className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold transition-colors cursor-pointer"
                                        title="Reativar"
                                      >
                                        Reativar
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => handleDeleteSingleAreaPermanently(a.id, a.nome)} 
                                        className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-750 hover:bg-red-100 font-bold transition-colors cursor-pointer"
                                        title="Eliminar definitivamente"
                                      >
                                        Eliminar Definitivamente
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 2. Species Card */}
                          <div className="space-y-3">
                            {(() => {
                              const archivedEspecies: Array<{ areaId: string; areaNome: string; especie: CivilEspecie }> = [];
                              getStoredAreasHierarchy().forEach(a => {
                                if (a.especies) {
                                  a.especies.forEach(e => {
                                    if (e.deleted) {
                                      archivedEspecies.push({ areaId: a.id, areaNome: a.nome, especie: e });
                                    }
                                  });
                                }
                              });

                              return (
                                <>
                                  <h4 className="text-xs font-bold text-slate-600 border-b border-slate-100 pb-1.5">
                                    🏷️ Espécies Cíveis ({archivedEspecies.length})
                                  </h4>
                                  {archivedEspecies.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">Nenhuma espécie arquivada.</p>
                                  ) : (
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                      {archivedEspecies.map(({ areaId, areaNome, especie }) => {
                                        const key = `${areaId}|${especie.especie}`;
                                        return (
                                          <div key={key} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <input 
                                                  type="checkbox" 
                                                  checked={selectedArchivedEspecies.includes(key)} 
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      setSelectedArchivedEspecies([...selectedArchivedEspecies, key]);
                                                    } else {
                                                      setSelectedArchivedEspecies(selectedArchivedEspecies.filter(k => k !== key));
                                                    }
                                                  }} 
                                                />
                                                <span className="text-[11px] font-bold text-slate-705 truncate" title={especie.especie}>{especie.especie}</span>
                                              </div>
                                              <div className="flex gap-1 shrink-0">
                                                <button 
                                                  type="button" 
                                                  onClick={() => handleRestoreSingleEspecie(areaId, especie.especie)} 
                                                  className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold cursor-pointer"
                                                >
                                                  Reativar
                                                </button>
                                                <button 
                                                  type="button" 
                                                  onClick={() => handleDeleteSingleEspeciePermanently(areaId, especie.especie)} 
                                                  className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-750 hover:bg-red-100 font-bold cursor-pointer"
                                                >
                                                  Eliminar Definitivamente
                                                </button>
                                              </div>
                                            </div>
                                            <div className="text-[9px] text-slate-400 italic">Área original: {areaNome}</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* 3. Actions Card */}
                          <div className="space-y-3">
                            {(() => {
                              const archivedAccoes: Array<{ areaId: string; areaNome: string; especieName: string; accao: CivilActionType }> = [];
                              getStoredAreasHierarchy().forEach(a => {
                                if (a.especies) {
                                  a.especies.forEach(e => {
                                    if (e.accoes) {
                                      e.accoes.forEach(ac => {
                                        if (ac.deleted) {
                                          archivedAccoes.push({ areaId: a.id, areaNome: a.nome, especieName: e.especie, accao: ac });
                                        }
                                      });
                                    }
                                  });
                                }
                              });

                              return (
                                <>
                                  <h4 className="text-xs font-bold text-slate-600 border-b border-slate-100 pb-1.5">
                                    ⚡ Tipos de Ação ({archivedAccoes.length})
                                  </h4>
                                  {archivedAccoes.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">Nenhum tipo de ação arquivado.</p>
                                  ) : (
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                      {archivedAccoes.map(({ areaId, areaNome, especieName, accao }) => {
                                        const key = `${areaId}|${especieName}|${accao.nome}`;
                                        return (
                                          <div key={key} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <input 
                                                  type="checkbox" 
                                                  checked={selectedArchivedAccoes.includes(key)} 
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      setSelectedArchivedAccoes([...selectedArchivedAccoes, key]);
                                                    } else {
                                                      setSelectedArchivedAccoes(selectedArchivedAccoes.filter(k => k !== key));
                                                    }
                                                  }} 
                                                />
                                                <span className="text-[11px] font-bold text-slate-705 truncate" title={accao.nome}>{accao.nome}</span>
                                              </div>
                                              <div className="flex gap-1 shrink-0">
                                                <button 
                                                  type="button" 
                                                  onClick={() => handleRestoreSingleAccao(areaId, especieName, accao.nome)} 
                                                  className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold cursor-pointer"
                                                >
                                                  Reativar
                                                </button>
                                                <button 
                                                  type="button" 
                                                  onClick={() => handleDeleteSingleAccaoPermanently(areaId, especieName, accao.nome)} 
                                                  className="px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-750 hover:bg-red-100 font-bold cursor-pointer"
                                                >
                                                  Eliminar Definitivamente
                                                </button>
                                              </div>
                                            </div>
                                            <div className="text-[9px] text-slate-400 leading-normal italic">
                                              Origem: {areaNome} &gt; {especieName}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                    </>
                  )}
                </div>
              )}

              {activeTab === 'autoteste' && (
                <AutoTestePanel processes={processosList} />
              )}

              {activeTab === 'manual' && (
                <ManualUtilizador onNavigateToTab={(tab) => {
                  setSelectedProcessoNum(null);
                  setActiveTab(tab);
                }} />
              )}
            </React.Fragment>
          )}
        </main>
      </div>

      {/* MODAL: Beautiful Immersive Document Viewer */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-3xl h-[80vh] flex flex-col border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 font-display uppercase tracking-widest select-none leading-none">
                    Leitor de Documentos Judiciais (C:\)
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                    {previewDoc.nome}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 px-3 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                title="Fechar Leitor"
              >
                Voltar
              </button>
            </div>

            {/* Document metadata bar */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-150 text-[10px] text-slate-600 flex flex-wrap justify-between gap-2.5 select-none font-medium">
              <span>Categoria: <strong className="text-slate-800 uppercase font-bold">{previewDoc.categoria}</strong></span>
              <span>Apresentante: <strong className="text-slate-800 font-bold">{previewDoc.parteApresentante}</strong></span>
              <span>Advogado: <strong className="text-slate-800 font-bold">{previewDoc.advogadoApresentante}</strong></span>
              <span>Data Sancionada: <strong className="text-slate-800 font-mono font-bold">{previewDoc.dataApresentacao}</strong></span>
              <span>Tamanho: <strong className="text-slate-800 font-mono font-bold">{previewDoc.tamanho}</strong></span>
            </div>

            {/* Simulated file paper content */}
            <div className="flex-1 overflow-y-auto p-10 bg-slate-100/50 flex justify-center">
              <div className="w-full max-w-2xl bg-white border border-slate-200 p-8 shadow-sm rounded-lg min-h-[500px] text-xs font-sans text-slate-800 leading-relaxed space-y-4 whitespace-pre-wrap select-text">
                {previewDoc.conteudoTexto}
              </div>
            </div>

            {/* Viewer action footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sincronizado via Gestor de Processos Offline</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintFile(previewDoc)}
                  className="px-4 py-2 border border-slate-250 rounded-lg text-xs font-bold bg-white hover:bg-slate-50 text-slate-650 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Documento
                </button>
                <button
                  onClick={() => handleDownloadFile(previewDoc)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer font-display"
                >
                  <Download className="h-3.5 w-3.5" />
                  Efetuar Download para PC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFF-LINE PRINT LAYOUT EMBED: Automatically triggers native printing / browser prompt */}
      {printDoc && (
        <div className="fixed inset-0 bg-white z-9999 font-sans overflow-all flex flex-col p-8 print-only select-all">
          <div className="flex justify-between items-center border-b pb-4 mb-6 no-print">
            <div className="space-y-1">
              <span className="text-xs bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded font-mono font-medium">MODO DE IMPRESSÃO EXTRA-PROCESSO</span>
              <p className="text-xs text-zinc-400">Esta barra será omitida na impressão física ou PDF.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Confirmar Impressão / Emitir PDF
              </button>
              <button
                onClick={() => setPrintDoc(null)}
                className="px-4 py-2 border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-xs font-medium rounded-xl cursor-pointer"
              >
                Cancelar e Fechar
              </button>
            </div>
          </div>

          {/* Core Printable Sheet with clean styling */}
          <div className="w-full max-w-3xl mx-auto print-card space-y-8 p-4">
            
            {/* Header Emblazon */}
            <div className="text-center space-y-2 border-b-2 border-zinc-950 pb-6">
              <h2 className="text-base font-bold tracking-widest uppercase font-display text-zinc-900">
                REPÚBLICA PORTUGUESA &bull; MINISTÉRIO DA JUSTIÇA
              </h2>
              <h3 className="text-lg font-bold tracking-normal uppercase text-zinc-950 font-display">
                CERTIDÃO ELETRÓNICA E ARQUIVO LOCAL DE INSTÂNCIA
              </h3>
              <p className="text-[10px] text-zinc-400 font-mono">ID Único de Rastreamento: {printDoc.id.toUpperCase()}</p>
            </div>

            {/* Case file details */}
            <div className="grid grid-cols-2 gap-4 text-xs border border-zinc-300 p-4 rounded-lg bg-zinc-50/20">
              <div>
                <span className="block font-bold text-zinc-400 text-[9px] uppercase tracking-wide">Ficheiro Indexado</span>
                <span className="font-semibold text-zinc-900 text-xs font-mono">{printDoc.nome}</span>
              </div>
              <div>
                <span className="block font-bold text-zinc-400 text-[9px] uppercase tracking-wide">Secção Processual</span>
                <span className="font-semibold text-zinc-900 text-xs uppercase">{printDoc.categoria}</span>
              </div>
              <div>
                <span className="block font-bold text-zinc-400 text-[9px] uppercase tracking-wide">Apresentação</span>
                <span className="font-semibold text-zinc-900 text-xs">{printDoc.parteApresentante}</span>
              </div>
              <div>
                <span className="block font-bold text-zinc-400 text-[9px] uppercase tracking-wide">Data de Autuação</span>
                <span className="font-semibold text-zinc-900 text-xs font-mono">{printDoc.dataApresentacao}</span>
              </div>
            </div>

            {/* Raw legal brief body content */}
            <div className="space-y-4 pt-4 border-t border-zinc-200">
              <span className="block font-bold text-zinc-700 text-[10px] uppercase tracking-widest">TRANSCRIÇÃO DE FACTOS E PEÇA PROCESSUAL:</span>
              <div className="text-[12.5px] leading-relaxed font-sans text-zinc-800 whitespace-pre-wrap select-text px-2">
                {printDoc.conteudoTexto}
              </div>
            </div>

            {/* Regulatory Sign-off footer */}
            <div className="pt-16 text-center space-y-4 border-t border-dashed border-zinc-300 text-xs">
              <p className="italic text-zinc-500">Documento certificado e assinado digitalmente nos termos do arquivo de Instância Extrajudicial.</p>
              <div className="h-10 w-44 border border-zinc-200 rounded-md mx-auto flex items-center justify-center bg-zinc-50/50">
                <span className="text-[9px] font-mono tracking-widest text-zinc-400 uppercase select-none">ASSINATURA ELETRÓNICA</span>
              </div>
              <p className="text-[9px] text-zinc-400 font-mono">Emissão automática realizada em {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</p>
            </div>
          </div>
        </div>
      )}

      {/* Ficha consultation and creation/editing overlays */}
      <FichaConsultarModal
        nome={fichaConsultarNome}
        isOpen={!!fichaConsultarNome}
        onClose={() => setFichaConsultarNome('')}
        onUpdated={() => {
          setAdvogados(getAdvogados());
        }}
      />

      <FichaIntervenienteModal
        isOpen={fichaIntervenienteOpen}
        onClose={() => {
          setFichaIntervenienteOpen(false);
          setFichaIntervenienteExisting(undefined);
          setOnFichaIntervenienteSave(null);
        }}
        onSave={(ficha) => {
          if (onFichaIntervenienteSave) onFichaIntervenienteSave(ficha);
          setFichaIntervenienteOpen(false);
          setFichaIntervenienteExisting(undefined);
          setOnFichaIntervenienteSave(null);
        }}
        tipo={fichaIntervenienteTipo}
        initialNome={fichaIntervenienteName}
        existingFicha={fichaIntervenienteExisting}
      />

      <FichaAdvogadoModal
        isOpen={fichaAdvogadoOpen}
        onClose={() => {
          setFichaAdvogadoOpen(false);
          setFichaAdvogadoExisting(undefined);
          setOnFichaAdvogadoSave(null);
        }}
        onSave={(ficha) => {
          if (onFichaAdvogadoSave) onFichaAdvogadoSave(ficha);
          setFichaAdvogadoOpen(false);
          setFichaAdvogadoExisting(undefined);
          setOnFichaAdvogadoSave(null);
        }}
        initialNome={fichaAdvogadoName}
        existingFicha={fichaAdvogadoExisting}
      />
    </div>
  );
}

function AdminClassificacoesSubTab() {
  const [selectedNatureza, setSelectedNatureza] = useState<'crime' | 'civel'>('civel');
  const [newClassification, setNewClassification] = useState('');
  const [classifications, setClassifications] = useState<string[]>(() => getDocumentClassifications('civel'));
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchActQuery, setSearchActQuery] = useState('');

  // Editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleNaturezaChange = (tipo: 'crime' | 'civel') => {
    setSelectedNatureza(tipo);
    const loadedList = getDocumentClassifications(tipo);
    setClassifications(loadedList);
    setNewClassification('');
    setSuccessMsg('');
    setErrorMsg('');
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleAddClassification = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    const term = newClassification.trim();
    if (!term) return;

    if (classifications.map(c => c.toLowerCase()).includes(term.toLowerCase())) {
      setErrorMsg(`O tipo de ato "${term}" já se encontra cadastrado.`);
      return;
    }

    const updated = [...classifications, term];
    const saved = saveDocumentClassifications(selectedNatureza, updated);
    setClassifications(saved);
    setNewClassification('');
    setSuccessMsg(`Tipo de ato "${term}" adicionado com sucesso!`);
  };

  const handleRemoveClassification = (term: string) => {
    if (!confirm(`Deseja realmente eliminar o tipo de ato "${term}"?`)) return;
    setSuccessMsg('');
    setErrorMsg('');
    if (term.toLowerCase() === "requerimento") {
      setErrorMsg("O tipo de ato 'Requerimento' é obrigatório e não pode ser eliminado.");
      return;
    }

    const updated = classifications.filter(c => c !== term);
    const saved = saveDocumentClassifications(selectedNatureza, updated);
    setClassifications(saved);
    setSuccessMsg(`Tipo de ato "${term}" removido das opções disponíveis.`);
  };

  const handleSaveEdit = (oldTerm: string) => {
    const term = editingValue.trim();
    if (!term) return;
    setSuccessMsg('');
    setErrorMsg('');

    if (term.toLowerCase() !== oldTerm.toLowerCase() && classifications.map(c => c.toLowerCase()).includes(term.toLowerCase())) {
      setErrorMsg(`O tipo de ato "${term}" já existe.`);
      return;
    }

    const updated = classifications.map(c => c === oldTerm ? term : c);
    const saved = saveDocumentClassifications(selectedNatureza, updated);
    setClassifications(saved);
    setSuccessMsg(`Tipo de ato editado de "${oldTerm}" para "${term}" com sucesso!`);
    setEditingIndex(null);
    setEditingValue('');
  };

  // Filter & Group and sort alphabetically
  const filteredClassifications = classifications.filter(item =>
    matchesFuzzy(item, searchActQuery)
  );

  // Group by alphabetical letters
  type GroupedActs = Record<string, string[]>;
  const grouped: GroupedActs = {};
  filteredClassifications.forEach(item => {
    const letter = item.charAt(0).toUpperCase();
    const groupKey = /^[A-Z]/.test(letter) ? letter : '#';
    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }
    grouped[groupKey].push(item);
  });

  // Sort groups alphabetically
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b, 'pt', { sensitivity: 'base' });
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Coluna de Configuração */}
      <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-fit space-y-5">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-2 mb-3">
            Gerir Classificações de Atos
          </span>
          <p className="text-[11px] text-slate-500 leading-normal">
            Configure as categorias de atos disponíveis para registo e indexação nos processos judiciais, divididos pelos âmbitos cível e penal. Os atos criados aqui serão exibidos como opções ao registar novos atos no processo.
          </p>
        </div>

        {/* Âmbito Selector */}
        <div className="space-y-2">
          <label className="block text-[10px] text-slate-455 font-bold uppercase tracking-wider">
            Âmbito de Processos *
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => handleNaturezaChange('civel')}
              className={`py-1.5 px-3 rounded-md text-xs font-bold text-center transition-all cursor-pointer ${
                selectedNatureza === 'civel'
                  ? 'bg-white text-emerald-700 shadow-3xs border border-emerald-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💼 Processos Cíveis
            </button>
            <button
              type="button"
              onClick={() => handleNaturezaChange('crime')}
              className={`py-1.5 px-3 rounded-md text-xs font-bold text-center transition-all cursor-pointer ${
                selectedNatureza === 'crime'
                  ? 'bg-white text-rose-700 shadow-3xs border border-rose-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚖️ Processos Crime
            </button>
          </div>
        </div>

        {/* Formulário de Adição */}
        <form onSubmit={handleAddClassification} className="space-y-3.5 pt-2">
          {errorMsg && (
            <div className="rounded-lg bg-rose-50 p-3 border border-rose-100 text-[11px] font-medium text-rose-700">
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-100 text-[11px] font-medium text-emerald-700">
              ✓ {successMsg}
            </div>
          )}

          <div>
            <label htmlFor="new-classification-name" className="block text-[10px] text-slate-455 font-bold uppercase tracking-wider mb-1">
              Designação do Tipo de Ato *
            </label>
            <input
              type="text"
              id="new-classification-name"
              required
              placeholder="ex: Ata de Audiência, Citação de Credores, Sentença Final"
              value={newClassification}
              onChange={(e) => setNewClassification(e.target.value)}
              className="block w-full rounded border border-slate-200 px-3 py-2 text-xs text-slate-707 font-medium focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
          >
            Adicionar ao Âmbito {selectedNatureza === 'crime' ? 'Crime ⚖️' : 'Cível 💼'}
          </button>
        </form>
      </div>

      {/* Coluna de Exibição em Lista */}
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col space-y-4">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center bg-white">
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest block font-display">
              Tipologia de Atos Judiciais ({selectedNatureza === 'crime' ? 'Crime' : 'Cível'})
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Lista de tipos de atos permitidos para indexação. Estão organizados alfabeticamente por letras.
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
            selectedNatureza === 'crime' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {classifications.length} Categorias
          </span>
        </div>

        {/* Filtro de Pesquisa */}
        <div className="relative">
          <input
            type="text"
            placeholder="Pesquisar atos deste âmbito..."
            value={searchActQuery}
            onChange={(e) => setSearchActQuery(e.target.value)}
            className="w-full bg-slate-50 p-2.5 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Lista Alphabetical */}
        <div className="space-y-5 max-h-[460px] overflow-y-auto pr-1">
          {sortedKeys.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic text-xs">
              Nenhum tipo de ato corresponde à pesquisa "{searchActQuery}".
            </div>
          ) : (
            sortedKeys.map(letter => (
              <div key={letter} className="space-y-2">
                {/* Letter Header */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-1 pt-2">
                  <span className="text-xs font-black text-blue-600 bg-blue-50 w-6 h-6 rounded-full flex items-center justify-center font-display shadow-3xs">
                    {letter}
                  </span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                {/* Acts list under this letter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {grouped[letter].map(item => {
                    const isRequerimento = item.toLowerCase() === "requerimento";
                    const isEditing = editingIndex === classifications.indexOf(item);
                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all group min-w-0"
                      >
                        {isEditing ? (
                          <div className="flex-1 flex gap-2 min-w-0">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="flex-1 bg-white border border-blue-400 rounded px-2 py-1 text-xs text-slate-705 font-medium focus:outline-hidden"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item)}
                              className="px-2 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold uppercase cursor-pointer"
                            >
                              Gravar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingIndex(null); }}
                              className="px-2 py-1 text-[10px] bg-slate-400 hover:bg-slate-500 text-white rounded font-bold uppercase cursor-pointer"
                            >
                              Sair
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-slate-400 group-hover:scale-110 transition-transform select-none">📄</span>
                              <span className="font-semibold text-slate-850 truncate" title={item}>{item}</span>
                              {isRequerimento && (
                                <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded border border-blue-100 shrink-0">
                                  Obrigatório
                                </span>
                              )}
                            </div>

                            <div className="flex gap-1.5 opacity-75 hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIndex(classifications.indexOf(item));
                                  setEditingValue(item);
                                }}
                                className="p-1 px-2 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 cursor-pointer"
                              >
                                Editar
                              </button>
                              {!isRequerimento && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveClassification(item)}
                                  className="p-1 px-2 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded hover:bg-rose-100 cursor-pointer"
                                  title="Remover tipo de ato"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AdminHierarquiaCivelSubTab() {
  const [areas, setAreas] = useState(() => getStoredAreasHierarchy());
  const [selectedAreaId, setSelectedAreaId] = useState('civel');
  
  const currentArea = areas.find(a => a.id === selectedAreaId) || areas[0];
  const hierarchy = currentArea?.especies || [];

  const [selectedEspecie, setSelectedEspecie] = useState('');
  
  // Update species when area changes
  useEffect(() => {
    if (hierarchy.length > 0) {
      if (!hierarchy.some(h => h.especie === selectedEspecie)) {
        setSelectedEspecie(hierarchy[0].especie);
      }
    } else {
      setSelectedEspecie('');
    }
  }, [selectedAreaId, areas]);

  const currentEspecie = hierarchy.find(h => h.especie === selectedEspecie);
  const accoes = currentEspecie?.accoes || [];

  const [selectedAccaoName, setSelectedAccaoName] = useState('');

  // Automatically select the first action when specie/area changes
  useEffect(() => {
    if (accoes.length > 0) {
      if (!accoes.some(a => a.nome === selectedAccaoName)) {
        setSelectedAccaoName(accoes[0].nome);
      }
    } else {
      setSelectedAccaoName('');
    }
  }, [selectedEspecie, selectedAreaId, areas]);

  const currentAccao = accoes.find(a => a.nome === selectedAccaoName);

  const [newAreaName, setNewAreaName] = useState('');
  const [newEspecieName, setNewEspecieName] = useState('');
  const [newAccaoNameInput, setNewAccaoNameInput] = useState('');

  const [newActName, setNewActName] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editingActIdx, setEditingActIdx] = useState<number | null>(null);
  const [editingActValue, setEditingActValue] = useState('');

  const [editingPhaseIdx, setEditingPhaseIdx] = useState<number | null>(null);
  const [editingPhaseValue, setEditingPhaseValue] = useState('');

  const [showAddAreaForm, setShowAddAreaForm] = useState(false);
  const [showAddEspecieForm, setShowAddEspecieForm] = useState(false);
  const [showAddAccaoForm, setShowAddAccaoForm] = useState(false);

  const saveAll = (updatedAreas: AreaProcessual[]) => {
    setAreas(updatedAreas);
    saveStoredAreasHierarchy(updatedAreas);
  };

  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAreaName.trim();
    if (!name) return;

    if (areas.some(a => a.nome.toLowerCase() === name.toLowerCase())) {
      setStatusMsg({ type: 'error', text: `A área processual "${name}" já existe.` });
      return;
    }

    const newId = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
    const newArea: AreaProcessual = {
      id: newId,
      nome: name,
      especies: []
    };

    const updated = [...areas, newArea];
    saveAll(updated);
    setSelectedAreaId(newId);
    setNewAreaName('');
    setShowAddAreaForm(false);
    setStatusMsg({ type: 'success', text: `Área Processual "${name}" criada com sucesso!` });
  };

  const handleCreateEspecie = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newEspecieName.trim();
    if (!name) return;
    if (!selectedAreaId) return;

    if (hierarchy.some(h => h.especie.toLowerCase() === name.toLowerCase())) {
      setStatusMsg({ type: 'error', text: `A espécie "${name}" já existe nesta área.` });
      return;
    }

    const newEsp: CivilEspecie = {
      especie: name,
      accoes: []
    };

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: [...a.especies, newEsp]
        };
      }
      return a;
    });

    saveAll(updated);
    setSelectedEspecie(name);
    setNewEspecieName('');
    setShowAddEspecieForm(false);
    setStatusMsg({ type: 'success', text: `Espécie de processo "${name}" criada com sucesso!` });
  };

  const handleCreateAccao = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAccaoNameInput.trim();
    if (!name) return;
    if (!selectedEspecie) return;

    if (accoes.some(a => a.nome.toLowerCase() === name.toLowerCase())) {
      setStatusMsg({ type: 'error', text: `O tipo de ação "${name}" já existe nesta espécie.` });
      return;
    }

    const newAcc: CivilActionType = {
      nome: name,
      atos: ["Petição Inicial", "Contestação", "Réplica", "Sentença", "Despacho", "Notificação", "Outro"],
      fases: [...DEFAULT_FASES]
    };

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: [...e.accoes, newAcc]
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setSelectedAccaoName(name);
    setNewAccaoNameInput('');
    setShowAddAccaoForm(false);
    setStatusMsg({ type: 'success', text: `Tipo de ação "${name}" criado com sucesso!` });
  };

  const handleDeleteArea = (id: string) => {
    if (id === 'civel' || id === 'crime') {
      alert('Não é permitido eliminar as áreas padrão do sistema (Cível ou Crime).');
      return;
    }
    if (!confirm('Tem a certeza que deseja eliminar toda esta Área Processual e todas as suas espécies/ações? Esta ação é irreversível!')) return;

    const updated = areas.filter(a => a.id !== id);
    saveAll(updated);
    setSelectedAreaId('civel');
    setStatusMsg({ type: 'success', text: 'Área processual eliminada com sucesso.' });
  };

  const handleDeleteEspecie = (espName: string) => {
    if (!confirm(`Tem a certeza que deseja eliminar a espécie "${espName}" e todas as suas ações e configurações associadas?`)) return;

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.filter(e => e.especie !== espName)
        };
      }
      return a;
    });

    saveAll(updated);
    setStatusMsg({ type: 'success', text: `Espécie "${espName}" eliminada com sucesso.` });
  };

  const handleDeleteAccao = (accName: string) => {
    if (!confirm(`Tem a certeza que deseja eliminar o tipo de ação "${accName}"?`)) return;

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: e.accoes.filter(ac => ac.nome !== accName)
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setStatusMsg({ type: 'success', text: `Tipo de ação "${accName}" eliminado com sucesso.` });
  };

  const handleEditActText = (idx: number, oldValue: string) => {
    setEditingActIdx(idx);
    setEditingActValue(oldValue);
  };

  const handleSaveActText = (idx: number) => {
    const text = editingActValue.trim();
    if (!text) return;
    if (!selectedEspecie || !selectedAccaoName) return;

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: e.accoes.map(ac => {
                  if (ac.nome === selectedAccaoName) {
                    const nextAtos = [...ac.atos];
                    nextAtos[idx] = text;
                    return { ...ac, atos: nextAtos };
                  }
                  return ac;
                })
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setEditingActIdx(null);
    setStatusMsg({ type: 'success', text: `Ato renomeado com sucesso.` });
  };

  const handleDeleteAct = (idx: number) => {
    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: e.accoes.map(ac => {
                  if (ac.nome === selectedAccaoName) {
                    const nextAtos = [...ac.atos];
                    nextAtos.splice(idx, 1);
                    return { ...ac, atos: nextAtos };
                  }
                  return ac;
                })
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setStatusMsg({ type: 'success', text: `Ato removido com sucesso.` });
  };

  const handleEditPhaseText = (idx: number, oldValue: string) => {
    setEditingPhaseIdx(idx);
    setEditingPhaseValue(oldValue);
  };

  const handleSavePhaseText = (idx: number) => {
    const text = editingPhaseValue.trim();
    if (!text) return;
    if (!selectedEspecie || !selectedAccaoName) return;

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: e.accoes.map(ac => {
                  if (ac.nome === selectedAccaoName) {
                    const nextFases = ac.fases ? [...ac.fases] : [...DEFAULT_FASES];
                    nextFases[idx] = text;
                    return { ...ac, fases: nextFases };
                  }
                  return ac;
                })
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setEditingPhaseIdx(null);
    setStatusMsg({ type: 'success', text: `Fase processual renomeada.` });
  };

  const handleDeletePhase = (idx: number) => {
    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: e.accoes.map(ac => {
                  if (ac.nome === selectedAccaoName) {
                    const nextFases = ac.fases ? [...ac.fases] : [...DEFAULT_FASES];
                    nextFases.splice(idx, 1);
                    return { ...ac, fases: nextFases };
                  }
                  return ac;
                })
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setStatusMsg({ type: 'success', text: `Fase removida.` });
  };

  const handleAddAct = (e: React.FormEvent) => {
    e.preventDefault();
    const term = newActName.trim();
    if (!term) return;

    if (currentAccao?.atos.some(a => a.toLowerCase() === term.toLowerCase())) {
      setStatusMsg({ type: 'error', text: `O ato judicial "${term}" já existe nesta ação.` });
      return;
    }

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: e.accoes.map(ac => {
                  if (ac.nome === selectedAccaoName) {
                    return { ...ac, atos: [...ac.atos, term] };
                  }
                  return ac;
                })
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setNewActName('');
    setStatusMsg({ type: 'success', text: `Ato judicial "${term}" adicionado!` });
  };

  const handleAddPhase = (e: React.FormEvent) => {
    e.preventDefault();
    const term = newPhaseName.trim();
    if (!term) return;

    const currentPhases = currentAccao?.fases || DEFAULT_FASES;
    if (currentPhases.some(p => p.toLowerCase() === term.toLowerCase())) {
      setStatusMsg({ type: 'error', text: `A fase processual "${term}" já existe.` });
      return;
    }

    const updated = areas.map(a => {
      if (a.id === selectedAreaId) {
        return {
          ...a,
          especies: a.especies.map(e => {
            if (e.especie === selectedEspecie) {
              return {
                ...e,
                accoes: e.accoes.map(ac => {
                  if (ac.nome === selectedAccaoName) {
                    return { ...ac, fases: [...(ac.fases || DEFAULT_FASES), term] };
                  }
                  return ac;
                })
              };
            }
            return e;
          })
        };
      }
      return a;
    });

    saveAll(updated);
    setNewPhaseName('');
    setStatusMsg({ type: 'success', text: `Fase processual "${term}" adicionada!` });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 text-xs">
      {/* Selector sidebar (left 1/4) */}
      <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5 h-fit">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-2 mb-3">
            Estrutura Processual
          </span>
          <p className="text-[11px] text-slate-500 leading-normal">
            Faça a parametrização das Áreas Processuais, Espécies e Tipos de Ação que orientam o registo de processos e cronologias no sistema.
          </p>
        </div>

        {/* 1. Area Selector */}
        <div className="space-y-2 border-b border-slate-100 pb-3">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              Área Processual *
            </label>
            <button
              onClick={() => setShowAddAreaForm(!showAddAreaForm)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold"
            >
              {showAddAreaForm ? 'Cancelar' : '➕ Nova'}
            </button>
          </div>

          {!showAddAreaForm ? (
            <div className="flex gap-1">
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="flex-1 bg-white p-2 border border-slate-200 rounded-lg focus:outline-hidden text-xs font-bold text-slate-700 cursor-pointer text-ellipsis overflow-hidden"
              >
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
              {selectedAreaId !== 'civel' && selectedAreaId !== 'crime' && (
                <button
                  type="button"
                  onClick={() => handleDeleteArea(selectedAreaId)}
                  className="p-2 text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg font-bold"
                  title="Eliminar esta Área"
                >
                  🗑️
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateArea} className="space-y-2 bg-slate-50 p-2 border border-slate-200 rounded-lg animate-in slide-in-from-top-1">
              <input
                type="text"
                autoFocus
                required
                placeholder="Nome da Área (ex: Laboral)..."
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-full bg-white p-2 border border-slate-200 rounded"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
              >
                Gravar
              </button>
            </form>
          )}
        </div>

        {/* 2. Especie Selector */}
        <div className="space-y-2 border-b border-slate-100 pb-3">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              Espécie Processual *
            </label>
            <button
              onClick={() => setShowAddEspecieForm(!showAddEspecieForm)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold"
            >
              {showAddEspecieForm ? 'Cancelar' : '➕ Nova'}
            </button>
          </div>

          {!showAddEspecieForm ? (
            <div className="flex gap-1">
              <select
                value={selectedEspecie}
                onChange={(e) => setSelectedEspecie(e.target.value)}
                className="flex-1 bg-white p-2 border border-slate-200 rounded-lg focus:outline-hidden text-xs font-semibold text-slate-700 cursor-pointer text-ellipsis overflow-hidden"
              >
                {hierarchy.length === 0 && (
                  <option value="">(Nenhuma espécie registada)</option>
                )}
                {hierarchy.map(h => (
                  <option key={h.especie} value={h.especie}>{h.especie}</option>
                ))}
              </select>
              {selectedEspecie && (
                <button
                  type="button"
                  onClick={() => handleDeleteEspecie(selectedEspecie)}
                  className="p-2 text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg font-bold"
                  title="Eliminar esta Espécie"
                >
                  🗑️
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateEspecie} className="space-y-2 bg-slate-50 p-2 border border-slate-200 rounded-lg animate-in slide-in-from-top-1">
              <input
                type="text"
                autoFocus
                required
                placeholder="Nome da Espécie (ex: Execução)..."
                value={newEspecieName}
                onChange={(e) => setNewEspecieName(e.target.value)}
                className="w-full bg-white p-2 border border-slate-200 rounded"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
              >
                Gravar
              </button>
            </form>
          )}
        </div>

        {/* 3. Tipo de Ação Selector */}
        <div className="space-y-2 pb-2">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              Tipo de Ação *
            </label>
            <button
              onClick={() => setShowAddAccaoForm(!showAddAccaoForm)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-bold"
            >
              {showAddAccaoForm ? 'Cancelar' : '➕ Novo'}
            </button>
          </div>

          {!showAddAccaoForm ? (
            <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1 border border-slate-100 p-2 rounded-lg bg-slate-50/50">
              {accoes.map((acc) => (
                <div
                  key={acc.nome}
                  className={`group/item flex items-center justify-between p-1.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer capitalize ${
                    selectedAccaoName === acc.nome
                      ? 'bg-blue-600 text-white shadow-3xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setSelectedAccaoName(acc.nome)}
                >
                  <span className="truncate pr-1.5 flex-1">{acc.nome}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[9px] px-1 rounded font-mono ${
                      selectedAccaoName === acc.nome ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {acc.atos.length}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAccao(acc.nome);
                      }}
                      className="opacity-0 group-hover/item:opacity-100 p-0.5 text-[9px] text-red-100 bg-red-655 hover:bg-red-700 rounded transition"
                      title="Eliminar Tipo de Ação"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {accoes.length === 0 && (
                <div className="text-center py-4 text-slate-400 italic">Nenhuma ação registada.</div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateAccao} className="space-y-2 bg-slate-50 p-2 border border-slate-200 rounded-lg animate-in slide-in-from-top-1">
              <input
                type="text"
                autoFocus
                required
                placeholder="Tipo de Ação (ex: Ordinário)..."
                value={newAccaoNameInput}
                onChange={(e) => setNewAccaoNameInput(e.target.value)}
                className="w-full bg-white p-2 border border-slate-200 rounded"
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
              >
                Gravar
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Configuration Details Panel (right 3/4) */}
      <div className="lg:col-span-3 space-y-6">
        {statusMsg && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span className="text-sm">{statusMsg.type === 'success' ? '✓' : '⚠️'}</span>
            <span className="font-semibold text-xs">{statusMsg.text}</span>
            <button
              onClick={() => setStatusMsg(null)}
              className="ml-auto font-bold opacity-60 hover:opacity-100 cursor-pointer text-xs"
            >
              FECHAR
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-[10px] text-blue-655 font-bold uppercase tracking-wider block">
              Configurações Ativas do Tipo de Ação:
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight font-display capitalize mt-1">
              💼 {selectedAccaoName || 'Sem Ação Selecionada'}
            </h2>
            <div className="flex flex-wrap gap-2.5 mt-2.5">
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200 font-mono uppercase">
                Área: {areas.find(a => a.id === selectedAreaId)?.nome || selectedAreaId}
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100 font-mono uppercase">
                Espécie: {selectedEspecie}
              </span>
            </div>
          </div>

          {selectedAccaoName ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Atos Judiciais Section */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-widest block font-display">
                    📋 Tipos de Atos Judiciais ({currentAccao?.atos.length || 0})
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Estes atos ficam disponíveis para averbamento na linha de tempo deste processo.
                  </span>
                </div>

                {/* Add form */}
                <form onSubmit={handleAddAct} className="flex gap-2 pb-2">
                  <input
                    type="text"
                    required
                    placeholder="ex: Alegações de Recurso Supremo"
                    value={newActName}
                    onChange={(e) => setNewActName(e.target.value)}
                    className="flex-1 rounded border border-slate-200 px-3 py-1.8 text-xs text-slate-707 font-medium focus:border-blue-500 focus:outline-hidden bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.8 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-all cursor-pointer shadow-3xs whitespace-nowrap"
                  >
                    Adicionar
                  </button>
                </form>

                {/* Scrollable list of acts */}
                <div className="border border-slate-150 rounded-xl bg-slate-50/50 p-2 max-h-[300px] overflow-y-auto space-y-1">
                  {currentAccao?.atos.map((ato, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-white border border-slate-100 group min-h-[36px]">
                      {editingActIdx === idx ? (
                        <div className="flex-1 flex gap-1 items-center">
                          <input
                            type="text"
                            value={editingActValue}
                            onChange={(e) => setEditingActValue(e.target.value)}
                            className="flex-1 px-2.5 py-1 bg-white border border-slate-205 rounded text-xs text-slate-705 focus:outline-hidden font-medium"
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveActText(idx)}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveActText(idx)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer font-bold text-xs"
                            title="Gravar"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingActIdx(null)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer font-bold text-xs"
                            title="Cancelar"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-slate-700 truncate max-w-[200px]">{ato}</span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              type="button"
                              onClick={() => handleEditActText(idx, ato)}
                              className="bg-slate-100 p-1 text-[10px] text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded font-bold cursor-pointer transition-colors"
                              title="Editar Ato"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAct(idx)}
                              className="bg-rose-55/60 p-1 text-[10px] text-rose-600 hover:bg-rose-100 rounded font-bold cursor-pointer transition-colors"
                              title="Eliminar Ato"
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {(!currentAccao || currentAccao.atos.length === 0) && (
                    <div className="text-center py-6 text-slate-400 italic">Nenhum ato cadastrado.</div>
                  )}
                </div>
              </div>

              {/* 2. Process Phases Section */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-widest block font-display">
                    🟣 Fases de Tramitação ({currentAccao ? (currentAccao.fases || DEFAULT_FASES).length : DEFAULT_FASES.length})
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Regula as etapas sequenciais oferecidas na cronologia e timelines.
                  </span>
                </div>

                {/* Add form */}
                <form onSubmit={handleAddPhase} className="flex gap-2 pb-2">
                  <input
                    type="text"
                    required
                    placeholder="ex: Instrução Suplementar"
                    value={newPhaseName}
                    onChange={(e) => setNewPhaseName(e.target.value)}
                    className="flex-1 rounded border border-slate-205 px-3 py-1.8 text-xs text-slate-707 font-medium focus:border-blue-500 focus:outline-hidden bg-slate-50/50 focus:bg-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.8 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold transition-all cursor-pointer shadow-3xs whitespace-nowrap"
                  >
                    Adicionar
                  </button>
                </form>

                {/* Graphic Timeline List of phases */}
                <div className="border border-slate-150 rounded-xl bg-slate-50/50 p-3 max-h-[300px] overflow-y-auto space-y-4 relative">
                  {(currentAccao ? (currentAccao.fases || DEFAULT_FASES) : DEFAULT_FASES).map((phase, idx, arr) => (
                    <div key={idx} className="flex items-start gap-3 relative pl-6">
                      {/* Circle line link connector */}
                      {idx < arr.length - 1 && (
                        <div className="absolute left-[9px] top-[18px] bottom-[-22px] w-[2px] bg-purple-200"></div>
                      )}
                      <div className="absolute left-0 top-1 w-[20px] h-[20px] bg-purple-100 text-purple-750 font-bold font-mono text-[9px] rounded-full flex items-center justify-center border border-purple-200 z-10 shadow-3xs">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0 bg-white border border-slate-100 rounded-lg p-2.5 shadow-3xs hover:border-purple-200 transition-colors group">
                        {editingPhaseIdx === idx ? (
                          <div className="flex gap-1 items-center w-full">
                            <input
                              type="text"
                              value={editingPhaseValue}
                              onChange={(e) => setEditingPhaseValue(e.target.value)}
                              className="flex-1 px-2.5 py-1 bg-white border border-slate-205 rounded text-xs text-slate-705 focus:outline-hidden font-medium"
                              onKeyDown={(e) => e.key === 'Enter' && handleSavePhaseText(idx)}
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePhaseText(idx)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer font-bold text-xs"
                              title="Gravar"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPhaseIdx(null)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer font-bold text-xs"
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center w-full gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="block font-bold text-slate-800 truncate">{phase}</span>
                              <span className="text-[9px] text-slate-400 font-medium font-mono uppercase tracking-wider block mt-0.5">
                                {idx === 0 ? 'Etapa Inicial' : idx === arr.length - 1 ? 'Etapa Definitiva' : 'Tramitação intermédia'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                type="button"
                                onClick={() => handleEditPhaseText(idx, phase)}
                                className="bg-slate-100 p-1 text-[10px] text-purple-650 hover:bg-purple-50 hover:text-purple-700 rounded font-bold cursor-pointer transition-colors"
                                title="Editar Fase"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePhase(idx)}
                                className="bg-rose-55/60 p-1 text-[10px] text-rose-600 hover:bg-rose-100 rounded font-bold cursor-pointer transition-colors"
                                title="Eliminar Fase"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400 italic">
              Selecione ou crie um tipo de ação no menu lateral esquerdo para começar a parametrizar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
