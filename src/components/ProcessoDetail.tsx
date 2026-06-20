/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  User, 
  Calendar, 
  Scale, 
  FileIcon,
  Download,
  FileDown,
  Printer, 
  Eye, 
  Check, 
  X,
  ArrowLeft, 
  Upload, 
  AlertCircle,
  Clock,
  MoreVertical,
  CheckCircle2,
  Trash2,
  Mail,
  Plus,
  FileSignature,
  Building,
  Edit,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Users,
  Star,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { Processo, Documento, User as ActiveUserType, FormModelo, ProcessNotificacao, HistoricoAto } from '../types';
import { getFormModelos, getNotificacoes, saveNotificacao, getTribunais, generateId, getDocumentClassifications, getProcessos, getJuizes, getProcuradores, getFuncionarios } from '../utils/storage';
import { logAction } from '../utils/auditLogger';
import { getIntervenientes, getAdvogadosFichas, getIntervenienteNuitByNome } from '../utils/participants';
import { CIVIL_HIERARCHY, getCustomProcessAllowedActs, getCustomProcessAllowedPhases, DEFAULT_FASES } from '../utils/civilHierarchy';
import { jsPDF } from 'jspdf';

function normalizeText(str: string): string {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getStable8DigitId(id: string): string {
  if (!id) return '00000000';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const numeric = (Math.abs(hash) % 90000000) + 10000000;
  return numeric.toString();
}

function formatDateDot(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim().split(' ')[0].split('T')[0];
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts[0].length === 4) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts[2]?.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    if (parts[0]?.length === 4) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
  }
  return clean;
}

function matchesSearchQuery(name: string, query: string): boolean {
  if (!name || !query) return false;
  return normalizeText(name).toLowerCase().includes(normalizeText(query).toLowerCase());
}

function addDays(dateStr: string, days: number): string {
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

function add60Days(dateStr: string): string {
  return addDays(dateStr, 60);
}

function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getProcessoDetailAlarmeInfo(p: Processo) {
  // A manual alarm is active if alarmeAtivo is true, we have a date, it is not silenced, and it is either specified as manual or we have data without automatic type
  const isAltManualActive = !!p.alarmeAtivo && !p.alarmeSilenciado && !!p.alarmeData && (p.alarmeTipo === 'manual' || p.alarmeTipo !== 'automatico');

  if (isAltManualActive) {
    return {
      data: p.alarmeData || '',
      justificacao: p.alarmeNota || 'Alarme personalizado agendado pelo utilizador.',
      isAutomatico: false,
      ativo: true
    };
  }

  let baseDate = p.dataAutuacao || p.createdAt || getLocalTodayString();
  if (p.historicoAtos && p.historicoAtos.length > 0) {
    let latestAct = p.historicoAtos[0];
    for (const act of p.historicoAtos) {
      if (act.data > latestAct.data) {
        latestAct = act;
      }
    }
    baseDate = latestAct.data;
  }

  const days = p.alarmeDias || 60;
  const alarmDate = addDays(baseDate, days);
  const isAutoActive = p.alarmeSilenciado !== true;

  return {
    data: alarmDate,
    justificacao: `Alarme automático: ${days} dias sem novos atos (para evitar esquecimento).`,
    isAutomatico: true,
    ativo: isAutoActive
  };
}

interface ProcessoDetailProps {
  processo: Processo;
  currentUser: ActiveUserType | null;
  onBack: () => void;
  onOpenFile: (doc: Documento) => void;
  onPrintFile: (doc: Documento) => void;
  onDownloadFile: (doc: Documento) => void;
  onAddDocumentToProcesso: (numeroProcesso: string, doc: Documento) => void;
  onDeleteProcesso?: (numeroProcesso: string) => void;
  onConsultarFicha?: (nome: string) => void;
  onUpdateProcesso?: (processo: Processo) => void;
  onSelectProcesso?: (numeroProcesso: string) => void;
  isNewTabMode?: boolean;
}

export default function ProcessoDetail({
  processo,
  currentUser,
  onBack,
  onOpenFile,
  onPrintFile,
  onDownloadFile,
  onAddDocumentToProcesso,
  onDeleteProcesso,
  onConsultarFicha,
  onUpdateProcesso,
  onSelectProcesso,
  isNewTabMode
}: ProcessoDetailProps) {
  const getProcessClerk = () => {
    if (processo.funcionarios && processo.funcionarios.length > 0) return processo.funcionarios[0];
    const all = getFuncionarios();
    if (all.length > 0) return all[0];
    if (currentUser?.username) return currentUser.username;
    return '';
  };

  const getProcessJudge = () => {
    if (processo.juizTitular) return processo.juizTitular;
    const all = getJuizes();
    if (all.length > 0) return all[0];
    return '';
  };

  // Checkbox state for selecting documents to download
  const [selectedDocIds, setSelectedDocIds] = useState<Record<string, boolean>>({});
  const editActFileInputRef = useRef<HTMLInputElement>(null);

  // --- NOTIFICATION COMPONENTRY ACTIONS STATES ---
  const [notificacoesList, setNotificacoesList] = useState<ProcessNotificacao[]>(() => {
    return getNotificacoes().filter(n => n.processoNumero === processo.numero);
  });
  const [showCreateNotif, setShowCreateNotif] = useState(false);
  const [selectedFormModeloId, setSelectedFormModeloId] = useState('');
  const [selectedDestinatarios, setSelectedDestinatarios] = useState<Record<string, boolean>>({});
  const [notifParteApresentante, setNotifParteApresentante] = useState('Juízo');
  const [notifCriadoPorFuncionario, setNotifCriadoPorFuncionario] = useState(() => {
    return getProcessClerk();
  });
  const [notifAnexos, setNotifAnexos] = useState<Array<{ tempId: string; nome: string; categoria: string; conteudoTexto: string; conteudoUrl?: string }>>([]);
  
  const handleBulkNotifFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      const tempId = `notif-temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      const sizeKb = (file.size / 1024).toFixed(1);
      let guessedCategory = 'Documento de Prova';
      if (file.name.toLowerCase().includes('comprovativo') || file.name.toLowerCase().includes('guia')) {
        guessedCategory = 'Comprovativo de Envio';
      } else if (file.name.toLowerCase().includes('oficio') || file.name.toLowerCase().includes('ofício')) {
        guessedCategory = 'Ofício Externo';
      }

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string || '';
        const autoIntro = `[Ficheiro complementar anexado: ${file.name} - ${sizeKb} KB]\n\n`;
        const sampleText = `CONTEÚDO DIGITAL SECURE - Este ficheiro (${file.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente no arquivo digital do processo.`;

        setNotifAnexos(prev => [
          ...prev,
          {
            tempId,
            nome: file.name,
            categoria: guessedCategory,
            conteudoTexto: autoIntro + sampleText,
            conteudoUrl: dataUrl
          }
        ]);
      };

      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };
  
  const findCurrentAddressFor = (nome: string): string => {
    if (!nome) return '';
    const nameLower = nome.trim().toLowerCase();
    
    // First lookup in intervenientes (Autores / Réus)
    const intervenientes = getIntervenientes();
    const inter = intervenientes.find(i => i.nome.trim().toLowerCase() === nameLower);
    if (inter && inter.moradas && inter.moradas.length > 0) {
      const active = inter.moradas.find(m => m.isAtual) || inter.moradas[0];
      if (active && active.endereco && active.endereco.trim()) {
        return active.endereco.trim();
      }
    }

    // Then lookup in advogados
    const advogados = getAdvogadosFichas();
    const adv = advogados.find(a => a.nome.trim().toLowerCase() === nameLower);
    if (adv && adv.moradasProfissionais && adv.moradasProfissionais.length > 0) {
      const active = adv.moradasProfissionais.find(m => m.isAtual) || adv.moradasProfissionais[0];
      if (active && active.endereco && active.endereco.trim()) {
        return active.endereco.trim();
      }
    }

    return 'Sem morada atual registada na respetiva ficha';
  };

  const [selectedTribunalHeaderId, setSelectedTribunalHeaderId] = useState(() => {
    const list = getTribunais();
    if (currentUser?.tribunalId) {
      const associated = list.find(t => t.id === currentUser.tribunalId);
      if (associated) return associated.id;
    }
    return list[0]?.id || '';
  });
   const [editedNotifTexto, setEditedNotifTexto] = useState('');
  const [activeTabSubProcess, setActiveTabSubProcess] = useState<'documentos' | 'estado' | 'timeline' | 'apensos'>('timeline');

  // State variables for the "Estado" and "Alarme" options
  const [isFormEstadoOpen, setIsFormEstadoOpen] = useState(false);
  const [newEstadoOpcao, setNewEstadoOpcao] = useState('aguarda prazo para ato das partes');
  const [newEstadoCustomOpcao, setNewEstadoCustomOpcao] = useState('');
  const [newEstadoNota, setNewEstadoNota] = useState('');
  
  const [isFormAlarmeOpen, setIsFormAlarmeOpen] = useState(false);
  const [newAlarmeData, setNewAlarmeData] = useState('');
  const [newAlarmeJustificacao, setNewAlarmeJustificacao] = useState('concluir para despacho');
  const [newAlarmeCustomJustificacao, setNewAlarmeCustomJustificacao] = useState('');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('');
  const [subjectAuthorFilter, setSubjectAuthorFilter] = useState<string>('');

  // New filtering criteria requested by the user
  const [timelineTipoAtoFilter, setTimelineTipoAtoFilter] = useState<string>('');
  const [timelineDocIdFilter, setTimelineDocIdFilter] = useState<string>('');
  const [timelineApresentadoPorFilter, setTimelineApresentadoPorFilter] = useState<string>('');
  const [timelineQuemPraticaFilter, setTimelineQuemPraticaFilter] = useState<string>('');
  const [timelineClassificationFilter, setTimelineClassificationFilter] = useState<'all' | 'atos' | 'documentos_avulsos'>('all');
  const [timelineFavoritosFilter, setTimelineFavoritosFilter] = useState<boolean>(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);
  const [selectedTimelineItemIds, setSelectedTimelineItemIds] = useState<Record<string, boolean>>({});
  const [docSortOrder, setDocSortOrder] = useState<'asc' | 'desc'>('desc');
  const [resumoDocumento, setResumoDocumento] = useState('');
  const [valorTaxaJustica, setValorTaxaJustica] = useState('');
  const [pagadorTaxaJustica, setPagadorTaxaJustica] = useState('');
  const [printSelectedNotif, setPrintSelectedNotif] = useState<ProcessNotificacao | null>(null);
  const [editingDoc, setEditingDoc] = useState<Documento | null>(null);
  const [expandedTimelineItems, setExpandedTimelineItems] = useState<Record<string, boolean>>({});
  const toggleTimelineItem = (id: string) => {
    setExpandedTimelineItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const [starredTimelineItems, setStarredTimelineItems] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`starred_timeline_${processo.numero}`) || '{}');
    } catch {
      return {};
    }
  });

  const toggleStarredTimelineItem = (id: string) => {
    setStarredTimelineItems(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem(`starred_timeline_${processo.numero}`, JSON.stringify(updated));
      return updated;
    });
  };

  const [timelineComments, setTimelineComments] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`comments_timeline_${processo.numero}`) || '{}');
    } catch {
      return {};
    }
  });

  const saveTimelineComment = (id: string, text: string) => {
    setTimelineComments(prev => {
      const updated = { ...prev, [id]: text };
      localStorage.setItem(`comments_timeline_${processo.numero}`, JSON.stringify(updated));
      return updated;
    });
  };

  const [activeTimelineMenuId, setActiveTimelineMenuId] = useState<string | null>(null);
  const [commentingItemId, setCommentingItemId] = useState<string | null>(null);
  const [tempCommentText, setTempCommentText] = useState('');
  
  // Act editing states
  const [editingAct, setEditingAct] = useState<HistoricoAto | null>(null);
  const [editActTipoCode, setEditActTipoCode] = useState('');
  const [editActDateStr, setEditActDateStr] = useState('');
  const [editActFaseCode, setEditActFaseCode] = useState('');
  const [editActDescStr, setEditActDescStr] = useState('');
  const [editActPartePrat, setEditActPartePrat] = useState('');
  const [editActAdvPrat, setEditActAdvPrat] = useState('');
  const [editActDocsClones, setEditActDocsClones] = useState<Documento[]>([]);
  const [editDocAnnexes, setEditDocAnnexes] = useState<Documento[]>([]);

  const [activeDetailDoc, setActiveDetailDoc] = useState<Documento | null>(() => {
    return processo.documentos.filter(d => !d.deleted).length > 0 
      ? processo.documentos.filter(d => !d.deleted)[0] 
      : null;
  });

  // Split-screen and custom tools states
  const [rightActiveTab, setRightActiveTab] = useState<'viewer' | 'notificar' | 'ocr' | 'agenda'>('viewer');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'maximo'>('maximo');
  const [ressaltarEntidades, setRessaltarEntidades] = useState(true);

  // States for Minutar Tab
  const [draftModeloId, setDraftModeloId] = useState('');
  const [draftName, setDraftName] = useState('Despacho Judicial - Sancionamento');
  const [draftCategory, setDraftCategory] = useState('Despacho');
  const [draftTexto, setDraftTexto] = useState('');
  const [draftParteApresentante, setDraftParteApresentante] = useState('Magistrado');
  const [draftAdvogado, setDraftAdvogado] = useState('');
  const [draftCriadoPor, setDraftCriadoPor] = useState(() => {
    return getProcessJudge();
  });
  const [draftAnexos, setDraftAnexos] = useState<Array<{ tempId: string; nome: string; categoria: string; conteudoTexto: string; conteudoUrl?: string }>>([]);

  // --- COLLAPSIBLE METADATA (12 ELEMENTS OF PROCESS CREATION) STATES ---
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [isFichaDetailsOpen, setIsFichaDetailsOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fichaError, setFichaError] = useState('');
  const [fichaSuccess, setFichaSuccess] = useState('');
  
  const [editNumero, setEditNumero] = useState(processo.numero);
  const [editTipo, setEditTipo] = useState(processo.tipo || 'civel');
  const [editDataAutuacao, setEditDataAutuacao] = useState(processo.dataAutuacao);
  const [editJuizTitular, setEditJuizTitular] = useState(processo.juizTitular || '');
  const [editAutores, setEditAutores] = useState(() => (processo.autores || []).join(', '));
  const [editReus, setEditReus] = useState(() => (processo.reus || []).join(', '));
  const [editAdvogadosAutor, setEditAdvogadosAutor] = useState(() => (processo.advogadosAutor || []).join(', '));
  const [editAdvogadosReu, setEditAdvogadosReu] = useState(() => (processo.advogadosReu || []).join(', '));
  const [editProcuradores, setEditProcuradores] = useState(() => (processo.procuradores || []).join(', '));
  const [editParentProcessoNumero, setEditParentProcessoNumero] = useState(processo.parentProcessoNumero || '');
  const [editValorAcao, setEditValorAcao] = useState(() => processo.valorAcao?.toString() || '');
  const [editNotificacoesDestinatarios, setEditNotificacoesDestinatarios] = useState<string[]>(() => processo.notificacoesDestinatarios || []);
  const [editFuncionariosList, setEditFuncionariosList] = useState<string[]>(() => processo.funcionarios || []);
  const [currEditFuncionario, setCurrEditFuncionario] = useState('');
  const [showEditFuncionarioSuggestions, setShowEditFuncionarioSuggestions] = useState(false);

  const [editAutoresList, setEditAutoresList] = useState<string[]>(() => processo.autores || []);
  const [editReusList, setEditReusList] = useState<string[]>(() => processo.reus || []);
  const [editAdvogadosAutorList, setEditAdvogadosAutorList] = useState<string[]>(() => processo.advogadosAutor || []);
  const [editAdvogadosReuList, setEditAdvogadosReuList] = useState<string[]>(() => processo.advogadosReu || []);
  const [editProcuradoresList, setEditProcuradoresList] = useState<string[]>(() => processo.procuradores || []);
  
  const [editEspecieCivel, setEditEspecieCivel] = useState(processo.especieCivel || CIVIL_HIERARCHY[0]?.especie || '');
  const [editTipoAccaoCivel, setEditTipoAccaoCivel] = useState(processo.tipoAccaoCivel || '');
  const [editIsApenso, setEditIsApenso] = useState(!!processo.parentProcessoNumero);
  
  const [currEditAutor, setCurrEditAutor] = useState('');
  const [currEditReu, setCurrEditReu] = useState('');
  const [currEditAdvAutor, setCurrEditAdvAutor] = useState('');
  const [currEditAdvReu, setCurrEditAdvReu] = useState('');
  const [currEditProcurador, setCurrEditProcurador] = useState('');

  const [showEditAutorSuggestions, setShowEditAutorSuggestions] = useState(false);
  const [showEditReuSuggestions, setShowEditReuSuggestions] = useState(false);
  const [showEditAdvAutorSuggestions, setShowEditAdvAutorSuggestions] = useState(false);
  const [showEditAdvReuSuggestions, setShowEditAdvReuSuggestions] = useState(false);
  const [showEditProcuradorSuggestions, setShowEditProcuradorSuggestions] = useState(false);
  const [showEditJuizSuggestions, setShowEditJuizSuggestions] = useState(false);

  useEffect(() => {
    setEditNumero(processo.numero);
    setEditTipo(processo.tipo || 'civel');
    setEditDataAutuacao(processo.dataAutuacao);
    setEditJuizTitular(processo.juizTitular || '');
    setEditAutores((processo.autores || []).join(', '));
    setEditReus((processo.reus || []).join(', '));
    setEditAdvogadosAutor((processo.advogadosAutor || []).join(', '));
    setEditAdvogadosReu((processo.advogadosReu || []).join(', '));
    setEditProcuradores((processo.procuradores || []).join(', '));
    setEditParentProcessoNumero(processo.parentProcessoNumero || '');
    setEditValorAcao(processo.valorAcao?.toString() || '');
    setEditNotificacoesDestinatarios(processo.notificacoesDestinatarios || []);
    setEditFuncionariosList(processo.funcionarios || []);

    setEditAutoresList(processo.autores || []);
    setEditReusList(processo.reus || []);
    setEditAdvogadosAutorList(processo.advogadosAutor || []);
    setEditAdvogadosReuList(processo.advogadosReu || []);
    setEditProcuradoresList(processo.procuradores || []);
    setEditEspecieCivel(processo.especieCivel || CIVIL_HIERARCHY[0]?.especie || '');
    setEditTipoAccaoCivel(processo.tipoAccaoCivel || '');
    setEditIsApenso(!!processo.parentProcessoNumero);

    setCurrEditAutor('');
    setCurrEditReu('');
    setCurrEditAdvAutor('');
    setCurrEditAdvReu('');
    setCurrEditProcurador('');
    setCurrEditFuncionario('');

    setShowEditAutorSuggestions(false);
    setShowEditReuSuggestions(false);
    setShowEditAdvAutorSuggestions(false);
    setShowEditAdvReuSuggestions(false);
    setShowEditProcuradorSuggestions(false);
    setShowEditJuizSuggestions(false);
    setShowEditFuncionarioSuggestions(false);

    setEditingField(null);
  }, [processo]);

  useEffect(() => {
    if (fichaError || fichaSuccess) {
      const timer = setTimeout(() => {
        setFichaError('');
        setFichaSuccess('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [fichaError, fichaSuccess]);

  const matchesFilters = (item: any) => {
    // 1. Doc Category Filter (existing category select)
    if (docCategoryFilter) {
      if (item.type === 'standalone_doc') {
        if ((item.data as Documento).categoria !== docCategoryFilter) return false;
      } else if (item.type === 'ato') {
        const act = item.data as HistoricoAto;
        const matchedDocs = processo.documentos.filter(d => 
          !d.deleted && act.documentosIds && act.documentosIds.includes(d.id)
        );
        if (!matchedDocs.some(d => d.categoria === docCategoryFilter)) return false;
      } else if (item.type === 'notificacao') {
        if (docCategoryFilter !== 'Notificações / Diligências' && docCategoryFilter !== 'Notificações') return false;
      }
    }

    // 2. Author Filter (existing autoria filter, e.g. Juiz, Advogado, Procurador)
    if (subjectAuthorFilter) {
      if (subjectAuthorFilter === 'Juiz') {
        if (item.type === 'notificacao') {
          // fine
        } else if (item.type === 'standalone_doc') {
          const d = item.data as Documento;
          const c = (d.categoria || '').toLowerCase();
          const p = (d.parteApresentante || '').toLowerCase();
          const isJuiz = c.includes('sentença') || 
            c.includes('sentenca') || 
            c.includes('despacho') || 
            p.includes('juiz') || 
            p.includes('tribunal') || 
            p.includes('juízo') ||
            p.includes('secretaria') ||
            p.includes('ministério público');
          if (!isJuiz) return false;
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const t = (act.tipoAto || '').toLowerCase();
          const desc = (act.descricao || '').toLowerCase();
          const isJuiz = t.includes('despacho') || 
            t.includes('sentença') || 
            t.includes('sentenca') || 
            t.includes('decisão') || 
            t.includes('decisao') || 
            t.includes('audiência') || 
            desc.includes('juiz') || 
            desc.includes('despacho');
          if (!isJuiz) return false;
        }
      } else if (subjectAuthorFilter === 'Advogado') {
        if (item.type === 'notificacao') {
          return false;
        } else if (item.type === 'standalone_doc') {
          const d = item.data as Documento;
          const isAdv = !!d.advogadoApresentante || (d.categoria && ['Petição Inicial', 'Contestação', 'Petição', 'Requerimento'].includes(d.categoria));
          if (!isAdv) return false;
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const t = (act.tipoAto || '').toLowerCase();
          const desc = (act.descricao || '').toLowerCase();
          const isAdv = t.includes('petição') || 
            t.includes('contestação') || 
            t.includes('requerimento') || 
            t.includes('alegações') || 
            desc.includes('advogado') || 
            desc.includes('patrono');
          if (!isAdv) return false;
        }
      } else if (subjectAuthorFilter === 'Procurador') {
        if (item.type === 'notificacao') {
          return false;
        }
        const lowerProc = (processo.procuradores || []).map(p => p.toLowerCase());
        if (item.type === 'standalone_doc') {
          const d = item.data as Documento;
          const p = (d.parteApresentante || '').toLowerCase();
          const adv = (d.advogadoApresentante || '').toLowerCase();
          const isProc = lowerProc.some(proc => p.includes(proc) || adv.includes(proc)) || p.includes('procurador');
          if (!isProc) return false;
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const desc = (act.descricao || '').toLowerCase();
          const matchedDocs = processo.documentos.filter(d => 
            !d.deleted && act.documentosIds && act.documentosIds.includes(d.id)
          );
          const hasDocByProc = matchedDocs.some(d => {
            const p = (d.parteApresentante || '').toLowerCase();
            const adv = (d.advogadoApresentante || '').toLowerCase();
            return lowerProc.some(proc => p.includes(proc) || adv.includes(proc)) || p.includes('procurador');
          });
          const isProc = desc.includes('procurador') || hasDocByProc;
          if (!isProc) return false;
        }
      }
    }

    // 3. New filtering criteria: "tipo de ato"
    if (timelineTipoAtoFilter) {
      if (item.type === 'ato') {
        const act = item.data as HistoricoAto;
        if (act.tipoAto !== timelineTipoAtoFilter) return false;
      } else if (item.type === 'standalone_doc') {
        const doc = item.data as Documento;
        if (doc.categoria !== timelineTipoAtoFilter) return false;
      } else if (item.type === 'notificacao') {
        if (timelineTipoAtoFilter !== 'Notificação' && timelineTipoAtoFilter !== 'Notificações / Diligências') return false;
      }
    }

    // 4. New filtering criteria: "documento" (chosen from created documents dropdown)
    if (timelineDocIdFilter) {
      if (item.type === 'standalone_doc') {
        const doc = item.data as Documento;
        if (doc.id !== timelineDocIdFilter) return false;
      } else if (item.type === 'ato') {
        const act = item.data as HistoricoAto;
        if (!act.documentosIds || !act.documentosIds.includes(timelineDocIdFilter)) return false;
      } else if (item.type === 'notificacao') {
        // Find if this specific doc is associated with this notification
        const associatedDoc = processo.documentos.find(d => d.id === timelineDocIdFilter);
        if (!associatedDoc || associatedDoc.notificacaoId !== item.data.id) return false;
      }
    }

    // 5. New filtering criteria: "apresentado por" (party/presenter)
    if (timelineApresentadoPorFilter) {
      if (item.type === 'standalone_doc') {
        const doc = item.data as Documento;
        if (doc.parteApresentante !== timelineApresentadoPorFilter && doc.advogadoApresentante !== timelineApresentadoPorFilter) return false;
      } else if (item.type === 'ato') {
        const act = item.data as HistoricoAto;
        if (act.parteAssociada !== timelineApresentadoPorFilter && act.advogadoPraticante !== timelineApresentadoPorFilter) return false;
      } else if (item.type === 'notificacao') {
        const pUpper = timelineApresentadoPorFilter.toLowerCase();
        // Since court issues notifications, only let it pass if filtered by Juiz, Tribunal, dilações or Ministério Público
        const isCourt = pUpper.includes('juiz') || pUpper.includes('tribunal') || pUpper.includes('secretaria') || pUpper.includes('ministério público') || pUpper.includes('procurador');
        if (!isCourt) return false;
      }
    }

    // 6. New filtering criteria: "quem pratica o ato" (fixed roles: juiz, advogado, procurador, funcionario, autor, reu)
    if (timelineQuemPraticaFilter) {
      const role = timelineQuemPraticaFilter; // 'juiz' | 'advogado' | 'procurador' | 'funcionario' | 'autor' | 'reu'
      
      if (role === 'juiz') {
        if (item.type === 'notificacao') {
          return true;
        } else if (item.type === 'standalone_doc') {
          const doc = item.data as Documento;
          const cat = (doc.categoria || '').toLowerCase();
          const p = (doc.parteApresentante || '').toLowerCase();
          return cat.includes('sentença') || cat.includes('sentenca') || cat.includes('despacho') || p.includes('juiz') || p.includes('tribunal') || p.includes('juízo');
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const t = (act.tipoAto || '').toLowerCase();
          const desc = (act.descricao || '').toLowerCase();
          return t.includes('despacho') || t.includes('sentença') || t.includes('sentenca') || t.includes('decisão') || desc.includes('juiz') || desc.includes('despacho') || desc.includes('sentença');
        }
      }
      
      if (role === 'advogado') {
        if (item.type === 'notificacao') {
          return false;
        } else if (item.type === 'standalone_doc') {
          const doc = item.data as Documento;
          const p = (doc.parteApresentante || '').toLowerCase();
          const adv = (doc.advogadoApresentante || '').toLowerCase();
          const cat = (doc.categoria || '').toLowerCase();
          const isFromAdv = (adv.length > 0 && !p.includes('juiz') && !p.includes('tribunal') && !p.includes('procurador')) || ['petição inicial', 'contestação', 'petição', 'requerimento'].includes(cat);
          return isFromAdv;
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const t = (act.tipoAto || '').toLowerCase();
          const desc = (act.descricao || '').toLowerCase();
          const prat = (act.advogadoPraticante || '').toLowerCase();
          return (prat.length > 0 && !prat.includes('secretaria') && !prat.includes('juiz') && !prat.includes('procurador')) || t.includes('petição') || t.includes('contestação') || t.includes('requerimento') || desc.includes('advogado') || desc.includes('mandatário');
        }
      }
      
      if (role === 'procurador') {
        if (item.type === 'notificacao') {
          return false;
        } else if (item.type === 'standalone_doc') {
          const doc = item.data as Documento;
          const p = (doc.parteApresentante || '').toLowerCase();
          const adv = (doc.advogadoApresentante || '').toLowerCase();
          return p.includes('procurador') || p.includes('ministério público') || adv.includes('procurador');
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const t = (act.tipoAto || '').toLowerCase();
          const desc = (act.descricao || '').toLowerCase();
          return desc.includes('procurador') || desc.includes('ministério público') || desc.includes('digníssimo procurador') || t.includes('procurador');
        }
      }
      
      if (role === 'funcionario') {
        if (item.type === 'notificacao') {
          return true;
        } else if (item.type === 'standalone_doc') {
          const doc = item.data as Documento;
          const p = (doc.parteApresentante || '').toLowerCase();
          return p.includes('secretaria') || p.includes('oficial') || p.includes('funcionário') || p.includes('serventuário');
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const t = (act.tipoAto || '').toLowerCase();
          const desc = (act.descricao || '').toLowerCase();
          return t.includes('autuação') || t.includes('distribuição') || t.includes('citação / notificação') || t.includes('notificação presencial') || desc.includes('secretaria') || desc.includes('oficial de justiça') || desc.includes('autuação') || desc.includes('funcionário') || desc.includes('conclusão');
        }
      }
      
      if (role === 'autor') {
        if (item.type === 'notificacao') {
          return false;
        }
        const lowerAutores = (processo.autores || []).map(a => a.toLowerCase());
        if (item.type === 'standalone_doc') {
          const doc = item.data as Documento;
          const p = (doc.parteApresentante || '').toLowerCase();
          return p.includes('autor') || lowerAutores.some(a => p.includes(a));
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const p = (act.parteAssociada || '').toLowerCase();
          return p.includes('autor') || lowerAutores.some(a => p.includes(a));
        }
      }
      
      if (role === 'reu') {
        if (item.type === 'notificacao') {
          return false;
        }
        const lowerReus = (processo.reus || []).map(r => r.toLowerCase());
        if (item.type === 'standalone_doc') {
          const doc = item.data as Documento;
          const p = (doc.parteApresentante || '').toLowerCase();
          return p.includes('réu') || p.includes('reu') || lowerReus.some(r => p.includes(r));
        } else if (item.type === 'ato') {
          const act = item.data as HistoricoAto;
          const p = (act.parteAssociada || '').toLowerCase();
          return p.includes('réu') || p.includes('reu') || lowerReus.some(r => p.includes(r));
        }
      }
    }

    // 7. Filter by classification (Atos vs Documentos Avulsos)
    if (timelineClassificationFilter === 'atos') {
      if (item.type !== 'ato') return false;
    } else if (timelineClassificationFilter === 'documentos_avulsos') {
      if (item.type !== 'standalone_doc' && item.type !== 'notificacao') return false;
    }

    // 8. Filter by Favoritos
    if (timelineFavoritosFilter) {
      if (!starredTimelineItems[item.data.id]) return false;
    }

    return true;
  };

  const getProcessAllowedActs = (proc: Processo): string[] => {
    if (proc.tipo === 'civel' && proc.especieCivel && proc.tipoAccaoCivel) {
      return getCustomProcessAllowedActs(proc.especieCivel, proc.tipoAccaoCivel);
    }
    return getDocumentClassifications(proc.tipo || 'civel');
  };

  const getProcessAllowedPhases = (proc: Processo): string[] => {
    if (proc.tipo === 'civel' && proc.especieCivel && proc.tipoAccaoCivel) {
      return getCustomProcessAllowedPhases(proc.especieCivel, proc.tipoAccaoCivel);
    }
    return DEFAULT_FASES;
  };

  useEffect(() => {
    if (editingAct) {
      setEditActTipoCode(editingAct.tipoAto || '');
      setEditActDateStr(editingAct.data || '');
      setEditActFaseCode(editingAct.fase || '');
      setEditActDescStr(editingAct.descricao || '');
      setEditActPartePrat(editingAct.parteAssociada || '');
      setEditActAdvPrat(editingAct.advogadoPraticante || '');
      
      const associated = processo.documentos.filter(d => !d.deleted && (editingAct.documentosIds || []).includes(d.id));
      setEditActDocsClones(JSON.parse(JSON.stringify(associated))); // deep clone
    } else {
      setEditActTipoCode('');
      setEditActDateStr('');
      setEditActFaseCode('');
      setEditActDescStr('');
      setEditActPartePrat('');
      setEditActAdvPrat('');
      setEditActDocsClones([]);
    }
  }, [editingAct, processo.documentos]);

  useEffect(() => {
    if (editingDoc) {
      const associated = processo.documentos.filter(d => !d.deleted && d.parentDocId === editingDoc.id);
      setEditDocAnnexes(JSON.parse(JSON.stringify(associated))); // deep clone
    } else {
      setEditDocAnnexes([]);
    }
  }, [editingDoc, processo.documentos]);

  const handleSaveEditAct = () => {
    if (!editingAct || !onUpdateProcesso) return;

    if (!editActTipoCode.trim()) {
      alert('O tipo de ato judicial é obrigatório.');
      return;
    }
    if (!editActDateStr) {
      alert('A data da ocorrência do ato é obrigatória.');
      return;
    }
    if (!editActDescStr.trim()) {
      alert('A descrição sumária do ato é obrigatória.');
      return;
    }

    // 1. Update the HistoricoAto object
    const updatedAct: HistoricoAto = {
      ...editingAct,
      tipoAto: editActTipoCode,
      data: editActDateStr,
      fase: editActFaseCode,
      descricao: editActDescStr,
      parteAssociada: editActPartePrat || undefined,
      advogadoPraticante: editActAdvPrat || undefined,
      documentosIds: editActDocsClones.map(d => d.id)
    };

    // 2. Put updatedAct back into historical list
    const updatedActs = (processo.historicoAtos || []).map(a => a.id === editingAct.id ? updatedAct : a);

    // 3. Update or append the cloned documents in the process master array
    let updatedDocs = [...processo.documentos];
    editActDocsClones.forEach(clone => {
      const exists = updatedDocs.some(d => d.id === clone.id);
      if (exists) {
        updatedDocs = updatedDocs.map(d => d.id === clone.id ? clone : d);
      } else {
        updatedDocs.push(clone);
      }
    });

    // 4. Fire the callback
    onUpdateProcesso({
      ...processo,
      historicoAtos: updatedActs,
      documentos: updatedDocs
    });

    setEditingAct(null);
    alert('Ato processual e os respetivos documentos juntos foram modificados e guardados com sucesso!');
  };

  const renderFichaProcesso = () => {
    const listJudges = getJuizes();

    const getAutorSuggestions = () => {
      const list = getIntervenientes();
      return list.filter(item => {
        if (editAutoresList.includes(item.nome)) return false;
        if (!currEditAutor.trim()) return true;
        return matchesSearchQuery(item.nome, currEditAutor);
      });
    };

    const getReuSuggestions = () => {
      const list = getIntervenientes();
      return list.filter(item => {
        if (editReusList.includes(item.nome)) return false;
        if (!currEditReu.trim()) return true;
        return matchesSearchQuery(item.nome, currEditReu);
      });
    };

    const getAdvAutorSuggestions = () => {
      const list = getAdvogadosFichas();
      return list.filter(item => {
        if (editAdvogadosAutorList.includes(item.nome)) return false;
        if (!currEditAdvAutor.trim()) return true;
        return matchesSearchQuery(item.nome, currEditAdvAutor);
      });
    };

    const getAdvReuSuggestions = () => {
      const list = getAdvogadosFichas();
      return list.filter(item => {
        if (editAdvogadosReuList.includes(item.nome)) return false;
        if (!currEditAdvReu.trim()) return true;
        return matchesSearchQuery(item.nome, currEditAdvReu);
      });
    };

    const getProcuradorSuggestions = () => {
      const list = getProcuradores();
      return list.filter(item => {
        if (editProcuradoresList.includes(item)) return false;
        if (!currEditProcurador.trim()) return true;
        return matchesSearchQuery(item, currEditProcurador);
      });
    };

    const getFuncionarioSuggestions = () => {
      const list = getFuncionarios();
      return list.filter(item => {
        if (editFuncionariosList.includes(item)) return false;
        if (!currEditFuncionario.trim()) return true;
        return matchesSearchQuery(item, currEditFuncionario);
      });
    };
    
    const handleAddAutor = (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      if (!editAutoresList.includes(clean)) {
        setEditAutoresList(prev => [...prev, clean]);
      }
      setCurrEditAutor('');
      setShowEditAutorSuggestions(false);
    };

    const handleAddReu = (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      if (!editReusList.includes(clean)) {
        setEditReusList(prev => [...prev, clean]);
      }
      setCurrEditReu('');
      setShowEditReuSuggestions(false);
    };

    const handleAddAdvAutor = (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      if (!editAdvogadosAutorList.includes(clean)) {
        setEditAdvogadosAutorList(prev => [...prev, clean]);
      }
      setCurrEditAdvAutor('');
      setShowEditAdvAutorSuggestions(false);
    };

    const handleAddAdvReu = (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      if (!editAdvogadosReuList.includes(clean)) {
        setEditAdvogadosReuList(prev => [...prev, clean]);
      }
      setCurrEditAdvReu('');
      setShowEditAdvReuSuggestions(false);
    };

    const handleAddProcurador = (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      if (!editProcuradoresList.includes(clean)) {
        setEditProcuradoresList(prev => [...prev, clean]);
      }
      setCurrEditProcurador('');
      setShowEditProcuradorSuggestions(false);
    };

    const handleAddFuncionario = (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      if (!editFuncionariosList.includes(clean)) {
        setEditFuncionariosList(prev => [...prev, clean]);
      }
      setCurrEditFuncionario('');
      setShowEditFuncionarioSuggestions(false);
    };

    const handleSaveField = (fieldName: string) => {
      setFichaError('');
      setFichaSuccess('');

      if (fieldName === 'numero' && !editNumero.trim()) {
        setFichaError('O número do processo é de preenchimento obrigatório.');
        return;
      }
      if (fieldName === 'autores' && editAutoresList.length === 0) {
        setFichaError('Deve indicar pelo menos um Autor ao processo.');
        return;
      }
      if (fieldName === 'reus' && editReusList.length === 0) {
        setFichaError('Deve indicar pelo menos um Réu ao processo.');
        return;
      }

      const updated = {
        ...processo,
        numero: editNumero.trim(),
        tipo: editTipo as 'civel' | 'crime',
        dataAutuacao: editDataAutuacao,
        juizTitular: editJuizTitular.trim() || 'Dra. Isabel Maria de Albuquerque',
        autores: editAutoresList,
        reus: editReusList,
        advogadosAutor: editAdvogadosAutorList,
        advogadosReu: editAdvogadosReuList,
        procuradores: editProcuradoresList,
        funcionarios: editFuncionariosList,
        parentProcessoNumero: editIsApenso && editParentProcessoNumero.trim() ? editParentProcessoNumero.trim() : undefined,
        valorAcao: editTipo === 'civel' && editValorAcao ? parseFloat(editValorAcao) : undefined,
        especieCivel: editTipo === 'civel' ? editEspecieCivel : undefined,
        tipoAccaoCivel: editTipo === 'civel' ? editTipoAccaoCivel : undefined,
        notificacoesDestinatarios: editNotificacoesDestinatarios
      };

      if (onUpdateProcesso) {
        onUpdateProcesso(updated);
        setFichaSuccess('Campo atualizado com sucesso!');
        setEditingField(null);
        setTimeout(() => {
          setFichaSuccess('');
        }, 3000);
      }
    };

    const handleSaveAllFields = (e: React.FormEvent) => {
      e.preventDefault();
      setFichaError('');
      setFichaSuccess('');

      if (!editNumero.trim()) {
        setFichaError('O número do processo é de preenchimento obrigatório.');
        return;
      }
      if (editAutoresList.length === 0) {
        setFichaError('Deve indicar pelo menos um Autor ao processo.');
        return;
      }
      if (editReusList.length === 0) {
        setFichaError('Deve indicar pelo menos um Réu ao processo.');
        return;
      }

      const updated = {
        ...processo,
        numero: editNumero.trim(),
        tipo: editTipo as 'civel' | 'crime',
        dataAutuacao: editDataAutuacao,
        juizTitular: editJuizTitular.trim() || 'Dra. Isabel Maria de Albuquerque',
        autores: editAutoresList,
        reus: editReusList,
        advogadosAutor: editAdvogadosAutorList,
        advogadosReu: editAdvogadosReuList,
        procuradores: editProcuradoresList,
        funcionarios: editFuncionariosList,
        parentProcessoNumero: editIsApenso && editParentProcessoNumero.trim() ? editParentProcessoNumero.trim() : undefined,
        valorAcao: editTipo === 'civel' && editValorAcao ? parseFloat(editValorAcao) : undefined,
        especieCivel: editTipo === 'civel' ? editEspecieCivel : undefined,
        tipoAccaoCivel: editTipo === 'civel' ? editTipoAccaoCivel : undefined,
        notificacoesDestinatarios: editNotificacoesDestinatarios
      };

      if (onUpdateProcesso) {
        onUpdateProcesso(updated);
        setFichaSuccess('Ficha de Autuação atualizada na totalidade com sucesso!');
        setTimeout(() => {
          setIsMetadataExpanded(false);
        }, 1500);
      }
    };

    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs relative z-[45]">
        {/* Banner decorative line */}
        <div className={`h-1.5 w-full rounded-t-2xl ${processo.tipo === 'crime' ? 'bg-red-500' : 'bg-blue-500'}`} />
        
        {/* Collapsed Bar / Header */}
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-grow flex-shrink min-w-0 flex items-start gap-3">
            <div className="text-3xl select-none mt-1 shrink-0">📂</div>
            <div className="flex-grow flex-shrink min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-lg font-black text-slate-800 tracking-tight font-display">
                  Ficha do Processo nº <span className="select-all">{processo.numero}</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  processo.tipo === 'crime' ? 'bg-red-50 text-red-700 border border-red-150' : 'bg-blue-50 text-blue-700 border border-blue-150'
                }`}>
                  {processo.tipo === 'crime' ? 'Processo Crime' : 'Processo Cível'}
                </span>
                {processo.parentProcessoNumero && (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-150">
                    Apenso
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setIsFichaDetailsOpen(!isFichaDetailsOpen)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 select-none hover:scale-[1.01]"
            >
              {isFichaDetailsOpen ? '▲ Ocultar ficha do processo' : '📂 Abrir ficha do processo (ver dados completos)'}
            </button>
            <button
              type="button"
              onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 select-none hover:scale-[1.01]"
            >
              {isMetadataExpanded ? '▲ Ocultar Formulário' : '✏️ Editar Ficha de Autuação (13 Campos)'}
            </button>
          </div>
        </div>

        {/* Painel de Síntese Rápida de Identificação (Abrir a Ficha de Processo) */}
        {isFichaDetailsOpen && (
          <div className="px-6 py-5 bg-slate-50/55 border-t border-b border-slate-150 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs animate-in fade-in slide-in-from-top-1">
            {/* Col 1: Magistratura / Juiz */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">⚖️ Tribunal e Magistratura</span>
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Juiz Titular da Causa:</p>
                <strong className="text-slate-800 text-[11px] font-bold leading-tight block">{processo.juizTitular || '(Sem Juiz Atribuído)'}</strong>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Ministério Público / Procuradores:</p>
                <strong className="text-slate-800 text-[11px] font-bold leading-tight block">
                  {processo.procuradores && processo.procuradores.length > 0 
                    ? processo.procuradores.join(', ') 
                    : '(Sem Procuradores Registados)'}
                </strong>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Funcionários Secretários Responsáveis:</p>
                <strong className="text-slate-800 text-[11px] font-bold leading-tight block">
                  {processo.funcionarios && processo.funcionarios.length > 0 
                    ? processo.funcionarios.join(', ') 
                    : '(Sem Funcionários Associados)'}
                </strong>
              </div>
            </div>

            {/* Col 2: Polo Ativo (Autores & Advogados) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-205 shadow-3xs flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">🟢 Polo Ativo (Requerentes)</span>
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Autor(es) / Requerente(s):</p>
                <p className="font-bold text-slate-850 text-[11px] leading-snug">
                  {processo.autores.map(nome => {
                    const nuit = getIntervenienteNuitByNome(nome);
                    return nuit ? `${nome} (NUIT: ${nuit})` : nome;
                  }).join(', ') || '(Sem Autores Registados)'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Advogado(s) do Autor:</p>
                <strong className="text-slate-800 text-[11px] font-bold leading-tight block">
                  {processo.advogadosAutor && processo.advogadosAutor.length > 0 
                    ? processo.advogadosAutor.join(', ') 
                    : '(Sem Mandatário Constituído)'}
                </strong>
              </div>
            </div>

            {/* Col 3: Polo Passivo (Réus & Advogados) */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-205 shadow-3xs flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">🔴 Polo Passivo (Requeridos)</span>
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Réu(s) / Arguido(s):</p>
                <p className="font-bold text-slate-850 text-[11px] leading-snug font-display">
                  {processo.reus.map(nome => {
                    const nuit = getIntervenienteNuitByNome(nome);
                    return nuit ? `${nome} (NUIT: ${nuit})` : nome;
                  }).join(', ') || '(Sem Réus Registados)'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Advogado(s) do Réu:</p>
                <strong className="text-slate-800 text-[11px] font-bold leading-tight block">
                  {processo.advogadosReu && processo.advogadosReu.length > 0 
                    ? processo.advogadosReu.join(', ') 
                    : '(Sem Mandatário Constituído)'}
                </strong>
              </div>
            </div>

            {/* Col 4: Detalhes Financeiros e Estado */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-205 shadow-3xs flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">💰 Valores e Datas</span>
                <p className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5 font-display">Valor da Ação / Alçada:</p>
                <strong className="text-emerald-700 text-xs font-extrabold tracking-tight block">
                  {processo.valorAcao !== undefined && processo.valorAcao > 0
                    ? processo.valorAcao.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) 
                    : '(Isento ou Sem Valor Atribuído)'}
                </strong>
              </div>
              <div className="pt-2 border-t border-slate-105 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[8.5px] mb-0.5">Instauração:</p>
                  <span className="font-mono font-bold text-slate-705 block">{processo.dataAutuacao}</span>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[8.5px] mb-0.5">Estado / Fase:</p>
                  <span className="font-bold text-indigo-700 block truncate" title={processo.faseAtual || 'Instrução'} style={{ textTransform: 'uppercase' }}>
                    {processo.faseAtual || 'Instrução'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Messages */}
        {isMetadataExpanded && (fichaError || fichaSuccess) && (
          <div className="mx-6 mb-3 p-3 text-xs rounded-xl border animate-in fade-in">
            {fichaError && (
              <div className="text-red-700 bg-red-50 border-red-200 font-bold flex items-center gap-2">
                <span>⚠️ Erro:</span> {fichaError}
              </div>
            )}
            {fichaSuccess && (
              <div className="text-emerald-700 bg-emerald-50 border-emerald-250 font-bold flex items-center gap-2">
                <span>✓ Sucesso:</span> {fichaSuccess}
              </div>
            )}
          </div>
        )}

        {/* Expanded complete 13 layout form elements */}
        {isMetadataExpanded && (
          <form onSubmit={handleSaveAllFields} className="p-6 border-t border-slate-100 bg-slate-50/20 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs text-slate-800">
            
            {/* ELEMENT 1: NÚMERO DO PROCESSO */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">1. Número Único</span>
                {editingField === 'numero' ? (
                  <div className="space-y-1.5 mt-1">
                    <input
                      type="text"
                      value={editNumero}
                      onChange={(e) => setEditNumero(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                      required
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleSaveField('numero')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar</button>
                      <button onClick={() => { setEditNumero(processo.numero); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <strong className="text-sm font-semibold text-slate-900 font-mono select-all block mt-0.5">{processo.numero}</strong>
                )}
              </div>
              {editingField !== 'numero' && (
                <button onClick={() => { setEditNumero(processo.numero); setEditingField('numero'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 2: TIPO / NATUREZA */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">2. Âmbito / Natureza</span>
                {editingField === 'tipo' ? (
                  <div className="space-y-1.5 mt-1">
                    <select
                      value={editTipo}
                      onChange={(e) => setEditTipo(e.target.value as any)}
                      className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="civel">Cível (Ações Cíveis / Administrativo)</option>
                      <option value="crime">Crime (Ações Penais / Ministério Público)</option>
                    </select>
                    <div className="flex gap-1">
                      <button onClick={() => handleSaveField('tipo')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar</button>
                      <button onClick={() => { setEditTipo(processo.tipo || 'civel'); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-700 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-800 block mt-0.5 uppercase tracking-wide">
                    {processo.tipo === 'crime' ? '⚖️ Penal / Crime' : '💼 Cível'}
                  </span>
                )}
              </div>
              {editingField !== 'tipo' && (
                <button onClick={() => { setEditTipo(processo.tipo || 'civel'); setEditingField('tipo'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 3: DATA DE AUTUAÇÃO */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">3. Data de Autuação</span>
                {editingField === 'dataAutuacao' ? (
                  <div className="space-y-1.5 mt-1">
                    <input
                      type="date"
                      value={editDataAutuacao}
                      onChange={(e) => setEditDataAutuacao(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs font-mono font-semibold focus:outline-hidden"
                      required
                    />
                    <div className="flex gap-1 pt-1">
                      <button onClick={() => handleSaveField('dataAutuacao')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar</button>
                      <button onClick={() => { setEditDataAutuacao(processo.dataAutuacao); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-705 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-mono font-bold text-slate-800 block mt-0.5">{processo.dataAutuacao}</span>
                )}
              </div>
              {editingField !== 'dataAutuacao' && (
                <button onClick={() => { setEditDataAutuacao(processo.dataAutuacao); setEditingField('dataAutuacao'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 4: JUIZ TITULAR */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between relative z-[32]">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">4. Juiz Titular</span>
                {editingField === 'juizTitular' ? (
                  <div className="space-y-1.5 mt-1 relative">
                    <input
                      type="text"
                      value={editJuizTitular}
                      onChange={(e) => {
                        setEditJuizTitular(e.target.value);
                        setShowEditJuizSuggestions(true);
                      }}
                      onFocus={() => setShowEditJuizSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowEditJuizSuggestions(false), 200)}
                      className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                      placeholder="Nome completo do Magistrado..."
                    />
                    {showEditJuizSuggestions && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-white border border-slate-200 rounded shadow-lg">
                        {listJudges
                          .filter(j => {
                            if (!editJuizTitular.trim()) return true;
                            return matchesSearchQuery(j, editJuizTitular);
                          })
                          .slice(0, 5)
                          .map((j) => (
                            <div
                              key={j}
                              onMouseDown={() => {
                                setEditJuizTitular(j);
                                setShowEditJuizSuggestions(false);
                              }}
                              className="px-2.5 py-1.5 text-xs text-slate-705 hover:bg-slate-55 cursor-pointer border-b border-slate-50 last:border-0 font-medium text-left"
                            >
                              {j}
                            </div>
                          ))}
                        {listJudges.filter(j => {
                          if (!editJuizTitular.trim()) return true;
                          return matchesSearchQuery(j, editJuizTitular);
                        }).length === 0 && (
                          <div className="px-2.5 py-1.5 text-xs text-slate-400 italic text-left">
                            Nenhum juiz correspondente
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-1 pt-1" style={{ contentVisibility: 'auto' }}>
                      <button onClick={() => handleSaveField('juizTitular')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar</button>
                      <button onClick={() => { setEditJuizTitular(processo.juizTitular || ''); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-705 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <strong className="text-xs font-semibold text-slate-900 block mt-0.5">{processo.juizTitular || '(Sem Juiz Registado)'}</strong>
                )}
              </div>
              {editingField !== 'juizTitular' && (
                <button onClick={() => { setEditJuizTitular(processo.juizTitular || ''); setEditingField('juizTitular'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>
 
            {/* ELEMENT 5: AUTORES */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between relative z-[31]">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block mb-1">
                  5. Autor / Requerente(s) ({editAutoresList.length})
                </span>
                {editingField === 'autores' ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5 relative">
                      <input
                        type="text"
                        value={currEditAutor}
                        onChange={(e) => {
                          setCurrEditAutor(e.target.value);
                          setShowEditAutorSuggestions(true);
                        }}
                        onFocus={() => setShowEditAutorSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEditAutorSuggestions(false), 200)}
                        placeholder="Adicionar nome do autor..."
                        className="flex-1 bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAutor(currEditAutor))}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAutor(currEditAutor)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Adicionar
                      </button>
                      {showEditAutorSuggestions && getAutorSuggestions().length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-white border border-slate-202 rounded shadow-lg">
                          {getAutorSuggestions().map((item) => (
                            <div
                              key={item.nome}
                              onMouseDown={() => {
                                handleAddAutor(item.nome);
                              }}
                              className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                            >
                              <div className="font-bold text-slate-800 text-[11px]">{item.nome}</div>
                              {item.profissao && <div className="text-[9px] text-slate-400">Profissão: {item.profissao}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                      {editAutoresList.map((a, i) => (
                        <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">👤 {a}</span>
                          <button
                            type="button"
                            onClick={() => setEditAutoresList(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-600 hover:bg-rose-55 px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      {editAutoresList.length === 0 && (
                        <div className="text-[10px] text-slate-400 italic py-1 text-center">Sem autores inscritos (mínimo 1).</div>
                      )}
                    </div>
                    <div className="flex gap-1 pt-1 border-t border-slate-100">
                      <button onClick={() => handleSaveField('autores')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar Todos</button>
                      <button onClick={() => { setEditAutoresList(processo.autores || []); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {processo.autores.map((a, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 text-[10px]">
                        👤 {a}
                      </span>
                    ))}
                    {processo.autores.length === 0 && <span className="text-slate-400 italic text-[10px]">Sem autores listados</span>}
                  </div>
                )}
              </div>
              {editingField !== 'autores' && (
                <button onClick={() => { setEditAutoresList(processo.autores || []); setEditingField('autores'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 6: RÉUS */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between relative z-[30]">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block mb-1">
                  6. Réu / Arguido(s) ({editReusList.length})
                </span>
                {editingField === 'reus' ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5 relative">
                      <input
                        type="text"
                        value={currEditReu}
                        onChange={(e) => {
                          setCurrEditReu(e.target.value);
                          setShowEditReuSuggestions(true);
                        }}
                        onFocus={() => setShowEditReuSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEditReuSuggestions(false), 200)}
                        placeholder="Adicionar nome do réu..."
                        className="flex-1 bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddReu(currEditReu))}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddReu(currEditReu)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Adicionar
                      </button>
                      {showEditReuSuggestions && getReuSuggestions().length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-white border border-slate-202 rounded shadow-lg">
                          {getReuSuggestions().map((item) => (
                            <div
                              key={item.nome}
                              onMouseDown={() => {
                                handleAddReu(item.nome);
                              }}
                              className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                            >
                              <div className="font-bold text-slate-800 text-[11px]">{item.nome}</div>
                              {item.profissao && <div className="text-[9px] text-slate-400">Profissão: {item.profissao}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                      {editReusList.map((r, i) => (
                        <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">👤 {r}</span>
                          <button
                            type="button"
                            onClick={() => setEditReusList(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-600 hover:bg-rose-55 px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                      {editReusList.length === 0 && (
                        <div className="text-[10px] text-slate-400 italic py-1 text-center">Sem réus inscritos (mínimo 1).</div>
                      )}
                    </div>
                    <div className="flex gap-1 pt-1 border-t border-slate-100">
                      <button onClick={() => handleSaveField('reus')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar Todos</button>
                      <button onClick={() => { setEditReusList(processo.reus || []); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {processo.reus.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 font-bold rounded-lg border border-red-100 text-[10px]">
                        👤 {r}
                      </span>
                    ))}
                    {processo.reus.length === 0 && <span className="text-slate-400 italic text-[10px]">Sem réus listados</span>}
                  </div>
                )}
              </div>
              {editingField !== 'reus' && (
                <button onClick={() => { setEditReusList(processo.reus || []); setEditingField('reus'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 7: ADVOGADOS DO AUTOR */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between relative z-[29]">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block mb-1">
                  7. Advogados do Autor ({editAdvogadosAutorList.length})
                </span>
                {editingField === 'advogadosAutor' ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5 relative">
                      <input
                        type="text"
                        value={currEditAdvAutor}
                        onChange={(e) => {
                          setCurrEditAdvAutor(e.target.value);
                          setShowEditAdvAutorSuggestions(true);
                        }}
                        onFocus={() => setShowEditAdvAutorSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEditAdvAutorSuggestions(false), 200)}
                        placeholder="Adicionar nome de advogado..."
                        className="flex-1 bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAdvAutor(currEditAdvAutor))}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAdvAutor(currEditAdvAutor)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Adicionar
                      </button>
                      {showEditAdvAutorSuggestions && getAdvAutorSuggestions().length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-white border border-slate-202 rounded shadow-lg">
                          {getAdvAutorSuggestions().map((item) => (
                            <div
                              key={item.nome}
                              onMouseDown={() => {
                                handleAddAdvAutor(item.nome);
                              }}
                              className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                            >
                              <div className="font-bold text-slate-800 text-[11px]">{item.nome}</div>
                              {item.cedulaProfissional && <div className="text-[9px] text-slate-400">Cédula: {item.cedulaProfissional}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                      {editAdvogadosAutorList.map((a, i) => (
                        <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">💼 {a}</span>
                          <button
                            type="button"
                            onClick={() => setEditAdvogadosAutorList(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-600 hover:bg-rose-55 px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 pt-1 border-t border-slate-100">
                      <button onClick={() => handleSaveField('advogadosAutor')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar Todos</button>
                      <button onClick={() => { setEditAdvogadosAutorList(processo.advogadosAutor || []); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    {processo.advogadosAutor.map((a, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-750 text-[10px] mr-1 mb-1">💼 {a}</span>
                    ))}
                    {processo.advogadosAutor.length === 0 && <span className="text-slate-405 italic text-[10px] block">Nenhum</span>}
                  </div>
                )}
              </div>
              {editingField !== 'advogadosAutor' && (
                <button onClick={() => { setEditAdvogadosAutorList(processo.advogadosAutor || []); setEditingField('advogadosAutor'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 8: ADVOGADOS DO RÉU */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between relative z-[28]">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block mb-1">
                  8. Advogados do Réu ({editAdvogadosReuList.length})
                </span>
                {editingField === 'advogadosReu' ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5 relative">
                      <input
                        type="text"
                        value={currEditAdvReu}
                        onChange={(e) => {
                          setCurrEditAdvReu(e.target.value);
                          setShowEditAdvReuSuggestions(true);
                        }}
                        onFocus={() => setShowEditAdvReuSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEditAdvReuSuggestions(false), 200)}
                        placeholder="Adicionar nome de advogado..."
                        className="flex-1 bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAdvReu(currEditAdvReu))}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAdvReu(currEditAdvReu)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Adicionar
                      </button>
                      {showEditAdvReuSuggestions && getAdvReuSuggestions().length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-white border border-slate-202 rounded shadow-lg">
                          {getAdvReuSuggestions().map((item) => (
                            <div
                              key={item.nome}
                              onMouseDown={() => {
                                handleAddAdvReu(item.nome);
                              }}
                              className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                            >
                              <div className="font-bold text-slate-800 text-[11px]">{item.nome}</div>
                              {item.cedulaProfissional && <div className="text-[9px] text-slate-400">Cédula: {item.cedulaProfissional}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                      {editAdvogadosReuList.map((a, i) => (
                        <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">💼 {a}</span>
                          <button
                            type="button"
                            onClick={() => setEditAdvogadosReuList(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-600 hover:bg-rose-55 px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 pt-1 border-t border-slate-100">
                      <button onClick={() => handleSaveField('advogadosReu')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar Todos</button>
                      <button onClick={() => { setEditAdvogadosReuList(processo.advogadosReu || []); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    {processo.advogadosReu.map((a, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 bg-red-50/40 border border-red-100 rounded font-semibold text-slate-755 text-[10px] mr-1 mb-1">💼 {a}</span>
                    ))}
                    {processo.advogadosReu.length === 0 && <span className="text-slate-405 italic text-[10px] block">Nenhum</span>}
                  </div>
                )}
              </div>
              {editingField !== 'advogadosReu' && (
                <button onClick={() => { setEditAdvogadosReuList(processo.advogadosReu || []); setEditingField('advogadosReu'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 9: PROCURADORES / MINISTÉRIO PÚBLICO */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between relative z-[27]">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block mb-1">
                  9. Procuradores Magistrados (M.P.) ({editProcuradoresList.length})
                </span>
                {editingField === 'procuradores' ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5 relative">
                      <input
                        type="text"
                        value={currEditProcurador}
                        onChange={(e) => {
                          setCurrEditProcurador(e.target.value);
                          setShowEditProcuradorSuggestions(true);
                        }}
                        onFocus={() => setShowEditProcuradorSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEditProcuradorSuggestions(false), 200)}
                        placeholder="Adicionar nome de procurador..."
                        className="flex-1 bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddProcurador(currEditProcurador))}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddProcurador(currEditProcurador)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Adicionar
                      </button>
                      {showEditProcuradorSuggestions && getProcuradorSuggestions().length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-white border border-slate-202 rounded shadow-lg">
                          {getProcuradorSuggestions().map((item) => (
                            <div
                              key={item}
                              onMouseDown={() => {
                                handleAddProcurador(item);
                              }}
                              className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                            >
                              <div className="font-bold text-slate-800 text-[11.5px]">⚖️ {item}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                      {editProcuradoresList.map((p, i) => (
                        <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">⚖️ {p}</span>
                          <button
                            type="button"
                            onClick={() => setEditProcuradoresList(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-600 hover:bg-rose-55 px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 pt-1 border-t border-slate-100">
                      <button onClick={() => handleSaveField('procuradores')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar Todos</button>
                      <button onClick={() => { setEditProcuradoresList(processo.procuradores || []); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    {(processo.procuradores || []).map((p, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded font-semibold text-[10px] mr-1 mb-1">⚖️ {p}</span>
                    ))}
                    {(!processo.procuradores || processo.procuradores.length === 0) && <span className="text-slate-405 italic text-[10px] block">Nenhum</span>}
                  </div>
                )}
              </div>
              {editingField !== 'procuradores' && (
                <button onClick={() => { setEditProcuradoresList(processo.procuradores || []); setEditingField('procuradores'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 10: APENSO PROCESSO PRINCIPAL */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">10. Processo Principal (Apenso)</span>
                {editingField === 'parentProcesso' ? (
                  <div className="space-y-1.5 mt-1">
                    <input
                      type="text"
                      value={editParentProcessoNumero}
                      onChange={(e) => setEditParentProcessoNumero(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                      placeholder="ex: PROC-2026/001"
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleSaveField('parentProcesso')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar</button>
                      <button onClick={() => { setEditParentProcessoNumero(processo.parentProcessoNumero || ''); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <strong className="text-xs font-semibold text-slate-800 block mt-0.5">
                    {processo.parentProcessoNumero ? `📌 Apenso do Processo ${processo.parentProcessoNumero}` : 'Autónomo / Sem Apensos'}
                  </strong>
                )}
              </div>
              {editingField !== 'parentProcesso' && (
                <button onClick={() => { setEditParentProcessoNumero(processo.parentProcessoNumero || ''); setEditingField('parentProcesso'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 11: VALOR DA CAUSA */}
            <div className={`bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between ${processo.tipo === 'crime' ? 'opacity-50' : ''}`}>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">11. Valor do Processo / Ação</span>
                {processo.tipo === 'crime' ? (
                  <span className="text-[10px] text-slate-455 italic block mt-0.5">Não aplicável a ações penais.</span>
                ) : editingField === 'valorAcao' ? (
                  <div className="space-y-1.5 mt-1">
                    <input
                      type="number"
                      value={editValorAcao}
                      onChange={(e) => setEditValorAcao(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                      placeholder="ex: 15000"
                    />
                    <div className="flex gap-1" style={{ contentVisibility: 'auto' }}>
                      <button onClick={() => handleSaveField('valorAcao')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar</button>
                      <button onClick={() => { setEditValorAcao(processo.valorAcao?.toString() || ''); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <strong className="text-sm font-semibold text-slate-900 block mt-0.5">
                    {processo.valorAcao !== undefined ? `${processo.valorAcao.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} EUR` : 'Valor não fixado'}
                  </strong>
                )}
              </div>
              {processo.tipo !== 'crime' && editingField !== 'valorAcao' && (
                <button onClick={() => { setEditValorAcao(processo.valorAcao?.toString() || ''); setEditingField('valorAcao'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 12: DESTINATÁRIOS DE EXPEDIÇÃO */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between md:col-span-2 lg:col-span-3">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">12. Destinatários de Expedição (Notificações)</span>
                {editingField === 'notificacoesDestinatarios' ? (
                  <div className="space-y-2 mt-1 bg-slate-50 p-2.5 rounded border border-slate-150">
                    <p className="text-[9px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">Selecione quem receberá notificações automáticas:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {[...(processo.autores || []), ...(processo.reus || []), ...(processo.advogadosAutor || []), ...(processo.advogadosReu || []), ...(processo.procuradores || [])].filter(Boolean).map((nome, idx) => {
                        const isSelected = editNotificacoesDestinatarios.includes(nome);
                        return (
                          <label key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 bg-white p-1.5 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setEditNotificacoesDestinatarios(prev => prev.filter(x => x !== nome));
                                } else {
                                  setEditNotificacoesDestinatarios(prev => [...prev, nome]);
                                }
                              }}
                              className="cursor-pointer"
                            />
                            <span className="truncate">{nome}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex gap-1 mt-2 border-t border-slate-200 pt-2 shadow-xs">
                      <button onClick={() => handleSaveField('notificacoesDestinatarios')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar Destinatários</button>
                      <button onClick={() => { setEditNotificacoesDestinatarios(processo.notificacoesDestinatarios || []); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-slate-708 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(processo.notificacoesDestinatarios || []).map((n, i) => (
                      <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded-lg border border-purple-100 text-[10px] inline-flex items-center gap-1">
                        ✉️ {n}
                      </span>
                    ))}
                    {(processo.notificacoesDestinatarios || []).length === 0 && (
                      <span className="text-slate-400 italic text-[10px]">Não há destinatários atualmente agendados para alertas automáticos.</span>
                    )}
                  </div>
                )}
              </div>
              {editingField !== 'notificacoesDestinatarios' && (
                <button onClick={() => { setEditNotificacoesDestinatarios(processo.notificacoesDestinatarios || []); setEditingField('notificacoesDestinatarios'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* ELEMENT 13: FUNCIONÁRIOS RESPONSÁVEIS */}
            <div className="bg-white p-4 border border-slate-150 rounded-xl shadow-3xs hover:border-slate-300 transition-all flex flex-col justify-between relative z-[26] md:col-span-1 lg:col-span-1">
              <div>
                <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block mb-1">
                  13. Funcionários Responsáveis ({editFuncionariosList.length})
                </span>
                {editingField === 'funcionarios' ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5 relative">
                      <input
                        type="text"
                        value={currEditFuncionario}
                        onChange={(e) => {
                          setCurrEditFuncionario(e.target.value);
                          setShowEditFuncionarioSuggestions(true);
                        }}
                        onFocus={() => setShowEditFuncionarioSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowEditFuncionarioSuggestions(false), 200)}
                        placeholder="Adicionar funcionário..."
                        className="flex-1 bg-white border border-slate-205 rounded p-1.5 text-xs font-semibold focus:outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFuncionario(currEditFuncionario))}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddFuncionario(currEditFuncionario)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                      >
                        Adicionar
                      </button>
                      {showEditFuncionarioSuggestions && getFuncionarioSuggestions().length > 0 && (
                        <div className="absolute z-55 left-0 right-0 top-full mt-1 max-h-32 overflow-y-auto bg-white border border-slate-202 rounded shadow-lg">
                          {getFuncionarioSuggestions().map((item) => (
                            <div
                              key={item}
                              onMouseDown={() => {
                                handleAddFuncionario(item);
                              }}
                              className="px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors text-left"
                            >
                              <div className="font-bold text-slate-800 text-[11.5px]">👤 {item}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto pt-1">
                      {editFuncionariosList.map((f, i) => (
                        <div key={i} className="flex justify-between items-center p-1.5 bg-slate-50 border border-slate-200 rounded text-xs">
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">👤 {f}</span>
                          <button
                            type="button"
                            onClick={() => setEditFuncionariosList(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-rose-600 hover:bg-rose-55 px-1 py-0.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1 pt-1 border-t border-slate-100">
                      <button onClick={() => handleSaveField('funcionarios')} className="px-2 py-1 bg-emerald-600 text-white rounded font-bold text-[9px] cursor-pointer">Gravar Todos</button>
                      <button onClick={() => { setEditFuncionariosList(processo.funcionarios || []); setEditingField(null); }} className="px-2 py-1 bg-slate-200 text-zinc-707 rounded font-bold text-[9px] cursor-pointer">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 mt-1">
                    {(processo.funcionarios || []).map((f, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded font-semibold text-[10px] mr-1 mb-1">👤 {f}</span>
                    ))}
                    {(!processo.funcionarios || processo.funcionarios.length === 0) && <span className="text-slate-400 italic text-[10px] block">Nenhum</span>}
                  </div>
                )}
              </div>
              {editingField !== 'funcionarios' && (
                <button onClick={() => { setEditFuncionariosList(processo.funcionarios || []); setEditingField('funcionarios'); }} className="mt-2 text-[10px] text-blue-600 hover:underline font-bold text-left cursor-pointer">✏️ Abrir Formulário</button>
              )}
            </div>

            {/* SEPARADOR CUSTAS E TAXAS DE JUSTIÇA */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-zinc-50 border border-zinc-200 rounded-xl p-4.5 space-y-2 mt-2 card-section-wrap shadow-3xs">
              <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5 font-sans">
                ⚖️ Custas e Taxas de Justiça Comprovadas (Gerado a partir dos Documentos Oficiais)
              </span>
              <div className="flex flex-wrap gap-2.5">
                {(() => {
                  const taxaJusticaDocs = processo.documentos.filter(d => d.categoria.toLowerCase() === 'taxa de justiça' && d.valorTaxaJustica !== undefined);
                  const totalTaxasPorParte: Record<string, number> = {};
                  taxaJusticaDocs.forEach(d => {
                    const pagador = d.pagadorTaxaJustica || 'Não especificada';
                    totalTaxasPorParte[pagador] = (totalTaxasPorParte[pagador] || 0) + (d.valorTaxaJustica || 0);
                  });

                  const entries = Object.entries(totalTaxasPorParte);
                  if (entries.length === 0) {
                    return <span className="text-zinc-400 italic text-[10.5px]">Nenhum pagamento de Taxa de Justiça registado nos documentos anexos.</span>;
                  }

                  return entries.map(([parte, total]) => (
                    <div key={parte} className="inline-flex items-center gap-1.5 bg-white border border-zinc-150 rounded-lg px-2.5 py-1 text-xs shadow-3xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                      <strong className="text-zinc-800 font-semibold">{parte}:</strong>
                      <span className="font-extrabold text-blue-600 font-mono">
                        {total.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            </div>

            {/* BOTÕES DE AÇÃO DO FORMULÁRIO COMPLETO */}
            <div className="flex justify-end gap-3 pt-5 border-t border-slate-200">
              <button
                type="submit"
                className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span>💾</span> Gravar Ficha de Autuação Completa (13 Campos)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMetadataExpanded(false);
                }}
                className="px-4.5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar Sem Gravar
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };


  // States for OCR Scanner Tab
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrSelectedDocId, setOcrSelectedDocId] = useState(() => {
    return processo.documentos.length > 0 ? processo.documentos[0].id : '';
  });
  const [ocrResult, setOcrResult] = useState<any>(null);

  // States for Agenda Tab
  const [agendaNewTitle, setAgendaNewTitle] = useState('');
  const [agendaNewDate, setAgendaNewDate] = useState(() => getLocalTodayString());
  const [agendaNewDateStr, setAgendaNewDateStr] = useState(() => getLocalTodayString());
  const [agendaNewDest, setAgendaNewDest] = useState('');
  const [agendaNewTime, setAgendaNewTime] = useState('14:30');
  const [agendaNewPhase, setAgendaNewPhase] = useState('Julgamento');
  const [agendaSuccessMsg, setAgendaSuccessMsg] = useState('');

  // Reusable unified timeline computing and filters for both Standard and Split-View tabs:
  const uniqueCategories = Array.from(
    new Set(
      processo.documentos
        .filter(d => !d.deleted)
        .map(d => d.categoria)
        .filter(Boolean)
    )
  );
  // Guarantee Notification representation
  if (notificacoesList.filter(n => !n.deleted).length > 0) {
    if (!uniqueCategories.includes('Notificações / Diligências')) {
      uniqueCategories.push('Notificações / Diligências');
    }
  }

  // Extract subjects present/active in this specific process
  const subjectsInProcess: string[] = ['Juiz'];
  if ((processo.advogadosAutor || []).length > 0 || (processo.advogadosReu || []).length > 0) {
    subjectsInProcess.push('Advogado');
  }
  if (processo.procuradores && processo.procuradores.length > 0) {
    subjectsInProcess.push('Procurador');
  }

  const uniqueTiposAto = Array.from(
    new Set([
      ...(processo.historicoAtos || []).map(a => a.tipoAto).filter(Boolean),
      ...processo.documentos.filter(d => !d.deleted).map(d => d.categoria).filter(Boolean)
    ])
  );

  const activeDocsList = processo.documentos.filter(d => !d.deleted);

  const uniquePresentersList = Array.from(
    new Set([
      ...processo.documentos.filter(d => !d.deleted).map(d => d.parteApresentante).filter(Boolean),
      ...(processo.historicoAtos || []).map(a => a.parteAssociada).filter(Boolean)
    ])
  );

  // Chronological timeline calculation
  const timelineActs = processo.historicoAtos || [];
  const docIdsLinkedToActs = new Set<string>();
  timelineActs.forEach(a => {
    if (a.documentosIds) {
      a.documentosIds.forEach(id => docIdsLinkedToActs.add(id));
    }
  });

  const standaloneDocs = processo.documentos.filter(d => !d.deleted && !docIdsLinkedToActs.has(d.id) && !d.isAnexoDoc && !d.parentDocId);

  // Combine together for chronological timeline render
  const timelineItems: Array<
    | { type: 'ato'; date: string; data: HistoricoAto }
    | { type: 'standalone_doc'; date: string; data: Documento }
    | { type: 'notificacao'; date: string; data: ProcessNotificacao }
  > = [];

  timelineActs.forEach(a => {
    timelineItems.push({ type: 'ato', date: a.data, data: a });
  });

  standaloneDocs.forEach(d => {
    timelineItems.push({ type: 'standalone_doc', date: d.dataApresentacao, data: d });
  });

  notificacoesList.filter(n => !n.deleted).forEach(n => {
    const dateOnly = n.dataCriacao.substring(0, 10);
    timelineItems.push({ type: 'notificacao', date: dateOnly, data: n });
  });

  const filteredTimelineItems = timelineItems.filter(item => matchesFilters(item));

  // Sort timeline items based on selected sort order (descending or ascending)
  filteredTimelineItems.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    return docSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  // Handle template selection in Minutar tab
  const handleSelectDraftTemplate = (modeloId: string) => {
    setDraftModeloId(modeloId);
    const modelos = getFormModelos();
    const selected = modelos.find(m => m.id === modeloId);
    if (selected) {
      setDraftName(selected.nome);
      setDraftCategory('Despacho');
      setDraftTexto(selected.texto);
    }
  };

  const handleSaveDraftAsDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTexto.trim()) {
      alert('A minuta está vazia! Por favor redija as declarações antes de indexar.');
      return;
    }
    const mainDocId = generateId ? generateId() : 'doc_' + Math.random().toString(36).substr(2, 9);
    const newDoc: Documento = {
      id: mainDocId,
      nome: draftName.trim().endsWith('.pdf') ? draftName.trim() : draftName.trim() + '.pdf',
      categoria: draftCategory,
      dataApresentacao: new Date().toISOString().split('T')[0],
      parteApresentante: draftParteApresentante,
      advogadoApresentante: draftCriadoPor,
      conteudoTexto: draftTexto,
      tipoMime: 'application/pdf',
      tamanho: `${Math.ceil(draftTexto.length / 5.2 / 100)} KB`,
      deleted: false,
      criadoPor: draftCriadoPor,
      createdAt: new Date().toISOString(),
      isCriadoNaApp: true
    };
    if (onAddDocumentToProcesso) {
      onAddDocumentToProcesso(processo.numero, newDoc);

      // Save additional annexed documents
      draftAnexos.forEach((anexo, idx) => {
        const sizeInKb = Math.ceil((anexo.conteudoTexto.length || 150) / 102.4) || 2;
        const subDoc: Documento = {
          id: `draft-anexo-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          nome: anexo.nome.trim().endsWith('.pdf') ? anexo.nome.trim() : anexo.nome.trim() + '.pdf',
          categoria: anexo.categoria || 'Documento de Apoio',
          dataApresentacao: new Date().toISOString().split('T')[0],
          parteApresentante: draftParteApresentante,
          advogadoApresentante: draftCriadoPor,
          conteudoTexto: anexo.conteudoTexto || 'Documento complementar anexado à minuta jurídica.',
          conteudoUrl: anexo.conteudoUrl,
          tamanho: `${sizeInKb} KB`,
          tipoMime: 'application/pdf',
          deleted: false,
          parentDocId: mainDocId,
          isAnexoDoc: true,
          criadoPor: draftCriadoPor,
          createdAt: new Date().toISOString(),
          isCriadoNaApp: true
        };
        onAddDocumentToProcesso(processo.numero, subDoc);
      });

      // set active document in split view to the drafted document
      setActiveDetailDoc(newDoc);
      alert('Minuta jurídica redigida com sucesso (com os respetivos anexos) e indexada ao Arquivo Geral do Processo!');
      setDraftTexto('');
      setDraftAnexos([]);
    }
  };

  const handleRunOcrOnDocument = () => {
    const doc = processo.documentos.find(d => d.id === ocrSelectedDocId) || activeDetailDoc;
    if (!doc) {
      alert('Nenhum documento selecionado para processamento OCR!');
      return;
    }
    setOcrProgress(0);
    setOcrScanning(true);
    setOcrResult(null);

    const interval = setInterval(() => {
      setOcrProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setOcrScanning(false);
          // Set simulated results based on process metadata and document category
          setOcrResult({
            numero: processo.numero,
            tipo: processo.tipo || 'criminal',
            autores: processo.autores || [],
            reus: processo.reus || [],
            valor: processo.valorAcao || 12500,
            juiz: processo.juizTitular || 'Dr. Rui Jorge Faria',
            notas: `Análise OCR sobre o documento "${doc.nome}": Encontrada conformidade na representação legal das partes processuais. Os interesses jurídicos foram devidamente descritos e o sêlo digital foi processado com validade legal pela assessoria da Comarca.`
          });
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const handleApplyOcrMetadata = () => {
    if (!ocrResult) return;
    if (onUpdateProcesso) {
      onUpdateProcesso({
        ...processo,
        juizTitular: ocrResult.juiz,
        valorAcao: ocrResult.valor
      });
      alert('Metadados sincronizados e atualizados na Ficha Principal do Caso!');
      setOcrResult(null);
    }
  };

  const handleAddAgendaEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaNewTitle.trim()) return;

    // Create a new timeline event
    const newAct: HistoricoAto = {
      id: generateId ? generateId() : 'act_' + Math.random().toString(36).substr(2, 9),
      tipoAto: agendaNewTitle,
      data: agendaNewDateStr || agendaNewDate,
      descricao: `Compromisso / Diligência agendada com limite em ${agendaNewDateStr || agendaNewDate}. Destinatário/Foco: ${agendaNewDest || 'Geral'}.`,
      fase: agendaNewPhase,
      documentosIds: [],
      createdAt: new Date().toISOString()
    };

    // Create the agendaCompromissos item
    const newEvtId = generateId ? generateId() : 'evt_' + Math.random().toString(36).substr(2, 9);
    const newCompromisso = {
      id: newEvtId,
      titulo: agendaNewTitle.trim(),
      dataLimite: agendaNewDateStr || agendaNewDate,
      destinatario: agendaNewDest.trim(),
      responsavel: agendaNewDest.trim() || 'Geral do Processo',
      fase: agendaNewPhase,
      createdAt: new Date().toISOString()
    };

    const updatedActs = [newAct, ...(processo.historicoAtos || [])];
    const updatedCompromissos = [newCompromisso, ...(processo.agendaCompromissos || [])];

    if (onUpdateProcesso) {
      onUpdateProcesso({
        ...processo,
        historicoAtos: updatedActs,
        agendaCompromissos: updatedCompromissos
      });
      setAgendaSuccessMsg('Compromisso agendado com sucesso e anexado ao Histórico e Linha Temporal!');
      setAgendaNewTitle('');
      setAgendaNewDest('');
      setTimeout(() => setAgendaSuccessMsg(''), 4000);
    }
  };

  const apensosList = getProcessos().filter(p => !p.deleted && p.parentProcessoNumero === processo.numero);

  const handleDeleteDocumento = (docId: string) => {
    if (window.confirm('Pretende realmente arquivar / eliminar este documento? Ele ficará disponível para restauro na área de Arquivo.')) {
      const docToDelete = processo.documentos.find(d => d.id === docId);
      const updatedDocs = processo.documentos.map(d => {
        if (d.id === docId) {
          if (currentUser && docToDelete) logAction(currentUser.username, 'Eliminação de documento', processo.numero, `Documento ${docToDelete.nome} eliminado.`);
          return { ...d, deleted: true, deletedAt: new Date().toISOString() };
        }
        return d;
      });
      if (onUpdateProcesso) {
        onUpdateProcesso({ ...processo, documentos: updatedDocs });
      }
    }
  };

  const handleOpenDocAction = (doc: Documento) => {
    setActiveDetailDoc(doc);
    setRightActiveTab('viewer');
  };

  // Timeline Act creation states
  const [showCreateActForm, setShowCreateActForm] = useState(false);
  const [actDate, setActDate] = useState(() => getLocalTodayString());
  const [actType, setActType] = useState(() => {
    const cls = getProcessAllowedActs(processo);
    return cls[0] || 'Requerimento';
  });
  const [isActTypeDropdownOpen, setIsActTypeDropdownOpen] = useState(false);
  const [actDescription, setActDescription] = useState('');
  const [actFaseStr, setActFaseStr] = useState('Instrução / Articulados');
  const [selectedDocsForAct, setSelectedDocsForAct] = useState<Record<string, boolean>>({});
  const [newActFiles, setNewActFiles] = useState<Array<{ tempId: string; nome: string; categoria: string; conteudoTexto: string; conteudoUrl?: string }>>([]);

  const handleBulkActFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      const sizeKb = (file.size / 1024).toFixed(1);
      let guessedCategory = 'Documento de Prova';
      const nameLower = file.name.toLowerCase();
      if (nameLower.includes('peticao') || nameLower.includes('peticão') || nameLower.includes('pi')) guessedCategory = 'Petição Inicial';
      else if (nameLower.includes('contestacao') || nameLower.includes('contestação')) guessedCategory = 'Contestação';
      else if (nameLower.includes('requerimento')) guessedCategory = 'Requerimento';
      else if (nameLower.includes('procuracao') || nameLower.includes('procuração')) guessedCategory = 'Procuração';
      else if (nameLower.includes('taxa') || nameLower.includes('custas') || nameLower.includes('pagamento')) guessedCategory = 'Taxa de Justiça';
      else if (nameLower.includes('identificacao') || nameLower.includes('id') || nameLower.includes('cc')) guessedCategory = 'Documento de Identificação';

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string || '';
        const autoIntro = `[Ficheiro real importado: ${file.name} - ${sizeKb} KB]\n\n`;
        const sampleText = `CONTEÚDO DIGITAL SECURE - Este ficheiro (${file.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente no arquivo digital do processo.`;

        setNewActFiles(prev => [
          ...prev,
          {
            tempId,
            nome: file.name,
            categoria: guessedCategory,
            conteudoTexto: autoIntro + sampleText,
            conteudoUrl: dataUrl
          }
        ]);
      };

      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  useEffect(() => {
    if (showCreateActForm) {
      const cls = getProcessAllowedActs(processo);
      if (cls && cls.length > 0) {
        setActType(cls[0]);
      }
      const phs = getProcessAllowedPhases(processo);
      if (phs && phs.length > 0) {
        setActFaseStr(phs[0]);
      }
      if (partesDisponiveis && partesDisponiveis.length > 0) {
        const defaultParte = partesDisponiveis[0];
        setParteApresentante(defaultParte);
        const options = getQuemPraticaOptions(defaultParte);
        if (options && options.length > 0) {
          setAdvogadoApresentante(options[0]);
        }
      }
    }
  }, [showCreateActForm, processo.tipo, processo.especieCivel, processo.tipoAccaoCivel]);

  const handleSaveActWithAttachedDocuments = () => {
    if (!actDescription.trim()) {
      alert('Por favor, preencha a descrição do ato.');
      return;
    }

    const practicalParte = parteApresentante || (partesDisponiveis.length > 0 ? partesDisponiveis[0] : 'Tribunal / Juízo');
    const practicalAdvogado = advogadoApresentante || (advogadosDisponiveis.length > 0 ? advogadosDisponiveis[0] : 'Secretaria Judicial');

    // 1. Convert new dynamic files into real Documento objects
    const createdDocuments: Documento[] = newActFiles.map(file => {
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sizeInKb = Math.ceil((file.conteudoTexto.length || 150) / 102.4) || 3;
      return {
        id: docId,
        nome: file.nome.trim() || 'Documento Anexo',
        categoria: file.categoria || 'Documento de Prova',
        dataApresentacao: actDate,
        parteApresentante: practicalParte,
        advogadoApresentante: practicalAdvogado,
        conteudoTexto: file.conteudoTexto.trim() || 'Documento digitalizado anexado ao ato processual.',
        conteudoUrl: file.conteudoUrl,
        tamanho: `${sizeInKb} KB`,
        tipoMime: 'application/pdf',
        deleted: false,
        createdAt: new Date().toISOString()
      };
    });

    // 2. Collect existing selected documents
    const linkedExistingIds = Object.keys(selectedDocsForAct).filter(id => selectedDocsForAct[id]);

    // 3. Merge all linked doc IDs
    const allLinkedDocIds = [...createdDocuments.map(d => d.id), ...linkedExistingIds];

    // 4. Create the new HistoricoAto object
    const newAct: HistoricoAto = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data: actDate,
      tipoAto: actType,
      parteAssociada: practicalParte,
      advogadoPraticante: practicalAdvogado,
      descricao: actDescription.trim(),
      fase: actFaseStr,
      documentosIds: allLinkedDocIds.length > 0 ? allLinkedDocIds : undefined,
      createdAt: new Date().toISOString()
    };

    // 5. Update process in state
    const updatedDocs = [...processo.documentos, ...createdDocuments];
    const updatedAtos = [newAct, ...(processo.historicoAtos || [])];

    if (onUpdateProcesso) {
      onUpdateProcesso({
        ...processo,
        documentos: updatedDocs,
        historicoAtos: updatedAtos
      });
      
      setNewActFiles([]);
      setSelectedDocsForAct({});
      setActDescription('');
      setShowCreateActForm(false);
      alert('Ato Processual e respetivo(s) documento(s) anexo(s) registados com sucesso na Linha de Tempo!');
    }
  };
  
  // Document uploading state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [nomeDocumento, setNomeDocumento] = useState('');
  const [categoria, setCategoria] = useState('Petição Inicial');
  const [dataApresentacao, setDataApresentacao] = useState('2026-05-29');
  const [parteApresentante, setParteApresentante] = useState('');
  const [advogadoApresentante, setAdvogadoApresentante] = useState('');
  const [conteudoTexto, setConteudoTexto] = useState('');
  const [conteudoUrl, setConteudoUrl] = useState<string | undefined>(undefined);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper lists from Processo to populate suggest dropdowns
  const partesDisponiveis = [
    'Autor',
    'Réu',
    'Procurador',
    'Juiz',
    'Funcionário',
    'Tribunal / Juízo'
  ];

  const getQuemPraticaOptions = (parte: string): string[] => {
    const list: string[] = [];
    if (parte === 'Autor') {
      // 1. Mandatário - Default
      if (processo.advogadosAutor && processo.advogadosAutor.length > 0) {
        list.push(...processo.advogadosAutor);
      } else {
        list.push('Advogado do Autor');
      }
      // 2. Parte apresentante (the authors themselves)
      if (processo.autores && processo.autores.length > 0) {
        list.push(...processo.autores);
      } else {
        list.push('Autor');
      }
    } else if (parte === 'Réu') {
      // 1. Mandatário - Default
      if (processo.advogadosReu && processo.advogadosReu.length > 0) {
        list.push(...processo.advogadosReu);
      } else {
        list.push('Advogado do Réu');
      }
      // 2. Parte apresentante (the defendants themselves)
      if (processo.reus && processo.reus.length > 0) {
        list.push(...processo.reus);
      } else {
        list.push('Réu');
      }
    } else if (parte === 'Procurador') {
      if (processo.procuradores && processo.procuradores.length > 0) {
        list.push(...processo.procuradores);
      }
      list.push('Procurador');
    } else if (parte === 'Juiz') {
      if (processo.juizTitular) {
        list.push(processo.juizTitular);
      }
      list.push('Juiz');
    } else if (parte === 'Funcionário') {
      if (processo.funcionarios && processo.funcionarios.length > 0) {
        list.push(...processo.funcionarios);
      }
      list.push('Funcionário');
    } else {
      list.push('Secretaria Judicial', 'Tribunal / Juízo');
    }
    return Array.from(new Set(list));
  };

  const advogadosDisponiveis = getQuemPraticaOptions(parteApresentante);

  useEffect(() => {
    const opts = getQuemPraticaOptions(parteApresentante);
    if (opts.length > 0) {
      setAdvogadoApresentante(opts[0]);
    }
  }, [parteApresentante, processo.juizTitular, processo.procuradores, processo.advogadosAutor, processo.advogadosReu, processo.funcionarios]);

  // Set default initial dropdown values when opening drawer
  const openUploadDrawer = () => {
    setUploadError('');
    setUploadSuccess('');
    setNomeDocumento('');
    setConteudoTexto('');
    setResumoDocumento('');

    const cats = getProcessAllowedActs(processo);
    if (cats.length > 0) {
      setCategoria(cats[0]);
    } else {
      setCategoria('Requerimento');
    }
    
    // Choose sensible defaults
    if (partesDisponiveis.length > 0) setParteApresentante(partesDisponiveis[0]);
    if (advogadosDisponiveis.length > 0) setAdvogadoApresentante(advogadosDisponiveis[0]);
    
    setShowUploadForm(true);
  };

  // Select/Deselect all
  const handleToggleSelectAll = () => {
    const allIds = processo.documentos.filter(d => !d.deleted).map(d => d.id);
    const someUnselected = allIds.some(id => !selectedDocIds[id]);
    
    const nextState: Record<string, boolean> = {};
    if (someUnselected) {
      allIds.forEach(id => {
        nextState[id] = true;
      });
    }
    setSelectedDocIds(nextState);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedDocIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleDownloadSelected = () => {
    const selectedIds = Object.keys(selectedDocIds).filter(id => selectedDocIds[id]);
    if (selectedIds.length === 0) {
      alert('Selecione pelo menos um documento para descarregar.');
      return;
    }

    const docsToDownload = processo.documentos.filter(d => selectedIds.includes(d.id));
    docsToDownload.forEach((doc, idx) => {
      setTimeout(() => {
        onDownloadFile(doc);
      }, idx * 250); // Small stagger for browser limits
    });
  };

  const handleDownloadAll = () => {
    if (processo.documentos.length === 0) {
      alert('Este processo não tem documentos para descarregar.');
      return;
    }

    processo.documentos.forEach((doc, idx) => {
      setTimeout(() => {
        onDownloadFile(doc);
      }, idx * 250);
    });
  };

  // Real Upload Reader or Form Draft Submit
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setNomeDocumento(file.name);
      
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string || '';
        setConteudoUrl(dataUrl);

        const autoIntro = `[Ficheiro real importado: ${file.name} - ${(file.size / 1024).toFixed(1)} KB]\n\n`;
        const sampleText = `CONTEÚDO DIGITAL SECURE - Este ficheiro (${file.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente no arquivo digital do processo.`;
        setConteudoTexto(autoIntro + sampleText);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitDocument = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!nomeDocumento.trim()) {
      setUploadError('Por favor, indique o nome do documento ou selecione um ficheiro.');
      return;
    }

    const textToSave = conteudoTexto.trim() || `DOCUMENTO ADICIONADO LEGALMENTE\n\nProcesso: ${processo.numero}\n\nCategoria: ${categoria}\nData de Apresentação: ${dataApresentacao}\nParte: ${parteApresentante}\nAdvogado: ${advogadoApresentante}\n\nArquivo de suporte processual em conformidade de registo jurídico.`;

    const novoDoc: Documento = {
      id: `doc-${Date.now()}`,
      nome: nomeDocumento.trim().endsWith('.pdf') ? nomeDocumento.trim() : `${nomeDocumento.trim()}.pdf`,
      categoria,
      dataApresentacao,
      parteApresentante,
      advogadoApresentante,
      conteudoTexto: textToSave,
      conteudoUrl,
      tamanho: `${(Math.random() * 500 + 50).toFixed(0)} KB`,
      tipoMime: 'application/pdf',
      resumo: resumoDocumento.trim() || undefined,
      valorTaxaJustica: categoria.toLowerCase() === 'taxa de justiça' && valorTaxaJustica ? parseFloat(valorTaxaJustica) : undefined,
      pagadorTaxaJustica: categoria.toLowerCase() === 'taxa de justiça' && pagadorTaxaJustica ? pagadorTaxaJustica : undefined,
      createdAt: new Date().toISOString()
    };

    onAddDocumentToProcesso(processo.numero, novoDoc);
    setUploadSuccess('Documento indexado e guardado no Disco C com sucesso!');
    
    // Auto reset values
    setTimeout(() => {
      setNomeDocumento('');
      setConteudoTexto('');
      setConteudoUrl(undefined);
      setResumoDocumento('');
      setValorTaxaJustica('');
      setPagadorTaxaJustica('');
      setShowUploadForm(false);
      setUploadSuccess('');
    }, 1200);
  };

  // --- NOTIFICATIONS MANAGEMENT ACTIONS ---
  const getRoleLabel = (nome: string): string => {
    if ((processo.autores || []).includes(nome)) return 'Autor';
    if ((processo.reus || []).includes(nome)) return 'Réu';
    if ((processo.advogadosAutor || []).includes(nome)) return 'Advogado do Autor';
    if ((processo.advogadosReu || []).includes(nome)) return 'Advogado do Réu';
    return 'Interveniente';
  };

  const handleSelectModelo = (modeloId: string) => {
    setSelectedFormModeloId(modeloId);
    const m = getFormModelos().find(x => x.id === modeloId);
    if (m) {
      setEditedNotifTexto(m.texto);
      if (m.tribunalId) {
        setSelectedTribunalHeaderId(m.tribunalId);
      }
    } else {
      setEditedNotifTexto('');
    }
  };

  const handleSaveNotificacaoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFormModeloId) {
      alert('Por favor, escolha um modelo de formulário.');
      return;
    }
    const selectedNomes = Object.keys(selectedDestinatarios).filter(k => selectedDestinatarios[k]);
    if (selectedNomes.length === 0) {
      alert('Selecione pelo menos um destinatário da notificação.');
      return;
    }

    const compiledDestinatarios = selectedNomes.map(nome => ({
      nome,
      morada: findCurrentAddressFor(nome)
    }));

    const notificationId = generateId ? generateId() : 'notif-' + Date.now();
    const mainNotifDocId = `notif-doc-${Date.now()}`;
    const annexedDocsIds: string[] = [];

    // Save additional annexed documents first if callback available
    if (onAddDocumentToProcesso) {
      notifAnexos.forEach((anexo, idx) => {
        const sizeInKb = Math.ceil((anexo.conteudoTexto.length || 150) / 102.4) || 2;
        const subDocId = `notif-anexo-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
        annexedDocsIds.push(subDocId);
        
        const subDoc: Documento = {
          id: subDocId,
          nome: anexo.nome.trim().endsWith('.pdf') ? anexo.nome.trim() : anexo.nome.trim() + '.pdf',
          categoria: anexo.categoria || 'Documento de Apoio',
          dataApresentacao: new Date().toISOString().split('T')[0],
          parteApresentante: notifParteApresentante,
          advogadoApresentante: notifCriadoPorFuncionario,
          conteudoTexto: anexo.conteudoTexto || 'Documento complementar anexado à notificação oficial.',
          conteudoUrl: anexo.conteudoUrl,
          tamanho: `${sizeInKb} KB`,
          tipoMime: 'application/pdf',
          deleted: false,
          notificacaoId: notificationId,
          parentDocId: mainNotifDocId,
          isAnexoDoc: true,
          criadoPor: notifCriadoPorFuncionario,
          createdAt: new Date().toISOString(),
          isCriadoNaApp: true
        };
        onAddDocumentToProcesso(processo.numero, subDoc);
      });
    }

    const novaNotificacao: ProcessNotificacao = {
      id: notificationId,
      processoNumero: processo.numero,
      formModeloId: selectedFormModeloId,
      tribunalId: selectedTribunalHeaderId,
      destinatarios: compiledDestinatarios,
      textoEditado: editedNotifTexto,
      dataCriacao: new Date().toISOString(),
      criadoPorFuncionario: notifCriadoPorFuncionario,
      documentosAnexosIds: annexedDocsIds
    };

    saveNotificacao(novaNotificacao);
    setNotificacoesList(getNotificacoes().filter(n => n.processoNumero === processo.numero));

    // Auto-index a corresponding copy of this notification inside our Processo's documents tree
    const modelName = getFormModelos().find(m => m.id === selectedFormModeloId)?.nome || 'Notificação';
    const docCopy: Documento = {
      id: mainNotifDocId,
      notificacaoId: novaNotificacao.id,
      nome: `Notificacao_${modelName.replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}.pdf`,
      categoria: 'Notificação',
      dataApresentacao: new Date().toISOString().split('T')[0],
      parteApresentante: notifParteApresentante,
      advogadoApresentante: notifCriadoPorFuncionario,
      conteudoTexto: `NOTIFICAÇÃO JUDICIAL EMITIDA\n\nProcesso: ${processo.numero}\nModelo: ${modelName}\nCriada pelo funcionário/juiz: ${notifCriadoPorFuncionario}\n\nDestinatários:\n${compiledDestinatarios.map(d => `- ${d.nome} (${d.morada})`).join('\n')}\n\nREDAÇÃO DA NOTIFICAÇÃO:\n------------------------------------------------------------\n${editedNotifTexto}`,
      tamanho: '142 KB',
      tipoMime: 'application/pdf',
      criadoPor: notifCriadoPorFuncionario,
      createdAt: new Date().toISOString(),
      isCriadoNaApp: true
    };

    if (onAddDocumentToProcesso) {
      onAddDocumentToProcesso(processo.numero, docCopy);
    }
    
    // Clear states
    setSelectedFormModeloId('');
    setSelectedDestinatarios({});
    setEditedNotifTexto('');
    setNotifAnexos([]);
    setShowCreateNotif(false);
    alert('Notificação Oficial criada com sucesso por ' + notifCriadoPorFuncionario + '! Foi arquivada e indexada uma cópia do documento no acervo digital do processo (com os seus anexos).');
  };

  const handleDeleteNotif = (notifId: string) => {
    if (window.confirm('Pretende anular o registo desta notificação?')) {
      const list = getNotificacoes();
      const updated = list.filter(n => n.id !== notifId);
      localStorage.setItem('gestao_processos_notificacoes', JSON.stringify(updated));
      setNotificacoesList(updated.filter(n => n.processoNumero === processo.numero));
    }
  };

  const activeDocsForSelection = processo.documentos.filter(d => !d.deleted);
  const isAllSelected = activeDocsForSelection.length > 0 && 
    activeDocsForSelection.every(d => selectedDocIds[d.id]);
  
  const selectedCount = Object.keys(selectedDocIds).filter(id => selectedDocIds[id]).length;

  const renderRightSplitColumn = () => {
    const defaultTemplates = [
      { id: 't1', titulo: 'Despacho Inicial de Admissão', categoria: 'Despacho', texto: 'Vistos.\n\nSaneador dos Autos: Admitida a presente petição inicial por legal e tempestiva.\nDefiro as provas requeridas. Citem-se as partes passivas com prazo legal.' },
      { id: 't2', titulo: 'Acórdão / Sentença Final de Julgamento', categoria: 'Sentença', texto: 'DISPOSITIVO CONCLUSIVO:\n\nEm face do exposto, o Tribunal julga a ação procedente por provada e condena o réu no pedido reclamado.\n\nRegiste e Notifique.' },
      { id: 't3', titulo: 'Mandado de Notificação Oficial', categoria: 'Notificação', texto: 'NOTIFICAÇÃO OFICIAL DE AUDIÊNCIA:\n\nFica por este meio notificado o destinatário para comparecer perante o Juízo da Comarca para audiência de inquirição.' }
    ];

    const activeTemplatesList = getFormModelos().length > 0 ? getFormModelos() : defaultTemplates;

    const highlightText = (text: string, enabled: boolean) => {
      if (!enabled || !text) return text;
      let html = text;
      const terms = [
        'Carlos Manuel Fonseca',
        'Rui Jorge Faria',
        'Ministério Público',
        '7.550 EUR',
        'Art. 204º',
        'Art. 204°',
        'Tribunal da Comarca Local',
        'Glória Oliveira',
        'CITAÇÃO / NOTIFICAÇÃO',
        'Petição Inicial',
        'Comarca',
        'Acusação',
        'Constituição de Arguido'
      ];
      terms.forEach(term => {
        const regex = new RegExp(`(${term})`, 'gi');
        html = html.replace(regex, `<mark class="bg-amber-100 hover:bg-amber-150 border-b border-amber-300 font-bold text-amber-950 rounded px-1 cursor-help transition-all shadow-3xs">$1</mark>`);
      });
      return <div dangerouslySetInnerHTML={{ __html: html }} />;
    };

    return (
      <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
        
        {/* INTERACTIVE TAB SWITCHER BAR */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-1 justify-between items-center leading-normal select-none shadow-3xs shrink-0">
          <button
            type="button"
            onClick={() => setRightActiveTab('viewer')}
            className={`flex-1 py-1.5 text-center rounded-xl font-bold font-display text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              rightActiveTab === 'viewer'
                ? 'bg-white shadow-2xs border border-slate-205 text-blue-800'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            👁️ Split-View
          </button>
          <button
            type="button"
            onClick={() => setRightActiveTab('notificar')}
            className={`flex-1 py-1.5 text-center rounded-xl font-bold font-display text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              rightActiveTab === 'notificar'
                ? 'bg-white shadow-2xs border border-slate-205 text-blue-800'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            📝 Minutar
          </button>
          <button
             type="button"
             onClick={() => setRightActiveTab('agenda')}
             className={`flex-1 py-1.5 text-center rounded-xl font-bold font-display text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
               rightActiveTab === 'agenda'
                 ? 'bg-white shadow-2xs border border-slate-205 text-blue-800'
                 : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
             }`}
           >
             📅 Agenda
           </button>
          
          {!isNewTabMode && (
            <button
              type="button"
              onClick={() => setActiveDetailDoc(null)}
              className="p-1 px-2.5 hover:bg-rose-50 text-rose-600 rounded-lg font-bold text-[10px] uppercase border border-rose-200 shadow-3xs hover:border-rose-300 ml-1 cursor-pointer transition-all shrink-0"
              title="Fechar Split-View"
            >
              ✕ Fechar
            </button>
          )}
        </div>

        {/* ACTIVE TAB DYNAMIC WORKSTATION BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* TAB 1: SPLIT SCREEN VIEWER */}
          {rightActiveTab === 'viewer' && (
            <div className="h-full flex flex-col space-y-3">
              {activeDetailDoc ? (
                <div className="flex-1 flex flex-col h-full space-y-3">
                  
                  {/* Header descriptor sheet */}
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Ficheiro Aberto em Split-Screen</span>
                      <strong className="text-slate-700 font-bold block truncate font-mono select-all">
                        {activeDetailDoc.nome}
                      </strong>
                    </div>
                    <span className="text-[9px] font-sans font-bold px-2 py-1 uppercase bg-emerald-50 text-emerald-800 border border-emerald-150 rounded shrink-0 select-none">
                      ✓ Cópia Autêntica Indexed
                    </span>
                  </div>

                  {/* Letter formatting toolbar controller */}
                  {!(activeDetailDoc.conteudoUrl && activeDetailDoc.conteudoUrl.startsWith('data:application/pdf')) && (
                    <div className="flex items-center justify-between text-[11px] bg-slate-55 border border-slate-150 p-2.5 rounded-xl gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-bold">Letra:</span>
                        <div className="inline-flex border border-slate-200 rounded overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setFontSize('normal')}
                            className={`px-2 py-0.5 font-bold ${fontSize === 'normal' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => setFontSize('large')}
                            className={`px-2 py-0.5 font-bold ${fontSize === 'large' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            A+
                          </button>
                          <button
                            type="button"
                            onClick={() => setFontSize('maximo')}
                            className={`px-2 py-0.5 font-bold ${fontSize === 'maximo' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            Máx
                          </button>
                        </div>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={ressaltarEntidades}
                          onChange={(e) => setRessaltarEntidades(e.target.checked)}
                          className="rounded text-blue-605"
                        />
                        <span>Ressaltar OCR</span>
                      </label>
                    </div>
                  )}

                  {activeDetailDoc.conteudoUrl && activeDetailDoc.conteudoUrl.startsWith('data:application/pdf') ? (
                    /* MAXIMIZED PDF IFRAME AREA */
                    <div className="w-full h-[81vh] border border-slate-250 rounded-2xl overflow-hidden bg-slate-100 flex flex-col shadow-3xs">
                      <iframe
                        src={activeDetailDoc.conteudoUrl}
                        className="w-full h-full border-0"
                        title="Leitor de PDF integrado"
                      >
                        <p className="p-4 text-xs text-slate-500 text-center font-bold">
                          O seu navegador não suporta a visualização direta de PDFs. 
                          <a href={activeDetailDoc.conteudoUrl} download={activeDetailDoc.nome} className="text-blue-600 underline ml-1 font-bold">Clique aqui para descarregar o documento.</a>
                        </p>
                      </iframe>
                    </div>
                  ) : (
                    <>
                      {/* SCROLLABLE WHITE PDF-LOOKING PAPER SHEET */}
                      <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-3xs overflow-y-auto max-h-[52vh] font-sans relative">
                        <div className="text-center font-display uppercase font-semibold text-[10px] tracking-[0.2em] text-slate-400 mb-2 select-none border-b border-dashed border-slate-200 pb-2">
                          TRIBUNAL DA COMARCA LOCAL • SECÇÃO DE EXPEDIENTE
                        </div>
                        <div className={`leading-relaxed whitespace-pre-wrap select-text break-words ${
                          fontSize === 'normal' ? 'text-xs' : fontSize === 'large' ? 'text-sm' : 'text-base'
                        }`}>
                          {highlightText(
                            activeDetailDoc.conteudoTexto || 
                            `CONTEÚDO DIGITAL INTEGRADO\n\nFicheiro: ${activeDetailDoc.nome}\nCategoria: ${activeDetailDoc.categoria}\nParte: ${activeDetailDoc.parteApresentante}\nAdvogado: ${activeDetailDoc.advogadoApresentante}\nData Registo: ${activeDetailDoc.dataApresentacao}\n\nEste documento integra o processo oficial da Comarca nos termos da legislação processual em vigor.`,
                            ressaltarEntidades
                          )}
                        </div>
                      </div>

                      {/* Bottom file utility buttons */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const w = window.open('', '_blank');
                            if (w) {
                              w.document.write(`<html><head><title>${activeDetailDoc.nome}</title><style>body{font-family:sans-serif;padding:3rem;line-height:1.6;}</style></head><body><h1>${activeDetailDoc.nome}</h1><hr/><pre style="white-space:pre-wrap;">${activeDetailDoc.conteudoTexto || 'Sem conteúdo.'}</pre></body></html>`);
                              w.document.close();
                              w.print();
                            }
                          }}
                          className="py-2.5 px-3 border border-slate-250 text-slate-700 bg-white rounded-xl hover:bg-slate-50 cursor-pointer font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Imprimir</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([activeDetailDoc.conteudoTexto || ''], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            
                            let name = activeDetailDoc.nome;
                            if (name.toLowerCase().endsWith('.pdf')) {
                              name = name.substring(0, name.length - 4);
                            }
                            if (!name.toLowerCase().endsWith('.txt') && !name.toLowerCase().endsWith('.md')) {
                              name = name + '.txt';
                            }
                            
                            link.download = name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                          }}
                          className="py-2.5 px-3 bg-blue-650 text-white rounded-xl hover:bg-blue-750 cursor-pointer font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>Descarregar .txt</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center text-slate-400 p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/20">
                  <span className="text-4xl mb-3">👁️</span>
                  <h3 className="font-bold text-slate-800 text-xs mb-1">Ecrã Dividido Vazio</h3>
                  <p className="text-[11px] text-slate-450 leading-relaxed max-w-xs">
                    Clique em qualquer documento com a indicação "(Ecrã Dividido)" na linha do tempo ou no arquivo para visualizar em paralelo.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MINUTAR / JURIDICAL MEMO DRAFTS DOCK */}
          {rightActiveTab === 'notificar' && (
            <form onSubmit={handleSaveDraftAsDocument} className="space-y-4 text-xs text-slate-700 leading-normal">
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display border-b border-slate-150 pb-1.5">
                  📝 Minutar Novo Documento / Despacho Judicial
                </h3>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Selecionar Modelo Inicial</label>
                  <select
                    value={draftModeloId}
                    onChange={(e) => handleSelectDraftTemplate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold cursor-pointer focus:outline-hidden text-xs"
                  >
                    <option value="">-- Modelo Livre (Vazio) --</option>
                    {activeTemplatesList.map((model) => (
                      <option key={model.id} value={model.id}>{model.titulo}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Título do Ficheiro (.pdf)</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full bg-white border p-2 focus:outline-hidden font-bold text-slate-800 rounded-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Classificação</label>
                    <select
                      value={draftCategory}
                      onChange={(e) => setDraftCategory(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2 font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="Despacho">Despacho</option>
                      <option value="Notificação">Notificação</option>
                      <option value="Sentença">Sentença</option>
                      <option value="Citação">Citação de Artigo</option>
                      <option value="Requerimento">Requerimento livre</option>
                      <option value="Ata de Julgamento">Ata de Julgamento</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Parte Apresentante *</label>
                    <select
                      value={draftParteApresentante}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftParteApresentante(val);
                        if (val === 'Juízo') {
                          setDraftCriadoPor(getProcessClerk());
                        } else {
                          setDraftCriadoPor(getProcessJudge());
                        }
                      }}
                      className="w-full bg-white border rounded-lg p-2 font-semibold focus:outline-hidden cursor-pointer text-xs"
                    >
                      <option value="Juízo">Juízo</option>
                      <option value="Magistrado">Magistrado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Quem Pratica o Ato *</label>
                  <select
                    value={draftCriadoPor}
                    onChange={(e) => setDraftCriadoPor(e.target.value)}
                    className="w-full bg-white border rounded-lg p-2 font-semibold focus:outline-hidden cursor-pointer text-xs"
                    required
                  >
                    {draftParteApresentante === 'Juízo' ? (
                      <>
                        {getFuncionarios().map(f => (
                          <option key={f} value={f}>Oficial - {f}</option>
                        ))}
                        {currentUser?.username && !getFuncionarios().includes(currentUser.username) && (
                          <option value={currentUser.username}>Utilizador Atual - {currentUser.username}</option>
                        )}
                      </>
                    ) : (
                      <>
                        {getJuizes().map(j => (
                          <option key={j} value={j}>Juiz(a) - {j}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1 font-sans">
                  <label className="text-[10px] font-black uppercase text-slate-400">Redação do Documento Judicial</label>
                  <textarea
                    value={draftTexto}
                    onChange={(e) => setDraftTexto(e.target.value)}
                    rows={8}
                    className="w-full bg-white border p-3 rounded-lg focus:outline-hidden font-mono text-zinc-850 leading-relaxed max-h-[30vh] text-xs"
                    placeholder="Redija os parágrafos legais da minuta..."
                    required
                  />
                </div>

                {/* Attachments Section for Minutar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b pb-1.5 border-slate-200">
                    <span className="text-[9.5px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                      Documentos Anexos / Comprovativos Complementares (Opcional)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftAnexos(prev => [
                          ...prev,
                          {
                            tempId: `draft-temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            nome: 'Anexo_Documento.pdf',
                            categoria: 'Apoio Legislativo',
                            conteudoTexto: ''
                          }
                        ]);
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="h-3 w-3 text-slate-500" />
                      Anexar Ficheiro
                    </button>
                  </div>

                  {draftAnexos.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">
                      Nenhum anexo adicionado a esta minuta. Se pretender juntar ficheiros complementares a este despacho ou certidão, clique acima.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {draftAnexos.map((file, idx) => (
                        <div key={file.tempId} className="bg-white border text-xs border-slate-200 rounded-lg p-2.5 relative space-y-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setDraftAnexos(prev => prev.filter(f => f.tempId !== file.tempId));
                            }}
                            className="absolute right-1.5 top-1.5 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Remover"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[8px] text-slate-400 font-bold uppercase block">Nome do Anexo</label>
                              <input
                                type="text"
                                value={file.nome}
                                required
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftAnexos(prev => prev.map(f => f.tempId === file.tempId ? { ...f, nome: val } : f));
                                }}
                                className="w-full bg-slate-50 border p-1.5 rounded-lg focus:outline-hidden"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[8px] text-slate-400 font-bold uppercase block">Tipo Anexo</label>
                              <select
                                value={file.categoria}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftAnexos(prev => prev.map(f => f.tempId === file.tempId ? { ...f, categoria: val } : f));
                                }}
                                className="w-full bg-slate-50 border p-1 rounded-lg focus:outline-hidden cursor-pointer"
                              >
                                <option value="Apoio Legislativo">Apoio Legislativo</option>
                                <option value="Comprovativo de Diligência">Comprovativo de Diligência</option>
                                <option value="Anexo Fotográfico">Anexo Fotográfico</option>
                                <option value="Transcrição">Transcrição de Depoimentos</option>
                                <option value="Outro">Outro Apoio</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <label className="text-[8px] text-slate-400 font-bold uppercase block">Conteúdo / Descrição do Ficheiro *</label>
                            <textarea
                              value={file.conteudoTexto}
                              required
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setDraftAnexos(prev => prev.map(f => f.tempId === file.tempId ? { ...f, conteudoTexto: val } : f));
                              }}
                              rows={1.5}
                              placeholder="Teor resumido do anexo..."
                              className="w-full bg-slate-50 border p-1 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Indexar Minuta Redigida ao Arquivo (1-Clique)
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: CALENDAR DEADLINES SCHEDULER WIDGET */}
          {rightActiveTab === 'agenda' && (
            <div className="space-y-4 text-xs text-slate-700 leading-normal">
              <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display border-b border-slate-150 pb-1.5 flex items-center justify-between">
                  <span>📅 Agenda e Calendário Adicional</span>
                </h3>

                {agendaSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-lg text-[10.5px] font-bold">
                    {agendaSuccessMsg}
                  </div>
                )}

                {/* Creation form */}
                <form onSubmit={handleAddAgendaEvent} className="space-y-3 bg-white border border-slate-150 p-3.5 rounded-xl text-xs space-y-3">
                  <strong className="text-[10px] uppercase text-slate-405 font-bold tracking-wider block border-b border-slate-100 pb-1">Agendar Diligência / Prazo Limite</strong>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold">Título da Diligência</label>
                    <input
                      type="text"
                      value={agendaNewTitle}
                      onChange={(e) => setAgendaNewTitle(e.target.value)}
                      placeholder="Ex: Leitura de Sentença, Inquirição de Testemunhas"
                      required
                      className="w-full bg-slate-50 border p-1.5 rounded focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-bold">Data Limite *</label>
                      <input
                        type="date"
                        value={agendaNewDateStr}
                        onChange={(e) => setAgendaNewDateStr(e.target.value)}
                        required
                        className="w-full bg-slate-50 border p-1.5 rounded focus:outline-hidden font-mono text-slate-750"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-bold">Destinatário</label>
                      <input
                        type="text"
                        value={agendaNewDest}
                        onChange={(e) => setAgendaNewDest(e.target.value)}
                        placeholder="Ex: Rui Faria, Juiz"
                        className="w-full bg-slate-50 border p-1.5 rounded focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-3xs cursor-pointer"
                  >
                    Registar Novo Prazo
                  </button>
                </form>

                {/* Event lists */}
                <div className="space-y-2">
                  <span className="text-[9px] uppercase text-slate-405 font-bold tracking-wider block border-b border-slate-100 pb-1">Próximos Compromissos deste Caso ({(processo.agendaCompromissos || []).length})</span>
                  {(processo.agendaCompromissos || []).length === 0 ? (
                    <p className="p-4 bg-white border text-center text-slate-400 italic rounded-xl">Sem compromissos adicionais agendados.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {(processo.agendaCompromissos || []).map(evt => (
                        <div key={evt.id} className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl relative group flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Deseja cancelar o agendamento desta diligência?')) {
                                const updatedEvents = (processo.agendaCompromissos || []).filter(e => e.id !== evt.id);
                                if (onUpdateProcesso) {
                                  onUpdateProcesso({ ...processo, agendaCompromissos: updatedEvents });
                                }
                              }
                            }}
                            className="absolute right-1 top-2.5 p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          
                          <div className="p-1 px-2.5 bg-zinc-100 border text-center min-w-[50px] rounded-lg shrink-0 flex flex-col justify-center leading-tight">
                            <span className="text-[12px] font-mono font-bold text-slate-700">{evt.dataLimite.split('-')[2]}</span>
                            <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 font-sans">
                              {new Date(evt.dataLimite + 'T00:00:00').toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 text-xs">
                            <h4 className="font-bold text-slate-800 leading-snug truncate pr-4">{evt.titulo}</h4>
                            <span className="text-[10px] text-slate-450">Foco: {evt.responsavel || 'Geral do Processo'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNewTabModeContent = () => {
    return (
      <div className="flex flex-col lg:flex-row gap-5 h-screen overflow-hidden font-sans text-slate-800 antialiased p-4 bg-slate-50">
        
        {/* LEFT COLUMN: 7 columns ratio, scrollable */}
        <div className="flex-1 lg:max-w-[55%] flex flex-col h-full overflow-y-auto pr-2 space-y-5">
          
          {/* Header metadata folder card */}
          {renderFichaProcesso()}

          {renderSubProcessTabs()}

          {/* TIMELINE OF EVENTS AND ACTS (HIDDEN) */}
          <div className="hidden bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-xs font-black uppercase text-slate-405 tracking-wider font-display flex items-center gap-1.5">
                <span>📋</span> LINHA DE TEMPO DE ATOS PROCESSUAIS ({(processo.historicoAtos || []).length} ATOS)
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateActForm(!showCreateActForm)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 select-none hover:underline"
              >
                {showCreateActForm ? '✕ Cancelar Ato' : '+ Averbar Ato Judicial'}
              </button>
            </div>

            {/* Averbar manual acto form */}
            {showCreateActForm && (
              <div
                className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Tipo de Ato / Ocorrência</label>
                    <select
                      value={actType}
                      onChange={(e) => setActType(e.target.value)}
                      className="w-full bg-white p-1.5 border rounded focus:outline-hidden font-medium cursor-pointer"
                    >
                      {getProcessAllowedActs(processo).map((classification) => (
                        <option key={classification} value={classification}>
                          {classification}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Data Ocorrência</label>
                    <input
                      type="date"
                      value={actDate}
                      onChange={(e) => setActDate(e.target.value)}
                      className="w-full bg-white p-1.5 border font-mono rounded focus:outline-hidden text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Fase do processo</label>
                    <select
                      value={actFaseStr}
                      onChange={(e) => setActFaseStr(e.target.value)}
                      className="w-full bg-white p-1.5 border rounded focus:outline-hidden cursor-pointer text-xs"
                    >
                      {getProcessAllowedPhases(processo).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Parte Apresentante</label>
                    <select
                      value={parteApresentante}
                      onChange={(e) => setParteApresentante(e.target.value)}
                      className="w-full bg-white p-1.5 border rounded focus:outline-hidden text-xs"
                    >
                      {partesDisponiveis.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Quem pratica o ato</label>
                    <select
                      value={advogadoApresentante}
                      onChange={(e) => setAdvogadoApresentante(e.target.value)}
                      className="w-full bg-white p-1.5 border rounded focus:outline-hidden text-xs"
                    >
                      {advogadosDisponiveis.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5 font-display">Descrição Detalhada do Ato Judicial</label>
                  <textarea
                    value={actDescription}
                    onChange={(e) => setActDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-white p-1.5 border rounded focus:outline-hidden leading-normal text-xs"
                    placeholder="Petição Inicial apresentada eletronicamente..."
                    required
                  />
                </div>

                {/* Sub-form of dynamic attachments */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-1">
                    <span className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider">📎 Ficheiros Anexos a Submeter</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewActFiles(prev => [
                          ...prev,
                          {
                            tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            nome: 'Documento de Prova',
                            categoria: 'Documento de Prova',
                            conteudoTexto: ''
                          }
                        ]);
                      }}
                      className="px-2 py-1 text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 cursor-pointer font-bold transition-all"
                    >
                      + Anexar Documento
                    </button>
                  </div>

                  {newActFiles.length === 0 ? (
                    <p className="text-[10px] text-slate-405 italic text-center py-1">Nenhum anexo adicionado.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {newActFiles.map(file => (
                        <div key={file.tempId} className="p-2 border rounded-xl bg-slate-50/75 relative space-y-1.5 shadow-3xs">
                          <button
                            type="button"
                            onClick={() => setNewActFiles(prev => prev.filter(f => f.tempId !== file.tempId))}
                            className="absolute right-1 top-1 text-red-550 hover:text-red-700 font-bold cursor-pointer hover:bg-red-50 p-1 rounded-sm text-xs"
                          >
                            ✕
                          </button>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <label className="block text-[8px] text-slate-500 uppercase font-bold mb-0.5">Tipo de Peça</label>
                              <select
                                value={file.categoria}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNewActFiles(prev => prev.map(f => f.tempId === file.tempId ? { ...f, categoria: val, nome: val } : f));
                                }}
                                className="w-full bg-white p-1 border rounded text-[10px] focus:outline-hidden cursor-pointer"
                              >
                                <option value="Petição Inicial">Petição Inicial</option>
                                <option value="Contestação">Contestação</option>
                                <option value="Requerimento">Requerimento</option>
                                <option value="Alegações de Recurso">Alegações de Recurso</option>
                                <option value="Contra-alegações">Contra-alegações</option>
                                <option value="Documento de Prova">Documento de Prova (Anexo)</option>
                                <option value="Taxa de Justiça">Comprovativo de Taxa de Justiça</option>
                                <option value="Procuração">Procuração Forense</option>
                                <option value="Outro">Outro Documento</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[8px] text-slate-500 uppercase font-bold mb-0.5">Carregar Ficheiro PC</label>
                              <div className="border border-dashed border-slate-300 hover:border-blue-400 rounded p-1 text-center bg-white cursor-pointer relative flex items-center justify-center gap-1.5 h-[26px] transition-colors">
                                <input
                                  type="file"
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                  onChange={(e) => {
                                    const picked = e.target.files?.[0];
                                    if (picked) {
                                      const sizeKb = (picked.size / 1024).toFixed(1);
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        const dataUrl = event.target?.result as string || '';
                                        const intro = `[Ficheiro real importado: ${picked.name} - ${sizeKb} KB]\n\n`;
                                        const body = `CONTEÚDO DIGITAL SECURE - Este ficheiro (${picked.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente no arquivo digital do processo.`;
                                        setNewActFiles(prev => prev.map(f => f.tempId === file.tempId ? {
                                          ...f,
                                          nome: picked.name,
                                          conteudoTexto: intro + body,
                                          conteudoUrl: dataUrl
                                        } : f));
                                      };
                                      reader.readAsDataURL(picked);
                                    }
                                  }}
                                />
                                <Upload className="h-2.5 w-2.5 text-zinc-400" />
                                <span className="text-[9px] font-bold text-zinc-650 truncate max-w-[100px]">
                                  {file.nome !== 'Documento de Prova' ? file.nome : 'Procurar do Computador'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase font-bold mb-0.5">Resumo / Conteúdo de Texto</label>
                            <input
                              type="text"
                              value={file.conteudoTexto}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewActFiles(prev => prev.map(f => f.tempId === file.tempId ? { ...f, conteudoTexto: val } : f));
                              }}
                              className="w-full bg-white px-2 py-1 border rounded text-[10px] focus:outline-hidden"
                              placeholder="Ficheiro em anexo contendo..."
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateActForm(false)}
                    className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Fechar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveActWithAttachedDocuments}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md transition-all border-b-2 border-emerald-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Gravar Peça e Anexos</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filters Header Strip for NewTab Timeline */}
            <div className="bg-slate-50 border border-slate-200/65 rounded-xl p-3 flex flex-wrap items-center gap-2 text-[10px]">
              <span className="text-[9px] text-slate-400 font-extrabold uppercase shrink-0">Filtrar Histórico:</span>
              
              {/* Chronological sorting selector */}
              <select
                value={docSortOrder}
                onChange={(e) => setDocSortOrder(e.target.value as 'asc' | 'desc')}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 font-bold cursor-pointer text-[10px] focus:outline-hidden"
              >
                <option value="desc">⏱️ Recente ➔ Antigo</option>
                <option value="asc">⏱️ Antigo ➔ Recente</option>
              </select>

              {/* Category selector */}
              <select
                value={docCategoryFilter}
                onChange={(e) => setDocCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 font-bold cursor-pointer text-[10px] focus:outline-hidden"
              >
                <option value="">[Tipos de Documento ({uniqueCategories.length})]</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Author selector */}
              <select
                value={subjectAuthorFilter}
                onChange={(e) => setSubjectAuthorFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 font-bold cursor-pointer text-[10px] focus:outline-hidden"
              >
                <option value="">[Autorias ({subjectsInProcess.length})]</option>
                {subjectsInProcess.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>

              {/* Tipo de ato selector */}
              <select
                value={timelineTipoAtoFilter}
                onChange={(e) => setTimelineTipoAtoFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 font-bold cursor-pointer text-[10px] focus:outline-hidden"
              >
                <option value="">[Tipo de Ato ({uniqueTiposAto.length})]</option>
                {uniqueTiposAto.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>

              {/* Document selector */}
              <select
                value={timelineDocIdFilter}
                onChange={(e) => setTimelineDocIdFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 font-bold cursor-pointer text-[10px] focus:outline-hidden max-w-[150px]"
              >
                <option value="">[Documento ({activeDocsList.length})]</option>
                {activeDocsList.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.nome}</option>
                ))}
              </select>

              {/* Apresentado por selector */}
              <select
                value={timelineApresentadoPorFilter}
                onChange={(e) => setTimelineApresentadoPorFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 font-bold cursor-pointer text-[10px] focus:outline-hidden max-w-[150px]"
              >
                <option value="">[Apresentador ({uniquePresentersList.length})]</option>
                {uniquePresentersList.map(pres => (
                  <option key={pres} value={pres}>{pres}</option>
                ))}
              </select>

              {/* Quem pratica o ato role selector */}
              <select
                value={timelineQuemPraticaFilter}
                onChange={(e) => setTimelineQuemPraticaFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg py-1 px-1.5 font-bold cursor-pointer text-[10px] focus:outline-hidden"
              >
                <option value="">[Quem pratica (Interveniente)]</option>
                <option value="juiz">Juiz</option>
                <option value="advogado">Advogado</option>
                <option value="procurador">Procurador</option>
                <option value="funcionario">Funcionário</option>
                <option value="autor">Autor</option>
                <option value="reu">Réu</option>
              </select>

              {/* Clear filters trigger */}
              {(docCategoryFilter || subjectAuthorFilter || timelineTipoAtoFilter || timelineDocIdFilter || timelineApresentadoPorFilter || timelineQuemPraticaFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setDocCategoryFilter('');
                    setSubjectAuthorFilter('');
                    setTimelineTipoAtoFilter('');
                    setTimelineDocIdFilter('');
                    setTimelineApresentadoPorFilter('');
                    setTimelineQuemPraticaFilter('');
                  }}
                  className="px-2 py-1 text-[9px] bg-red-50 text-red-650 border border-red-100 font-extrabold rounded hover:bg-red-100 cursor-pointer transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Main chronological acts */}
            <div className="space-y-5 border-l border-slate-150 pl-4 ml-1">
              {filteredTimelineItems.length > 0 ? (
                filteredTimelineItems.map((item, index) => {
                  if (item.type === 'ato') {
                    const act = item.data;
                    const matchedDocs = (processo.documentos || []).filter(d => 
                      !d.deleted && act.documentosIds && act.documentosIds.includes(d.id)
                    );
                    return (
                      <div key={'ato_' + act.id + index} className="relative group space-y-2.5 pb-2 border-b border-dashed border-slate-100">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-blue-500 bg-white group-hover:scale-110 transition-transform flex items-center justify-center">
                          <span className="h-1 w-1 rounded-full bg-blue-500"></span>
                        </span>
                        
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400">
                          <span>📅 {act.data}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-650 uppercase text-[8px] px-1.5 py-0.2 rounded font-sans tracking-wide">
                              {act.fase || 'Ato Judicial'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingAct(act)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold hover:underline cursor-pointer flex items-center gap-0.5 ml-2"
                              title="Corrigir erros ou alterar anexos deste ato"
                            >
                              ✏️ Corrigir Ato
                            </button>
                          </div>
                        </div>

                        <h4 className="text-xs font-black text-slate-950 group-hover:text-blue-700 transition-colors">
                          💼 {act.tipoAto}
                        </h4>

                        <p className="text-[11px] text-slate-600 leading-normal">
                          {act.descricao}
                        </p>

                        {(act.parteAssociada || act.advogadoPraticante) && (
                          <div className="text-[9.5px] bg-slate-50 border border-slate-100 rounded-xl p-1.5 flex flex-wrap gap-x-3 gap-y-1 text-slate-500 font-medium">
                            {act.parteAssociada && (
                              <span>👤 Parte: <b>{act.parteAssociada}</b></span>
                            )}
                            {act.advogadoPraticante && (
                              <span>🎓 Advogado: <b>{act.advogadoPraticante}</b></span>
                            )}
                          </div>
                        )}

                        {/* NESTED DOCUMENTS LIST */}
                        {matchedDocs.length > 0 && (
                          <div className="mt-2.5 pl-3 border-l-2 border-slate-150 space-y-1.5">
                            <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase block mb-1">
                              📂 Documentos Juntos ({matchedDocs.length})
                            </span>
                            <div className="grid grid-cols-1 gap-1.5">
                              {matchedDocs.map(doc => {
                                const isSelectedInView = activeDetailDoc?.id === doc.id;
                                return (
                                  <div 
                                    key={doc.id}
                                    onClick={() => handleOpenDocAction(doc)}
                                    className={`p-2 border rounded-xl flex items-center justify-between text-[11px] gap-2 hover:bg-slate-50 transition-colors cursor-pointer ${
                                      isSelectedInView 
                                        ? 'border-blue-300 bg-blue-50/30 font-medium' 
                                        : 'border-slate-150 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-900 truncate font-semibold hover:underline">
                                            {doc.nome}
                                          </span>
                                          <span className="text-[7.5px] font-bold bg-slate-100 text-slate-500 px-1 py-0.1 rounded font-sans uppercase shrink-0">
                                            {doc.categoria}
                                          </span>
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-mono">
                                          {doc.tamanho}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenDocAction(doc);
                                        }}
                                        className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 rounded text-[9.5px] font-bold cursor-pointer"
                                      >
                                        Ver
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingDoc(doc);
                                        }}
                                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-205 text-slate-700 rounded text-[9.5px] font-bold cursor-pointer"
                                        title="Corrigir metadados deste documento"
                                      >
                                        ✏️ Corrigir
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } else if (item.type === 'standalone_doc') {
                    const doc = item.data;
                    return (
                      <div key={'doc_' + doc.id + index} className="relative group space-y-1">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-emerald-500 bg-white group-hover:scale-110 transition-transform flex items-center justify-center">
                          <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                        </span>
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400">
                          <span>📅 {doc.dataApresentacao}</span>
                          <span className="bg-emerald-50 text-emerald-700 uppercase text-[8px] px-1.5 py-0.2 rounded font-sans tracking-wide">
                            Documento
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1">
                          📄 {doc.nome}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Apresentado por <strong>{doc.parteApresentante}</strong> (Praticado por: {doc.advogadoApresentante}).
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenDocAction(doc)}
                          className="mt-1 text-[10px] text-blue-600 hover:underline hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          Visualizar em Ecrã Dividido <span>→</span>
                        </button>
                      </div>
                    );
                  } else {
                    const notif = item.data;
                    return (
                      <div key={'notif_' + notif.id + index} className="relative group space-y-1">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-purple-500 bg-white group-hover:scale-110 transition-transform flex items-center justify-center">
                          <span className="h-1 w-1  rounded-full bg-purple-500"></span>
                        </span>
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400">
                          <span>📅 {notif.dataCriacao.substring(0, 10)}</span>
                          <span className="bg-purple-50 text-purple-700 uppercase text-[8px] px-1.5 py-0.2 rounded font-sans tracking-wide">
                            Notificação
                          </span>
                        </div>
                      </div>
                    );
                  }
                })
              ) : (
                <div />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 5 columns ratio, fixed, interactive tools container widget */}
        <div className="flex-1 lg:max-w-[45%] flex flex-col h-full bg-white border border-slate-205 rounded-3xl shadow-md overflow-hidden">
          {renderRightSplitColumn()}
        </div>
      </div>
    );
  };

  const standardHeaderContent = (
    <div className="space-y-6 font-sans">
      {processo.parentProcessoNumero && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-base">📌</span>
            <div>
              <p className="font-bold">Apenso / Processo Derivado</p>
              <p className="text-zinc-500 font-medium">Este processo corre por apenso ao Processo Principal nº <strong className="font-semibold text-zinc-800 select-all">{processo.parentProcessoNumero}</strong>.</p>
            </div>
          </div>
          {onSelectProcesso && (
            <button
              onClick={() => onSelectProcesso(processo.parentProcessoNumero!)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer transition-colors shrink-0 text-xs shadow-xs hover:shadow-md"
            >
              Ver Processo Principal →
            </button>
          )}
        </div>
      )}
      {/* Back & Breadcrumb Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 no-print shrink-0 pb-1 border-b border-zinc-100">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-3 hover:bg-zinc-900 hover:text-white rounded-xl border-2 border-zinc-900 bg-white text-zinc-900 shadow-md transition-all cursor-pointer font-bold text-sm tracking-wide group"
            title="Voltar ao Painel Principal"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Voltar ao Painel</span>
          </button>
          <div>
            <div className="flex items-center gap-2 pb-0.5">
              <span className="text-[10px] uppercase font-mono tracking-widest font-extrabold text-[#3a9cb1] bg-cyan-100/60 px-2 py-0.5 rounded">Autuação Judicial</span>
              <span className="text-[10px] bg-emerald-150-100 text-emerald-850 bg-emerald-100 font-extrabold px-2.5 py-0.5 rounded-full select-none uppercase tracking-wide">
                Ativo / Em Curso
              </span>
            </div>
            <h2 className="text-2xl font-black text-zinc-950 font-display tracking-tight">
              Processo Judicial nº {processo.numero}
            </h2>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          {currentUser?.role === 'administrador' && onDeleteProcesso && (
            <button
              onClick={() => {
                if (window.confirm(`Tem a certeza absoluta que deseja apagar o Processo ${processo.numero} e todos os seus ficheiros anexos do Disco C?`)) {
                  onDeleteProcesso(processo.numero);
                }
              }}
              className="px-4 py-3 text-xs font-black text-red-700 hover:text-white bg-red-50 hover:bg-red-700 border-2 border-red-200 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Trash2 className="h-4 w-4" />
              Apagar Processo
            </button>
          )}

          <button
            onClick={openUploadDrawer}
            className="px-6 py-3 text-sm font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl flex items-center gap-2 transition-all shadow-md hover:scale-[1.02] cursor-pointer font-display uppercase tracking-wider"
          >
            <Upload className="h-4.5 w-4.5" />
            Carregar Documento
          </button>
        </div>
      </div>

      {/* Case Sheet metadata Info - Interactive Collapsible Ficha */}
      {renderFichaProcesso()}

      {/* Gestão de Alarme e Fase do Processo Panel */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs text-xs no-print grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
        {/* Fase Atual Select */}
        <div className="space-y-1.5 bg-purple-50/40 border border-purple-250/50 rounded-xl p-3.5">
          <label className="block text-[10px] text-purple-900 font-bold uppercase tracking-wider flex items-center gap-1 font-display">
            🟣 Fase do Processo
          </label>
          <div className="flex gap-2">
            <select
              value={processo.faseAtual || getProcessAllowedPhases(processo)[0] || 'Instrução / Articulados'}
              onChange={(e) => {
                if (onUpdateProcesso) {
                  onUpdateProcesso({
                    ...processo,
                    faseAtual: e.target.value
                  });
                }
              }}
              className="flex-1 rounded-lg border border-purple-250 bg-white px-2.5 py-1.5 text-xs font-bold text-purple-950 focus:ring-2 focus:ring-purple-200 outline-hidden cursor-pointer"
            >
              {getProcessAllowedPhases(processo).map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <p className="text-[9.5px] text-purple-700 leading-tight">
            Indique em que etapa se encontra a causa para controlo na linha de tempo.
          </p>
        </div>

        {/* Alarm Config Panel */}
        <div className="md:col-span-2 bg-amber-50/40 border border-amber-250/50 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <span className="block text-[10px] text-amber-900 font-bold uppercase tracking-wider flex items-center gap-1 font-display">
              ⏰ Alarme de Agenda (Diligência / Prazo Limite)
            </span>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="alarmeAtivoCheckBox"
                  checked={processo.alarmeAtivo ?? false}
                  onChange={(e) => {
                    if (onUpdateProcesso) {
                      onUpdateProcesso({
                        ...processo,
                        alarmeAtivo: e.target.checked,
                        alarmeSilenciado: e.target.checked ? undefined : processo.alarmeSilenciado,
                        alarmeTipo: e.target.checked ? 'manual' : processo.alarmeTipo
                      });
                    }
                  }}
                  className="h-4 w-4 rounded border-amber-300 text-amber-900 focus:ring-amber-200 cursor-pointer"
                />
                <label htmlFor="alarmeAtivoCheckBox" className="text-xs font-bold text-amber-950 cursor-pointer select-none">
                  Alarme Ativo
                </label>
              </div>
              {processo.alarmeAtivo && (
                <div className="flex-1 flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="date"
                    value={processo.alarmeData || ''}
                    onChange={(e) => {
                      if (onUpdateProcesso) {
                        onUpdateProcesso({
                          ...processo,
                          alarmeData: e.target.value,
                          alarmeAtivo: true,
                          alarmeTipo: 'manual',
                          alarmeSilenciado: undefined
                        });
                      }
                    }}
                    className="rounded-xl border-2 border-amber-300 px-3.5 py-2.5 text-sm text-amber-950 bg-white font-mono font-bold focus:border-amber-500 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Descrição do prazo (ex: Prazo para contestação)"
                    value={processo.alarmeNota || ''}
                    onChange={(e) => {
                      if (onUpdateProcesso) {
                        onUpdateProcesso({
                          ...processo,
                          alarmeNota: e.target.value,
                          alarmeAtivo: true,
                          alarmeTipo: 'manual',
                          alarmeSilenciado: undefined
                        });
                      }
                    }}
                    className="flex-1 rounded-xl border-2 border-amber-300 px-3.5 py-2.5 text-sm font-bold text-amber-950 bg-white focus:border-amber-500 focus:outline-hidden placeholder-amber-700/60"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-amber-950 font-extrabold leading-relaxed">
              🔔 Na data alarmada, o processo aparecerá **automaticamente em elevado destaque** na página inicial do painel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubProcessTabs = () => {
    return (
      <>
        {/* Modern Pill Segment Controller bar */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 no-print relative w-fit shadow-3xs border border-zinc-200">
          <button
            type="button"
            onClick={() => setActiveTabSubProcess('timeline')}
            className={`py-2 px-4.5 text-xs font-bold transition-all rounded-xl flex items-center gap-2 cursor-pointer ${
              activeTabSubProcess === 'timeline'
                ? 'bg-white text-emerald-950 shadow-2xs font-extrabold border border-zinc-200'
                : 'text-slate-550 hover:text-slate-805 hover:bg-slate-50/70 border border-transparent'
            }`}
          >
            ⏱️ Linha Temporal & Histórico ({(processo.historicoAtos || []).length + processo.documentos.filter(d => !d.deleted).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabSubProcess('documentos')}
            className={`py-2 px-4.5 text-xs font-bold transition-all rounded-xl flex items-center gap-2 cursor-pointer ${
              activeTabSubProcess === 'documentos'
                ? 'bg-white text-blue-950 shadow-2xs font-extrabold border border-zinc-200'
                : 'text-slate-550 hover:text-slate-805 hover:bg-slate-50/70 border border-transparent'
            }`}
          >
            📂 Documentos Digitais ({processo.documentos.filter(d => !d.deleted).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabSubProcess('estado')}
            className={`py-2 px-4.5 text-xs font-bold transition-all rounded-xl flex items-center gap-2 cursor-pointer ${
              activeTabSubProcess === 'estado'
                ? 'bg-white text-indigo-950 shadow-2xs font-extrabold border border-zinc-200'
                : 'text-slate-550 hover:text-slate-805 hover:bg-slate-50/70 border border-transparent'
            }`}
          >
            🔄 Estado ({processo.historicoEstados?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabSubProcess('apensos')}
            className={`py-2 px-4.5 text-xs font-bold transition-all rounded-xl flex items-center gap-2 cursor-pointer ${
              activeTabSubProcess === 'apensos'
                ? 'bg-white text-purple-950 shadow-2xs font-extrabold border border-zinc-200'
                : 'text-slate-550 hover:text-slate-805 hover:bg-slate-50/70 border border-transparent'
            }`}
          >
            🔗 Apensos ({apensosList.length})
          </button>
        </div>

      {activeTabSubProcess === 'documentos' && (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs mt-3">
          {/* Document Actions Header */}
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="selectAll"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 cursor-pointer"
                />
                <label htmlFor="selectAll" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                  Selecionar Todos ({processo.documentos.filter(d => !d.deleted).length})
                </label>
              </div>

              <div className="flex items-center gap-2 sm:border-l sm:border-zinc-250 sm:pl-4">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Alt. Cronologia:</span>
                <select
                  value={docSortOrder}
                  onChange={(e) => setDocSortOrder(e.target.value as 'asc' | 'desc')}
                  className="rounded-lg border border-zinc-250 bg-white px-2.5 py-1 text-xs font-bold text-zinc-700 focus:ring-2 focus:ring-blue-105 outline-hidden hover:border-zinc-400 transition-colors cursor-pointer"
                >
                  <option value="asc">Mais Antigo ➔ Mais Recente</option>
                  <option value="desc">Mais Recente ➔ Mais Antigo</option>
                </select>
              </div>
            </div>

            {/* Download Operations */}
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadSelected}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-150 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descarregar Selecionados ({selectedCount})
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadAll}
                className="px-3 py-1.5 text-zinc-700 hover:text-zinc-950 bg-white hover:bg-zinc-50 border border-zinc-250 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-zinc-450" />
                Descarregar Todos (Vários)
              </button>
            </div>
          </div>

          {/* Documents list */}
          <div className="divide-y divide-zinc-100">
            {processo.documentos.filter(d => !d.deleted).length > 0 ? (
              [...processo.documentos].filter(d => !d.deleted).sort((a, b) => {
                const dateA = new Date(a.dataApresentacao).getTime();
                const dateB = new Date(b.dataApresentacao).getTime();
                return docSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
              }).map((doc) => {
                const checked = !!selectedDocIds[doc.id];
                return (
                  <div 
                    key={doc.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-zinc-50/50 transition-all ${
                      checked ? 'bg-zinc-50/60' : ''
                    }`}
                  >
                    {/* File Metadata Col */}
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleSelect(doc.id)}
                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950 cursor-pointer shrink-0"
                      />
                      
                      <div className="p-2 bg-zinc-100 border border-zinc-200 text-zinc-600 rounded-lg shrink-0">
                        <FileIcon className="h-4.5 w-4.5 stroke-[1.5]" />
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                           <span 
                            onClick={() => handleOpenDocAction(doc)}
                            className="text-xs font-semibold text-zinc-900 cursor-pointer hover:text-blue-700 hover:underline truncate"
                          >
                            {doc.nome}
                          </span>
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/50 uppercase select-none">
                            {doc.categoria}
                          </span>
                        </div>

                        {/* Doc sub details */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-[10px] text-zinc-500">
                          <span>Apresentado por: <strong className="text-zinc-700">{doc.parteApresentante}</strong></span>
                          <span className="text-zinc-300">•</span>
                          <span>Quem pratica o ato: <strong className="text-zinc-700">{doc.advogadoApresentante}</strong></span>
                          <span className="text-zinc-300">•</span>
                          <span className="font-mono">Tamanho: {doc.tamanho}</span>
                          <span className="text-zinc-300">•</span>
                          <span>Sancionado: {doc.dataApresentacao}</span>
                        </div>

                        {/* Doc resumo (summary) box inside details card */}
                        {doc.resumo && (
                          <div className="mt-2 text-[10.5px] text-zinc-700 bg-amber-50/40 border border-amber-150 p-2.5 rounded-lg flex gap-1.5 items-start max-w-xl leading-relaxed">
                            <span className="text-amber-600 shrink-0 select-none text-xs">📝</span>
                            <div className="min-w-0">
                              <span className="font-bold text-[9px] uppercase tracking-wider text-amber-700 block mb-0.5 font-display">Resumo de Análise</span>
                              {doc.resumo}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Trigger Panel */}
                    <div className="flex items-center gap-1.5 justify-end pl-7 sm:pl-0 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenDocAction(doc)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        title="Visualizar documento"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ver</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrintFile(doc)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        title="Imprimir documento"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Imprimir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadFile(doc)}
                        className="p-1.5 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        title="Descarregar ficheiro"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDoc(doc)}
                        className="p-1.5 text-zinc-500 hover:text-amber-700 hover:bg-amber-55/40 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        title="Editar metadados"
                      >
                        <Edit className="h-3.5 w-3.5 text-amber-500" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocumento(doc.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px]"
                        title="Eliminar / Arquivar documento"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-zinc-400 bg-zinc-50/30">
                <FileIcon className="h-8 w-8 mx-auto mb-2 stroke-[1] text-zinc-300" />
                <p className="text-xs">Este processo ainda não tem documentos anexados.</p>
                <button
                  type="button"
                  onClick={openUploadDrawer}
                  className="mt-2 text-xs font-medium text-zinc-900 underline hover:text-zinc-700 cursor-pointer"
                >
                  Adicionar primeiro documento
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTabSubProcess === 'timeline' && (
        <div className="space-y-6">
          {/* Header Action Strip */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-purple-600" />
                Histórico de Causa & Timeline de Documentações
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                Visualize os eventos processuais, os atos registados e todos os documentos juntos de forma cronológica unificada.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Sort Order Selector */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-zinc-205 shadow-3xs">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ordenação:</span>
                <select
                  value={docSortOrder}
                  onChange={(e) => setDocSortOrder(e.target.value as 'asc' | 'desc')}
                  className="bg-transparent border-0 p-0 text-xs font-bold text-zinc-700 focus:ring-0 outline-hidden cursor-pointer"
                >
                  <option value="desc">Mais Recente ➔ Antigo</option>
                  <option value="asc">Mais Antigo ➔ Recente</option>
                </select>
              </div>

              {!showCreateActForm && (
                <button
                  type="button"
                  onClick={() => {
                    setActDescription('');
                    setSelectedDocsForAct({});
                    setActDate(getLocalTodayString());
                    setShowCreateActForm(true);
                  }}
                  className="px-5 py-3 bg-purple-700 hover:bg-purple-800 text-white font-black rounded-xl text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <Plus className="h-5 w-5" />
                  Registar Novo Ato / Ocorrência
                </button>
              )}
            </div>
          </div>

          {/* Form to Registrate Timeline Act */}
          {showCreateActForm && (
            <div className="bg-purple-50/70 border-2 border-purple-250 rounded-2xl p-6.5 animate-in slide-in-from-top duration-200 space-y-5">
              <div className="flex justify-between items-center pb-2.5 border-b border-purple-200">
                <h5 className="text-sm font-black text-purple-950 uppercase tracking-widest flex items-center gap-2">
                  📝 Registar Novo Ato Judiciário ou Evento no Processo
                </h5>
                <button
                  type="button"
                  onClick={() => setShowCreateActForm(false)}
                  className="text-xs text-purple-700 hover:text-purple-950 font-black hover:underline cursor-pointer uppercase tracking-wider"
                >
                  Cancelar / Fechar [X]
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-[10.5px] text-zinc-700 font-extrabold uppercase tracking-wider mb-1.5">Data de Realização o Ocorrência *</label>
                  <input
                    type="date"
                    value={actDate}
                    onChange={(e) => setActDate(e.target.value)}
                    required
                    className="block w-full text-sm rounded-xl border-2 border-slate-250 px-3.5 py-2.5 text-zinc-900 bg-white font-mono focus:border-purple-650 focus:ring-0 focus:outline-hidden font-bold"
                  />
                </div>

                {/* Event Type */}
                <div className="relative">
                  <label className="block text-[10.5px] text-zinc-700 font-extrabold uppercase tracking-wider mb-1.5">Tipo de Evento judicial *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={actType}
                      onChange={(e) => {
                        setActType(e.target.value);
                        setIsActTypeDropdownOpen(true);
                      }}
                      onFocus={() => setIsActTypeDropdownOpen(true)}
                      placeholder="Comece a escrever para filtrar..."
                      className="block w-full text-sm rounded-xl border-2 border-slate-250 px-3.5 py-2.5 pr-10 text-zinc-900 bg-white focus:border-purple-650 focus:ring-0 focus:outline-hidden font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setIsActTypeDropdownOpen(!isActTypeDropdownOpen)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    >
                      <svg className={`h-4 w-4 transform transition-transform duration-200 ${isActTypeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {isActTypeDropdownOpen && (
                    <>
                      {/* Clicking outside closes the dropdown list */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsActTypeDropdownOpen(false)} 
                      />
                      <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto bg-white border-2 border-slate-205 rounded-xl shadow-xl divide-y divide-slate-105">
                        {getProcessAllowedActs(processo)
                          .filter((classification) =>
                            classification.toLowerCase().includes(actType.toLowerCase())
                          )
                          .map((classification) => (
                            <div
                              key={classification}
                              onClick={() => {
                                setActType(classification);
                                setIsActTypeDropdownOpen(false);
                              }}
                              className="px-4 py-2.5 text-sm text-zinc-850 hover:bg-purple-50 hover:text-purple-900 cursor-pointer font-bold transition-colors"
                            >
                              {classification}
                            </div>
                          ))}
                        {getProcessAllowedActs(processo).filter((classification) =>
                          classification.toLowerCase().includes(actType.toLowerCase())
                        ).length === 0 && (
                          <div className="px-4 py-3 text-xs text-zinc-400 font-medium bg-slate-50 italic">
                            Nenhum tipo de evento correspondente encontrado. Pode usar estoutro tipo.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Fase */}
                <div>
                  <label className="block text-[10.5px] text-zinc-700 font-extrabold uppercase tracking-wider mb-1.5">Fase correspondente ao Ato *</label>
                  <select
                    value={actFaseStr}
                    onChange={(e) => setActFaseStr(e.target.value)}
                    className="block w-full text-sm rounded-xl border-2 border-slate-250 px-3.5 py-2.5 text-zinc-900 bg-white focus:border-purple-650 focus:ring-0 focus:outline-hidden cursor-pointer font-bold"
                  >
                    {getProcessAllowedPhases(processo).map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Presenting Party/Lawyer Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10.5px] text-zinc-700 font-extrabold uppercase tracking-wider mb-1.5">Parte Apresentante (Se aplicável)</label>
                  <select
                    value={parteApresentante}
                    onChange={(e) => setParteApresentante(e.target.value)}
                    className="block w-full text-sm rounded-xl border-2 border-slate-250 px-3.5 py-2.5 text-zinc-905 bg-white focus:border-purple-650 focus:ring-0 focus:outline-hidden font-bold"
                  >
                    {partesDisponiveis.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] text-zinc-700 font-extrabold uppercase tracking-wider mb-1.5">Quem pratica o ato (Se aplicável)</label>
                  <select
                    value={advogadoApresentante}
                    onChange={(e) => setAdvogadoApresentante(e.target.value)}
                    className="block w-full text-sm rounded-xl border-2 border-slate-250 px-3.5 py-2.5 text-zinc-905 bg-white focus:border-purple-650 focus:ring-0 focus:outline-hidden font-bold"
                  >
                    {advogadosDisponiveis.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10.5px] text-zinc-700 font-extrabold uppercase tracking-wider mb-1.5">Descrição detalhada do Ato Judiciário *</label>
                <textarea
                  required
                  rows={4}
                  value={actDescription}
                  onChange={(e) => setActDescription(e.target.value)}
                  placeholder="ex: Petição Inicial apresentada eletronicamente pelo Mandatário do Autor no processo principal..."
                  className="block w-full text-sm rounded-xl border-2 border-slate-250 p-4 text-zinc-900 bg-white focus:border-purple-650 focus:ring-0 focus:outline-hidden font-medium"
                />
              </div>

              {/* New Documents Dynamic Sub-Form */}
              <div className="bg-white border border-purple-100 rounded-xl p-3.5 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                  <span className="block text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    📎 Novos Documentos Anexos (A Submeter com o Ato)
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      multiple
                      id="bulk-act-files"
                      className="hidden"
                      onChange={handleBulkActFilesUpload}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('bulk-act-files')?.click();
                      }}
                      className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 font-black rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Upload className="h-3 w-3" />
                      Procurar Ficheiro do PC
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewActFiles(prev => [
                          ...prev,
                          {
                            tempId: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                            nome: 'Documento de Prova',
                            categoria: 'Documento de Prova',
                            conteudoTexto: ''
                          }
                        ]);
                      }}
                      className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <Plus className="h-3 w-3" />
                      Criar Slot Vazio
                    </button>
                  </div>
                </div>

                {newActFiles.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic">
                    Nenhum documento anexo criado ainda. Clique no botão acima para carregar do seu PC ou criar slots vazios para anexar à peça processual.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {newActFiles.map((file, idx) => (
                      <div key={file.tempId} className="p-3 bg-zinc-50 rounded-xl border border-zinc-150 space-y-2.5 relative animate-in fade-in duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setNewActFiles(prev => prev.filter(f => f.tempId !== file.tempId));
                          }}
                          className="absolute right-2 top-2 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover documento"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* Categoria/Tipo */}
                          <div>
                            <label className="block text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Tipo / Categoria de Peça</label>
                            <select
                              value={file.categoria}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewActFiles(prev => prev.map(f => f.tempId === file.tempId ? { ...f, categoria: val, nome: val } : f));
                              }}
                              className="block w-full text-xs rounded-lg border border-zinc-250 px-2.5 py-1.5 text-zinc-900 bg-white focus:outline-hidden cursor-pointer"
                            >
                              <option value="Petição Inicial">Petição Inicial</option>
                              <option value="Contestação">Contestação</option>
                              <option value="Requerimento">Requerimento</option>
                              <option value="Alegações de Recurso">Alegações de Recurso</option>
                              <option value="Contra-alegações">Contra-alegações</option>
                              <option value="Documento de Prova">Documento de Prova (Anexo)</option>
                              <option value="Documento de Identificação">Documento de Identificação</option>
                              <option value="Taxa de Justiça">Comprovativo de Taxa de Justiça</option>
                              <option value="Procuração">Procuração Forense</option>
                              <option value="Parecer Técnico">Parecer Técnico / Peritagem</option>
                              <option value="Outro">Outro Documento de Apoio</option>
                            </select>
                          </div>

                          {/* PC File Selector Dropzone inside each card */}
                          <div>
                            <label className="block text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Associar Ficheiro Físico</label>
                            <div className="border border-dashed border-zinc-300 hover:border-purple-300 rounded-lg p-1.5 text-center bg-white cursor-pointer relative group flex items-center justify-center gap-2">
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  const picked = e.target.files?.[0];
                                  if (picked) {
                                    const sizeKb = (picked.size / 1024).toFixed(1);
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const dataUrl = event.target?.result as string || '';
                                      const intro = `[Ficheiro real importado: ${picked.name} - ${sizeKb} KB]\n\n`;
                                      const body = `CONTEÚDO DIGITAL SECURE - Este ficheiro (${picked.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente no arquivo digital do processo.`;
                                      
                                      let guessedCategory = file.categoria;
                                      const nameLower = picked.name.toLowerCase();
                                      if (nameLower.includes('peticao') || nameLower.includes('peticão') || nameLower.includes('pi')) guessedCategory = 'Petição Inicial';
                                      else if (nameLower.includes('contestacao') || nameLower.includes('contestação')) guessedCategory = 'Contestação';
                                      else if (nameLower.includes('requerimento')) guessedCategory = 'Requerimento';
                                      else if (nameLower.includes('procuracao') || nameLower.includes('procuração')) guessedCategory = 'Procuração';
                                      else if (nameLower.includes('taxa') || nameLower.includes('custas') || nameLower.includes('pagamento')) guessedCategory = 'Taxa de Justiça';
                                      else if (nameLower.includes('identificacao') || nameLower.includes('id') || nameLower.includes('cc')) guessedCategory = 'Documento de Identificação';

                                      setNewActFiles(prev => prev.map(f => f.tempId === file.tempId ? {
                                        ...f,
                                        nome: picked.name,
                                        categoria: guessedCategory,
                                        conteudoTexto: intro + body,
                                        conteudoUrl: dataUrl
                                      } : f));
                                    };
                                    reader.readAsDataURL(picked);
                                  }
                                }}
                              />
                              <Upload className="h-3.5 w-3.5 text-zinc-400 group-hover:text-purple-600 transition-colors" />
                              <span className="text-[10px] font-bold text-zinc-600 truncate max-w-[180px]">
                                {file.nome !== 'Documento de Prova' ? file.nome : 'Procurar do Computador'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Conteudo */}
                        <div>
                          <label className="block text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Conteúdo / Texto Simulado do Ficheiro *</label>
                          <textarea
                            value={file.conteudoTexto}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewActFiles(prev => prev.map(f => f.tempId === file.tempId ? { ...f, conteudoTexto: val } : f));
                            }}
                            rows={1.5}
                            required
                            placeholder="Escreva o resumo, teor ou texto integral da peça processual para que este possa ser visualizado e lido na consulta de documentos..."
                            className="block w-full text-xs rounded-lg border border-zinc-250 p-2 text-zinc-900 bg-white focus:outline-hidden"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bind existing documents checklist */}
              {processo.documentos.length > 0 && (
                <div className="bg-white border border-purple-100 rounded-xl p-3.5 space-y-2">
                  <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    🔗 Ou Vincular Documentos Existentes do Histórico ({processo.documentos.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1">
                    {processo.documentos.map((doc) => (
                      <label key={doc.id} className="flex items-center gap-2 p-2 bg-zinc-50 hover:bg-purple-50/40 border border-zinc-150 rounded-lg text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!selectedDocsForAct[doc.id]}
                          onChange={(e) => {
                            setSelectedDocsForAct(prev => ({
                              ...prev,
                              [doc.id]: e.target.checked
                            }));
                          }}
                          className="h-3.5 w-3.5 rounded text-purple-650 border-zinc-300 focus:ring-purple-200 focus:ring-opacity-50"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-850 truncate text-[11px]">
                            {doc.nome}
                          </p>
                          <p className="text-[9px] text-zinc-400">
                            {doc.categoria} • {doc.dataApresentacao}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-purple-200/80">
                <button
                  type="button"
                  onClick={() => setShowCreateActForm(false)}
                  className="px-4.5 py-2.5 bg-zinc-200 hover:bg-zinc-350 text-zinc-800 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-3xs transition-all active:scale-95"
                >
                  <X className="h-4 w-4" />
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSaveActWithAttachedDocuments}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-95 border-b-2 border-emerald-800"
                >
                  <Check className="h-4.5 w-4.5" />
                  Gravar Peça Processual e Anexos
                </button>
              </div>
            </div>
          )}

          {/* Unified Timeline Lists (Merge acts, standalone docs & notifications) */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-6">
            {(() => {
              const acts = processo.historicoAtos || [];
              const docIdsLinkedToActs = new Set<string>();
              acts.forEach(a => {
                if (a.documentosIds) {
                  a.documentosIds.forEach(id => docIdsLinkedToActs.add(id));
                }
              });

              // Standalone documents (not nested in any act, and not deleted)
              const standaloneDocs = processo.documentos.filter(d => !d.deleted && !docIdsLinkedToActs.has(d.id) && !d.isAnexoDoc && !d.parentDocId);

              // Combine together for chronological timeline render
              const timelineItems: Array<
                | { type: 'ato'; date: string; data: typeof acts[number] }
                | { type: 'standalone_doc'; date: string; data: typeof standaloneDocs[number] }
                | { type: 'notificacao'; date: string; data: ProcessNotificacao }
              > = [];

              acts.forEach(a => {
                timelineItems.push({ type: 'ato', date: a.data, data: a });
              });

              standaloneDocs.forEach(d => {
                timelineItems.push({ type: 'standalone_doc', date: d.dataApresentacao, data: d });
              });

              notificacoesList.filter(n => !n.deleted).forEach(n => {
                const dateOnly = n.dataCriacao.substring(0, 10);
                timelineItems.push({ type: 'notificacao', date: dateOnly, data: n });
              });

              const filteredTimelineItems = timelineItems.filter(item => matchesFilters(item));

              // Sort based on sort order
              // Helper to resolve precise creation time for tie breaking
              const getCreationTime = (item: any): string => {
                if (item.type === 'ato') {
                  const act = item.data;
                  if (act.createdAt) return act.createdAt;
                  const match = act.id.match(/act-(\d+)/);
                  if (match) return new Date(parseInt(match[1])).toISOString();
                  const seedMatch = act.id.match(/seed-a-(\d+)/);
                  if (seedMatch) {
                    return `${act.data}T00:00:${seedMatch[1].padStart(2, '0')}Z`;
                  }
                  return `${act.data}T00:00:00Z`;
                }
                if (item.type === 'standalone_doc') {
                  const doc = item.data;
                  if (doc.createdAt) return doc.createdAt;
                  const match = doc.id.match(/doc-(\d+)/);
                  if (match) return new Date(parseInt(match[1])).toISOString();
                  const seedMatch = doc.id.match(/seed-d-(\d+)/);
                  if (seedMatch) {
                    return `${doc.dataApresentacao}T00:00:${seedMatch[1].padStart(2, '0')}Z`;
                  }
                  return `${doc.dataApresentacao}T00:00:00Z`;
                }
                if (item.type === 'notificacao') {
                  const notif = item.data;
                  if (notif.dataCriacao) return notif.dataCriacao;
                  return '2026-01-01T00:00:00Z';
                }
                return '2026-01-01T00:00:00Z';
              };

              filteredTimelineItems.sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) {
                  return docSortOrder === 'asc' ? dateCompare : -dateCompare;
                }
                
                // Tie-breaker: same date, use creation / presentation timestamp
                const timeA = getCreationTime(a);
                const timeB = getCreationTime(b);
                const timeCompare = timeA.localeCompare(timeB);
                if (timeCompare !== 0) {
                  return docSortOrder === 'asc' ? timeCompare : -timeCompare;
                }

                // fallback tie breaker: acts first
                if (a.type !== b.type) {
                  if (a.type === 'ato') return -1;
                  if (b.type === 'ato') return 1;
                  return a.type === 'standalone_doc' ? -1 : 1;
                }
                return 0;
              });

              // Find available categories and subject roles in process for choice options
              const uniqueCategories = Array.from(
                new Set(
                  processo.documentos
                    .filter(d => !d.deleted)
                    .map(d => d.categoria)
                    .filter(Boolean)
                )
              );
              // Add option for notifications category if notifications exist
              if (notificacoesList.filter(n => !n.deleted).length > 0) {
                if (!uniqueCategories.includes('Notificações / Diligências')) {
                  uniqueCategories.push('Notificações / Diligências');
                }
              }

              const subjectsInProcess: string[] = ['Juiz'];
              if (processo.advogadosAutor?.length > 0 || processo.advogadosReu?.length > 0) {
                subjectsInProcess.push('Advogado');
              }
              if (processo.procuradores && processo.procuradores.length > 0) {
                subjectsInProcess.push('Procurador');
              }

              const uniqueTiposAto = Array.from(
                new Set([
                  ...(processo.historicoAtos || []).map(a => a.tipoAto).filter(Boolean),
                  ...processo.documentos.filter(d => !d.deleted).map(d => d.categoria).filter(Boolean)
                ])
              );

              const activeDocsList = processo.documentos.filter(d => !d.deleted);

              const uniquePresentersList = Array.from(
                new Set([
                  ...processo.documentos.filter(d => !d.deleted).map(d => d.parteApresentante).filter(Boolean),
                  ...(processo.historicoAtos || []).map(a => a.parteAssociada).filter(Boolean)
                ])
              );

              return (
                <div className="space-y-4 font-sans">
                  {/* Filters Header Strip */}
                  <div className="bg-slate-50 hover:bg-slate-100/60 border-2 border-slate-250 rounded-2xl p-5 space-y-3.5 no-print shadow-xs transition-colors duration-200">
                    <div 
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    >
                      <div className="text-xs font-black text-slate-700 uppercase tracking-widest leading-none flex items-center gap-2 hover:text-emerald-800 transition-colors">
                        <span>🔍 Filtrar Histórico / Peças por:</span>
                        <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${isFiltersExpanded ? 'rotate-180' : ''}`} />
                        {!(docCategoryFilter || subjectAuthorFilter || timelineTipoAtoFilter || timelineDocIdFilter || timelineApresentadoPorFilter || timelineQuemPraticaFilter || timelineClassificationFilter !== 'all' || timelineFavoritosFilter) && !isFiltersExpanded && (
                          <span className="text-[9px] bg-slate-200 text-slate-650 px-2 py-0.5 rounded ml-1 font-sans uppercase font-extrabold">Oculto</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                        {(docCategoryFilter || subjectAuthorFilter || timelineTipoAtoFilter || timelineDocIdFilter || timelineApresentadoPorFilter || timelineQuemPraticaFilter || timelineClassificationFilter !== 'all' || timelineFavoritosFilter) && (
                          <button
                            type="button"
                            onClick={() => {
                              setDocCategoryFilter('');
                              setSubjectAuthorFilter('');
                              setTimelineTipoAtoFilter('');
                              setTimelineDocIdFilter('');
                              setTimelineApresentadoPorFilter('');
                              setTimelineQuemPraticaFilter('');
                              setTimelineClassificationFilter('all');
                              setTimelineFavoritosFilter(false);
                            }}
                            className="px-3.5 py-1.5 text-xs bg-red-100 hover:bg-red-250 hover:text-red-800 text-red-700 font-black rounded-xl cursor-pointer transition-all border border-red-250 shadow-3xs"
                          >
                            Repor Todos os Filtros
                          </button>
                        )}
                        {!isFiltersExpanded && (
                          <span className="text-xs text-cyan-850 font-black bg-cyan-100/80 px-3 py-1.5 rounded-xl hover:bg-cyan-200 transition-colors shadow-3xs">
                            ⚙️ Abrir Filtros
                          </span>
                        )}
                      </div>
                    </div>

                    {isFiltersExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {/* Filter by Category */}
                      <div className="flex flex-col gap-2 bg-white p-3 py-2.5 rounded-2xl border-2 border-slate-200 shadow-3xs focus-within:border-[#3a9cb1] hover:border-zinc-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Categoria Doc.:</span>
                        <select
                          value={docCategoryFilter}
                          onChange={(e) => setDocCategoryFilter(e.target.value)}
                          className="bg-transparent border-0 p-0 text-sm font-black text-zinc-900 focus:ring-0 outline-hidden cursor-pointer"
                        >
                          <option value="">[Ver todas as categorias ({uniqueCategories.length})]</option>
                          {uniqueCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter by Subject Role */}
                      <div className="flex flex-col gap-2 bg-white p-3 py-2.5 rounded-2xl border-2 border-slate-200 shadow-3xs focus-within:border-[#3a9cb1] hover:border-zinc-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Sujeito Autoria:</span>
                        <select
                          value={subjectAuthorFilter}
                          onChange={(e) => setSubjectAuthorFilter(e.target.value)}
                          className="bg-transparent border-0 p-0 text-sm font-black text-zinc-900 focus:ring-0 outline-hidden cursor-pointer"
                        >
                          <option value="">[Ver todas as autorias]</option>
                          <option value="Juiz">Mmo. Juiz ({processo.juizTitular || 'Titular'})</option>
                          {subjectsInProcess.includes('Advogado') && (
                            <option value="Advogado">Advogado (Mandatários)</option>
                          )}
                          {subjectsInProcess.includes('Procurador') && (
                            <option value="Procurador">Procurador (Instâncias)</option>
                          )}
                        </select>
                      </div>

                      {/* Filter by Tipo de Ato */}
                      <div className="flex flex-col gap-2 bg-white p-3 py-2.5 rounded-2xl border-2 border-slate-200 shadow-3xs focus-within:border-[#3a9cb1] hover:border-zinc-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tipo de Ato:</span>
                        <select
                          value={timelineTipoAtoFilter}
                          onChange={(e) => setTimelineTipoAtoFilter(e.target.value)}
                          className="bg-transparent border-0 p-0 text-sm font-black text-zinc-900 focus:ring-0 outline-hidden cursor-pointer"
                        >
                          <option value="">[Selecionar Tipo de Ato ({uniqueTiposAto.length})]</option>
                          {uniqueTiposAto.map(tipo => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter by Documento */}
                      <div className="flex flex-col gap-2 bg-white p-3 py-2.5 rounded-2xl border-2 border-slate-200 shadow-3xs focus-within:border-[#3a9cb1] hover:border-zinc-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Documento Específico:</span>
                        <select
                          value={timelineDocIdFilter}
                          onChange={(e) => setTimelineDocIdFilter(e.target.value)}
                          className="bg-transparent border-0 p-0 text-sm font-black text-zinc-900 focus:ring-0 outline-hidden cursor-pointer"
                        >
                          <option value="">[Selecionar Documento ({activeDocsList.length})]</option>
                          {activeDocsList.map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.nome} ({doc.categoria})</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter by Apresentado Por */}
                      <div className="flex flex-col gap-2 bg-white p-3 py-2.5 rounded-2xl border-2 border-slate-200 shadow-3xs focus-within:border-[#3a9cb1] hover:border-zinc-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Apresentado por:</span>
                        <select
                          value={timelineApresentadoPorFilter}
                          onChange={(e) => setTimelineApresentadoPorFilter(e.target.value)}
                          className="bg-transparent border-0 p-0 text-sm font-black text-zinc-900 focus:ring-0 outline-hidden cursor-pointer justify-between inline-block"
                        >
                          <option value="">[Selecionar Apresentante ({uniquePresentersList.length})]</option>
                          {uniquePresentersList.map(pres => (
                            <option key={pres} value={pres}>{pres}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter by Quem Pratica o Ato */}
                      <div className="flex flex-col gap-2 bg-white p-3 py-2.5 rounded-2xl border-2 border-slate-200 shadow-3xs focus-within:border-[#3a9cb1] hover:border-zinc-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Quem pratica no Processo:</span>
                        <select
                          value={timelineQuemPraticaFilter}
                          onChange={(e) => setTimelineQuemPraticaFilter(e.target.value)}
                          className="bg-transparent border-0 p-0 text-sm font-black text-zinc-900 focus:ring-0 outline-hidden cursor-pointer"
                        >
                          <option value="">[Qualquer interveniente]</option>
                          <option value="juiz">Juiz</option>
                          <option value="advogado">Advogado</option>
                          <option value="procurador">Procurador</option>
                          <option value="funcionario">Funcionário</option>
                          <option value="autor">Autor</option>
                          <option value="reu">Réu</option>
                        </select>
                      </div>

                      {/* Filter by Favoritos */}
                      <div className="flex flex-col gap-2 bg-white p-3 py-2.5 rounded-2xl border-2 border-slate-200 shadow-3xs focus-within:border-[#3a9cb1] hover:border-zinc-350 transition-colors">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-sans">Critério de Favoritos:</span>
                        <select
                          value={timelineFavoritosFilter ? 'sim' : 'nao'}
                          onChange={(e) => setTimelineFavoritosFilter(e.target.value === 'sim')}
                          className="bg-transparent border-0 p-0 text-sm font-black text-zinc-900 focus:ring-0 outline-hidden cursor-pointer"
                        >
                          <option value="nao">[Qualquer registo]</option>
                          <option value="sim">⭐ Apenas Favoritos</option>
                        </select>
                      </div>
                    </div>
                    )}

                    {/* Visual Segmented Tabs to Distinguish Atos and Standalone Documents */}
                    <div className="flex flex-col sm:flex-row justify-between items-center pt-3.5 border-t border-slate-200 gap-3">
                      <div className="text-xs text-slate-650 font-extrabold flex items-center gap-1.5 uppercase tracking-wide">
                        <span>🏷️ Distinguir Registos do Processo:</span>
                      </div>
                      <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 shrink-0 flex-wrap border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setTimelineClassificationFilter('all')}
                          className={`px-4.5 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-xs ${
                            timelineClassificationFilter === 'all' && !timelineFavoritosFilter
                              ? 'bg-white border text-zinc-950 shadow-sm border-zinc-300'
                              : 'text-zinc-650 hover:text-zinc-950 hover:bg-white/70'
                          }`}
                        >
                          🌐 Ver Todos ({timelineItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTimelineClassificationFilter('atos');
                            setTimelineFavoritosFilter(false);
                          }}
                          className={`px-4.5 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-xs ${
                            timelineClassificationFilter === 'atos' && !timelineFavoritosFilter
                              ? 'bg-purple-700 text-white shadow-md border border-purple-800'
                              : 'text-purple-750 hover:text-purple-950 hover:bg-purple-50/70'
                          }`}
                        >
                          ⚖️ Apenas Atos ({acts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTimelineClassificationFilter('documentos_avulsos');
                            setTimelineFavoritosFilter(false);
                          }}
                          className={`px-4.5 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-xs ${
                            timelineClassificationFilter === 'documentos_avulsos' && !timelineFavoritosFilter
                              ? 'bg-blue-600 text-white shadow-md border border-blue-700'
                              : 'text-blue-750 hover:text-blue-950 hover:bg-blue-50/70'
                          }`}
                        >
                          📂 Apenas Docs Avulsos ({standaloneDocs.length + notificacoesList.filter(n => !n.deleted).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTimelineFavoritosFilter(!timelineFavoritosFilter);
                          }}
                          className={`px-4.5 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-xs ${
                            timelineFavoritosFilter
                              ? 'bg-amber-500 text-white shadow-md border border-amber-600 font-black'
                              : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50/70'
                          }`}
                        >
                          ⭐ Favoritos ({Object.values(starredTimelineItems).filter(Boolean).length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bulk Operations and PDF Compiler Action Bar */}
                  {(() => {
                    const handleSelectAllFavorites = () => {
                      const updated = { ...selectedTimelineItemIds };
                      filteredTimelineItems.forEach(item => {
                        const itemId = item.data.id;
                        if (starredTimelineItems[itemId]) {
                          updated[itemId] = true;
                        }
                      });
                      setSelectedTimelineItemIds(updated);
                    };

                    const handleDownloadOriginalFiles = () => {
                      const selectedItems = timelineItems.filter(item => !!selectedTimelineItemIds[item.data.id]);
                      const docsToDownload: Documento[] = [];

                      selectedItems.forEach(item => {
                        if (item.type === 'standalone_doc') {
                          docsToDownload.push(item.data);
                        } else if (item.type === 'ato') {
                          const act = item.data;
                          const linkedDocs = processo.documentos.filter(d => 
                            !d.deleted && act.documentosIds && act.documentosIds.includes(d.id)
                          );
                          linkedDocs.forEach(d => docsToDownload.push(d));
                        } else if (item.type === 'notificacao') {
                          const linkedDocs = processo.documentos.filter(d => 
                            !d.deleted && d.notificacaoId === item.data.id
                          );
                          linkedDocs.forEach(d => docsToDownload.push(d));
                        }
                      });

                      // De-duplicate
                      const uniqueDocsMap = new Map<string, Documento>();
                      docsToDownload.forEach(d => {
                        uniqueDocsMap.set(d.id, d);
                      });

                      const finalDocs = Array.from(uniqueDocsMap.values());
                      const docsWithFiles = finalDocs.filter(d => d.conteudoUrl);

                      if (docsWithFiles.length === 0) {
                        alert('Nenhum dos registos selecionados possui ficheiros anexados (PDF ou Imagens). Pode gerir o conteúdo no split-view ou usar a opção "Baixar Compilação PDF".');
                        return;
                      }

                      docsWithFiles.forEach((doc, idx) => {
                        setTimeout(() => {
                          const link = document.createElement('a');
                          link.href = doc.conteudoUrl!;
                          link.download = doc.nome;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }, idx * 400);
                      });
                    };

                    const handleDownloadCombinedPDF = () => {
                      const selectedItems = timelineItems.filter(item => !!selectedTimelineItemIds[item.data.id]);
                      if (selectedItems.length === 0) return;

                      const userTrib = getTribunais().find(t => t.id === currentUser?.tribunalId);
                      const tribunalNome = userTrib ? `${userTrib.tribunal} - ${userTrib.localidade}` : 'Tribunal Geral';

                      const docPdf = new jsPDF({
                        orientation: 'p',
                        unit: 'mm',
                        format: 'a4',
                      });

                      // --- FIRST PAGE: COVER PAGE ---
                      // Set elegant dark slate/indigo background accent
                      docPdf.setFillColor(15, 23, 42); 
                      docPdf.rect(0, 0, 210, 25, 'F');

                      docPdf.setTextColor(255, 255, 255);
                      docPdf.setFont('helvetica', 'bold');
                      docPdf.setFontSize(10);
                      docPdf.text('REPÚBLICA DE ANGOLA - PLANO DE REFORMA DA JUSTIÇA', 12, 11);
                      docPdf.setFontSize(8);
                      docPdf.text('SISTEMA AUTOMATIZADO DE COMPILAÇÃO DE PEÇAS JURÍDICAS', 12, 17);

                      // Title section
                      docPdf.setTextColor(15, 23, 42);
                      docPdf.setFont('helvetica', 'bold');
                      docPdf.setFontSize(16);
                      docPdf.text('COLETÂNEA COMPILADA DE PEÇAS & DOCUMENTOS', 12, 42);

                      // Decorative subtitle bar
                      docPdf.setFillColor(124, 58, 237); // purple-600
                      docPdf.rect(12, 46, 186, 2, 'F');

                      // Process Metadata Box
                      docPdf.setFillColor(248, 250, 252); // slate-50
                      docPdf.setDrawColor(226, 232, 240); // slate-200
                      docPdf.setLineWidth(0.5);
                      docPdf.rect(12, 55, 186, 65, 'DF');

                      docPdf.setTextColor(15, 23, 42);
                      docPdf.setFont('helvetica', 'bold');
                      docPdf.setFontSize(11);
                      docPdf.text('DADOS DOS AUTOS E REGISTO PRINCIPAL', 18, 63);

                      docPdf.setDrawColor(203, 213, 225); // slate-300
                      docPdf.line(18, 66, 192, 66);

                      docPdf.setFont('helvetica', 'normal');
                      docPdf.setFontSize(9.5);
                      docPdf.setTextColor(71, 85, 105);

                      docPdf.setFont('helvetica', 'bold');
                      docPdf.text('Número do Processo:', 18, 74);
                      docPdf.setFont('helvetica', 'normal');
                      docPdf.text(processo.numero, 58, 74);

                      docPdf.setFont('helvetica', 'bold');
                      docPdf.text('Tribunal Competente:', 18, 81);
                      docPdf.setFont('helvetica', 'normal');
                      docPdf.text(tribunalNome, 58, 81);

                      docPdf.setFont('helvetica', 'bold');
                      docPdf.text('Autor / Requerente:', 18, 88);
                      docPdf.setFont('helvetica', 'normal');
                      const autoresText = processo.autores?.join(', ') || 'N/A';
                      const autoresLines = docPdf.splitTextToSize(autoresText, 133);
                      docPdf.text(autoresLines[0] || 'N/A', 58, 88);

                      docPdf.setFont('helvetica', 'bold');
                      docPdf.text('Réu / Requerido:', 18, 95);
                      docPdf.setFont('helvetica', 'normal');
                      const reusText = processo.reus?.join(', ') || 'N/A';
                      const reusLines = docPdf.splitTextToSize(reusText, 133);
                      docPdf.text(reusLines[0] || 'N/A', 58, 95);

                      docPdf.setFont('helvetica', 'bold');
                      docPdf.text('Data de Compilação:', 18, 102);
                      docPdf.setFont('helvetica', 'normal');
                      docPdf.text(`${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT')}`, 58, 102);

                      docPdf.setFont('helvetica', 'bold');
                      docPdf.text('Peças Selecionadas:', 18, 109);
                      docPdf.setFont('helvetica', 'normal');
                      docPdf.text(`${selectedItems.length} documento(s) / ato(s)`, 58, 109);

                      // Table of Contents Section
                      docPdf.setTextColor(15, 23, 42);
                      docPdf.setFont('helvetica', 'bold');
                      docPdf.setFontSize(11);
                      docPdf.text('ÍNDICE GERAL DE PEÇAS ANEXADAS', 12, 135);

                      docPdf.setDrawColor(203, 213, 225);
                      docPdf.line(12, 138, 198, 138);

                      let tocY = 146;
                      selectedItems.forEach((item, index) => {
                        if (tocY > 275) return;

                        const num = index + 1;
                        let titleText = '';
                        let dateTextText = '';
                        let typeLabelText = '';

                        if (item.type === 'ato') {
                          titleText = item.data.tipoAto;
                          dateTextText = formatDateDot(item.data.data);
                          typeLabelText = 'Ato Cronológico';
                        } else if (item.type === 'notificacao') {
                          titleText = `Notificação (${item.data.formModeloId.toUpperCase()})`;
                          dateTextText = formatDateDot(item.data.dataCriacao);
                          typeLabelText = 'Notificação';
                        } else {
                          titleText = item.data.nome;
                          dateTextText = formatDateDot(item.data.dataApresentacao);
                          typeLabelText = item.data.categoria;
                        }

                        docPdf.setFont('helvetica', 'bold');
                        docPdf.setFontSize(9);
                        docPdf.setTextColor(15, 23, 42);
                        docPdf.text(`${num}.`, 12, tocY);

                        docPdf.setFont('helvetica', 'bold');
                        const truncatedTitle = titleText.length > 55 ? titleText.substring(0, 52) + '...' : titleText;
                        docPdf.text(truncatedTitle, 20, tocY);

                        docPdf.setFont('helvetica', 'normal');
                        docPdf.setFontSize(8.5);
                        docPdf.setTextColor(115, 115, 115);
                        docPdf.text(`(${typeLabelText})`, 115, tocY);
                        docPdf.text(dateTextText, 180, tocY);

                        tocY += 6.5;
                      });

                      // Official footer of cover page
                      docPdf.setDrawColor(226, 232, 240);
                      docPdf.line(12, 280, 198, 280);
                      docPdf.setFont('helvetica', 'normal');
                      docPdf.setFontSize(8);
                      docPdf.setTextColor(148, 163, 184);
                      docPdf.text('REFORMA DA JUSTIÇA E DO DIREITO - ANGOLA', 12, 285);
                      docPdf.text(`Página 1`, 190, 285);

                      // --- SUBSEQUENT PAGES: DETAILS OF EACH ITEM ---
                      let globalPageNum = 1;

                      selectedItems.forEach((item, index) => {
                        const num = index + 1;
                        let titleText = '';
                        let dateTextText = '';
                        let typeLabelText = '';
                        let specificAuthorText = '';
                        let docTextText = '';

                        if (item.type === 'ato') {
                          const act = item.data;
                          titleText = act.tipoAto;
                          dateTextText = formatDateDot(act.data);
                          typeLabelText = `ATO PROCESSUAL CRONOLÓGICO`;
                          specificAuthorText = act.advogadoPraticante || 'Judicial';
                          docTextText = act.descricao || '';
                          
                          const actDocs = processo.documentos.filter(d => !d.deleted && act.documentosIds && act.documentosIds.includes(d.id));
                          if (actDocs.length > 0) {
                            docTextText += `\n\n[DOCUMENTOS ANEXADOS AO ATO (${actDocs.length})]\n`;
                            actDocs.forEach(ad => {
                              docTextText += `\n* ${ad.nome} (${ad.categoria}):\n${ad.conteudoTexto || ad.resumo || '(Sem conteúdo)'}\n`;
                            });
                          }
                        } else if (item.type === 'notificacao') {
                          const notif = item.data;
                          titleText = `Notificação (${notif.formModeloId.toUpperCase()})`;
                          dateTextText = formatDateDot(notif.dataCriacao);
                          typeLabelText = `NOTIFICAÇÃO / DILIGÊNCIA DA SECRETARIA`;
                          specificAuthorText = notif.criadoPorFuncionario || 'Secretaria Executiva';
                          docTextText = notif.textoEditado || '';
                        } else {
                          const doc = item.data;
                          titleText = doc.nome;
                          dateTextText = formatDateDot(doc.dataApresentacao);
                          typeLabelText = `${doc.categoria.toUpperCase()}`;
                          specificAuthorText = doc.advogadoApresentante || doc.criadoPor || 'Secretaria / Parte';
                          docTextText = doc.conteudoTexto || doc.resumo || '';
                        }

                        // Start content on a new page
                        docPdf.addPage();
                        globalPageNum++;

                        // Slate background header band for this page
                        docPdf.setFillColor(30, 41, 59); // slate-800
                        docPdf.rect(0, 0, 210, 16, 'F');

                        docPdf.setTextColor(255, 255, 255);
                        docPdf.setFont('helvetica', 'bold');
                        docPdf.setFontSize(8.5);
                        docPdf.text(`PROCESSO: ${processo.numero}  |  REGISTO #${num}`, 12, 10.5);

                        // Header info of item
                        docPdf.setTextColor(15, 23, 42);
                        docPdf.setFont('helvetica', 'bold');
                        docPdf.setFontSize(13);
                        docPdf.text(`${num}. ${titleText.toUpperCase()}`, 12, 28);

                        // Subtitle
                        docPdf.setFont('helvetica', 'bold');
                        docPdf.setFontSize(9);
                        docPdf.setTextColor(99, 102, 241); // indigo-500
                        docPdf.text(typeLabelText, 12, 34);

                        // Partition line
                        docPdf.setDrawColor(226, 232, 240);
                        docPdf.setLineWidth(0.4);
                        docPdf.line(12, 38, 198, 38);

                        // Metadata table/info
                        docPdf.setFont('helvetica', 'normal');
                        docPdf.setFontSize(8.5);
                        docPdf.setTextColor(100, 116, 139);
                        docPdf.text(`Data de Registo: ${dateTextText}  |  Autoria: ${specificAuthorText}`, 12, 44);

                        docPdf.line(12, 48, 198, 48);

                        // Content text
                        docPdf.setTextColor(30, 41, 59);
                        docPdf.setFont('helvetica', 'normal');
                        docPdf.setFontSize(10);

                        const wrappedLines = docPdf.splitTextToSize(docTextText || '(Nenhum conteúdo de texto disponível neste registo)', 186);

                        let currentY = 56;
                        const pageEndY = 278;

                        for (let k = 0; k < wrappedLines.length; k++) {
                          if (currentY > pageEndY) {
                            docPdf.addPage();
                            globalPageNum++;

                            // Header band on continued page
                            docPdf.setFillColor(30, 41, 59);
                            docPdf.rect(0, 0, 210, 11, 'F');
                            docPdf.setTextColor(255, 255, 255);
                            docPdf.setFont('helvetica', 'bold');
                            docPdf.setFontSize(8);
                            docPdf.text(`Registo #${num} (Continuação) • ${titleText}`, 12, 7.5);

                            docPdf.setDrawColor(226, 232, 240);
                            docPdf.line(12, 280, 198, 280);
                            docPdf.setFont('helvetica', 'normal');
                            docPdf.setFontSize(8);
                            docPdf.setTextColor(148, 163, 184);
                            docPdf.text(`Processo Nº ${processo.numero}  |  Coletânea Compilada`, 12, 285);
                            docPdf.text(`Página ${globalPageNum}`, 190, 285);

                            currentY = 20; // reset drawing Y
                            docPdf.setTextColor(30, 41, 59);
                            docPdf.setFont('helvetica', 'normal');
                            docPdf.setFontSize(10);
                          }

                          docPdf.text(wrappedLines[k], 12, currentY);
                          currentY += 5.8;
                        }

                        // Page Footer line
                        docPdf.setDrawColor(226, 232, 240);
                        docPdf.line(12, 280, 198, 280);
                        docPdf.setFont('helvetica', 'normal');
                        docPdf.setFontSize(8);
                        docPdf.setTextColor(148, 163, 184);
                        docPdf.text(`Processo Nº ${processo.numero}  |  Coletânea Compilada`, 12, 285);
                        docPdf.text(`Página ${globalPageNum}`, 190, 285);
                      });

                      const safeNum = processo.numero.replace(/[^a-zA-Z0-9]/g, '_');
                      docPdf.save(`compilacao_processo_${safeNum}.pdf`);
                    };

                    const selectedCount = Object.keys(selectedTimelineItemIds).length;

                    return (
                      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs no-print shadow-xs">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-black text-emerald-950 uppercase tracking-wider text-xs mr-1">Lote / Selecionar:</span>
                          <button
                            type="button"
                            onClick={handleSelectAllFavorites}
                            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 border-2 border-amber-250 text-amber-950 font-black rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-3xs text-xs"
                            title="Selecionar todos os favoritos do processo"
                          >
                            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                            Selecionar Todos os Favoritos
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTimelineItemIds({})}
                            className="px-3.5 py-2.5 bg-white hover:bg-zinc-100 border-2 border-zinc-250 text-zinc-800 font-extrabold rounded-xl transition-colors cursor-pointer shadow-3xs text-xs"
                          >
                            Limpar Seleção
                          </button>
                        </div>

                        {selectedCount > 0 && (
                          <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={handleDownloadCombinedPDF}
                              className="w-full sm:w-auto px-5 py-3 bg-emerald-800 hover:bg-emerald-900 border border-emerald-950 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer text-xs uppercase tracking-wider"
                              title="Descarrega uma listagem compilada das peças e atos jurídicos sob o formato PDF."
                            >
                              <Download className="h-3.5 w-3.5" />
                              Baixar Coletânea PDF ({selectedCount})
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadOriginalFiles}
                              className="w-full sm:w-auto px-5 py-3 bg-blue-700 hover:bg-blue-800 border border-blue-900 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer text-xs uppercase tracking-wider"
                              title="Descarrega em lote todos os ficheiros originais (como PDFs e imagens) que foram carregados nos registos selecionados."
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              Baixar Ficheiros Originais ({selectedCount})
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {filteredTimelineItems.length === 0 ? (
                    <div className="p-16 text-center text-zinc-400 bg-zinc-50/50 rounded-2xl border border-zinc-200 border-dashed">
                      <Clock className="h-10 w-10 mx-auto stroke-[1.1] text-zinc-300 mb-2" />
                      <p className="text-sm font-bold text-zinc-700">Nenhum registo encontrado</p>
                      <p className="text-xs text-zinc-400 mt-1">Experimente alterar os filtros de Tipo de Documento ou de Autoria acima selecionados.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm bg-white font-sans w-full">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-emerald-700 text-white text-xs font-semibold select-none leading-none tracking-wider uppercase">
                            <th className="py-3 px-3 w-10 text-center no-print border-r border-emerald-600/50">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-emerald-600 bg-emerald-850 text-white focus:ring-0 outline-hidden cursor-pointer accent-emerald-655"
                                checked={filteredTimelineItems.length > 0 && filteredTimelineItems.every(item => !!selectedTimelineItemIds[item.data.id])}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const updated = { ...selectedTimelineItemIds };
                                  filteredTimelineItems.forEach(item => {
                                    if (checked) {
                                      updated[item.data.id] = true;
                                    } else {
                                      delete updated[item.data.id];
                                    }
                                  });
                                  setSelectedTimelineItemIds(updated);
                                }}
                                title="Marcar / desmarcar todos os visíveis"
                              />
                            </th>
                            <th className="py-3 px-3 w-10 text-center"></th>
                            <th className="py-3 px-4 w-28 text-left font-bold">Data</th>
                            <th className="py-3 px-4 w-1/3 font-bold">Ato/Documento</th>
                            <th className="py-3 px-4 font-bold">Descrição</th>
                            <th className="py-3 px-4 w-48 text-right font-bold pr-6 font-sans">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/75">
                          {filteredTimelineItems.map((item, idx) => {
                            let itemId = '';
                            let dateText = '';
                            let codeText = '';
                            let linkName = '';
                            let classificationText = '';
                            let isMagistrado = true;
                            let docForAction: Documento | null = null;
                            let creatorName = '';

                            if (item.type === 'ato') {
                              const act = item.data;
                              itemId = act.id;
                              dateText = formatDateDot(act.data);
                              codeText = getStable8DigitId(act.id);
                              linkName = act.tipoAto;
                              const jList = getJuizes();
                              const practitioner = act.advogadoPraticante || '';
                              isMagistrado = !practitioner || jList.includes(practitioner) || act.tipoAto === 'Sentença';
                              classificationText = isMagistrado ? 'Tipificação Atos Magistrado' : 'Tipos de Papeis';
                              creatorName = act.advogadoPraticante || 'Judicial';
                            } else if (item.type === 'notificacao') {
                              const notif = item.data;
                              itemId = notif.id;
                              dateText = formatDateDot(notif.dataCriacao);
                              codeText = getStable8DigitId(notif.id);
                              linkName = `Notificação (${notif.formModeloId.toUpperCase().slice(-4)})`;
                              isMagistrado = false;
                              classificationText = 'Procedimento de Notificação';
                              creatorName = notif.criadoPorFuncionario || 'Secretaria Executiva';
                            } else {
                              const doc = item.data;
                              itemId = doc.id;
                              dateText = formatDateDot(doc.dataApresentacao);
                              codeText = getStable8DigitId(doc.id);
                              linkName = doc.categoria;
                              docForAction = doc;
                              const jList = getJuizes();
                              const creator = doc.criadoPor || doc.advogadoApresentante || '';
                              isMagistrado = jList.includes(creator) || ['Sentença', 'Despacho', 'Decisão'].includes(doc.categoria);
                              classificationText = isMagistrado ? 'Tipificação Atos Magistrado' : 'Tipos de Papeis';
                              creatorName = creator || 'Secretaria / Parte';
                            }

                            const isExpanded = !!expandedTimelineItems[itemId];
                            const isStarred = !!starredTimelineItems[itemId];
                            const commentText = timelineComments[itemId] || '';

                            // Calculate description text based on the detailed description inside the act or file content
                            let displayDescription = '';
                            if (item.type === 'ato') {
                              displayDescription = item.data.descricao || '';
                            } else if (item.type === 'notificacao') {
                              displayDescription = item.data.textoEditado || '';
                            } else {
                              displayDescription = item.data.conteudoTexto || item.data.resumo || '';
                            }

                            const handleViewConteudo = () => {
                              if (item.type === 'ato') {
                                toggleTimelineItem(itemId);
                              } else if (item.type === 'notificacao') {
                                const assoc = processo.documentos.find(d => d.notificacaoId === itemId && !d.deleted && !d.isAnexoDoc);
                                if (assoc) {
                                  handleOpenDocAction(assoc);
                                } else {
                                  toggleTimelineItem(itemId);
                                }
                              } else if (docForAction) {
                                handleOpenDocAction(docForAction);
                              }
                            };

                            const handleDownloadFile = () => {
                              if (item.type === 'ato') {
                                const matchedDoc = processo.documentos.find(d => 
                                  !d.deleted && item.data.documentosIds && item.data.documentosIds.includes(d.id)
                                );
                                if (matchedDoc) {
                                  onDownloadFile(matchedDoc);
                                } else {
                                  toggleTimelineItem(itemId);
                                }
                              } else if (item.type === 'notificacao') {
                                const assoc = processo.documentos.find(d => d.notificacaoId === itemId && !d.deleted && !d.isAnexoDoc);
                                if (assoc) {
                                  onDownloadFile(assoc);
                                }
                              } else if (docForAction) {
                                onDownloadFile(docForAction);
                              }
                            };

                            return (
                              <React.Fragment key={`${item.type}_\$${itemId}_${idx}`}>
                                <tr className={`hover:bg-slate-50/55 transition-colors text-xs font-sans ${isExpanded ? 'bg-slate-50/40 font-semibold' : ''}`}>
                                  {/* Checkbox selector on the Left Side */}
                                  <td className="p-0 text-center relative w-10 no-print border-r border-zinc-100/80 bg-slate-50/20">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 rounded border-zinc-350 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-650"
                                      checked={!!selectedTimelineItemIds[itemId]}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSelectedTimelineItemIds(prev => {
                                          const updated = { ...prev };
                                          if (checked) {
                                            updated[itemId] = true;
                                          } else {
                                            delete updated[itemId];
                                          }
                                          return updated;
                                        });
                                      }}
                                    />
                                  </td>

                                  {/* Arrow Toggle on the Left Side of Data Column */}
                                  <td className="p-0 text-center relative w-10">
                                    <div 
                                      onClick={() => toggleTimelineItem(itemId)}
                                      className="w-8 h-8 flex items-center justify-center mx-auto cursor-pointer rounded-lg hover:bg-slate-100 text-zinc-400 hover:text-emerald-700 transition-all select-none"
                                      title={isExpanded ? "Minimizar detalhes" : "Expandir detalhes"}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4.5 w-4.5 stroke-[2.5]" />
                                      ) : (
                                        <ChevronDown className="h-4.5 w-4.5 stroke-[2.5]" />
                                      )}
                                    </div>
                                  </td>

                                  <td className="py-3 px-4 text-zinc-500 font-medium font-mono whitespace-nowrap">
                                    {dateText}
                                  </td>

                                  {/* Act/Document Link Name (Without code prefix) */}
                                  <td className="py-3 px-4 font-sans font-medium text-zinc-900">
                                    <span 
                                      onClick={() => toggleTimelineItem(itemId)}
                                      className="font-bold underline text-slate-800 hover:text-emerald-700 cursor-pointer transition-colors decoration-slate-350 hover:decoration-emerald-700"
                                    >
                                      {linkName}
                                    </span>
                                  </td>

                                  {/* Act detailed description */}
                                  <td className="py-3 px-4 text-zinc-650 font-medium max-w-[320px]" title={displayDescription}>
                                    <div className="line-clamp-2 text-[10.5px] leading-relaxed whitespace-pre-line font-medium">
                                      {displayDescription}
                                    </div>
                                  </td>

                                  {/* Direct workflow actions layout */}
                                  <td className="py-3 px-4 text-right pr-6 relative w-48">
                                    <div className="flex items-center justify-end gap-2 pr-1.5">
                                      {/* Star toggle */}
                                      <button
                                        type="button"
                                        onClick={() => toggleStarredTimelineItem(itemId)}
                                        className={`transition-all p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer inline-flex items-center ${isStarred ? 'text-amber-500 fill-amber-400 scale-110' : 'text-zinc-355 hover:text-amber-500'}`}
                                        title={isStarred ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                      >
                                        <Star className="h-4 w-4 stroke-[2]" />
                                      </button>

                                      {/* View text content */}
                                      <button
                                        type="button"
                                        onClick={handleViewConteudo}
                                        className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="Ver texto / conteúdo"
                                      >
                                        <Eye className="h-4 w-4 stroke-[2]" />
                                      </button>

                                      {/* Download button */}
                                      {(item.type !== 'ato' || (item.type === 'ato' && item.data.documentosIds && item.data.documentosIds.length > 0)) ? (
                                        <button
                                          type="button"
                                          onClick={handleDownloadFile}
                                          className="text-sky-655 hover:text-sky-850 hover:bg-sky-50 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                          title="Download ficheiro"
                                        >
                                          <Download className="h-4 w-4 stroke-[2]" />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled
                                          className="text-zinc-200 p-1.5 rounded-lg cursor-not-allowed inline-flex items-center"
                                          title="Este ato não possui ficheiros anexos diretos"
                                        >
                                          <Download className="h-4 w-4 stroke-[2] opacity-40" />
                                        </button>
                                      )}

                                      {/* Edit Details */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (item.type === 'ato') {
                                            setEditingAct(item.data);
                                          } else if (item.type === 'notificacao') {
                                            const assoc = processo.documentos.find(d => d.notificacaoId === itemId && !d.deleted && !d.isAnexoDoc);
                                            if (assoc) setEditingDoc(assoc);
                                          } else if (docForAction) {
                                            setEditingDoc(docForAction);
                                          }
                                        }}
                                        className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="Editar registo/documento"
                                      >
                                        <Edit className="h-4 w-4 stroke-[2]" />
                                      </button>

                                      {/* Delete Item */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (item.type === 'ato') {
                                            if (confirm('Deseja realmente eliminar este ato do histórico de ocorrências?')) {
                                              const deletedAct = (processo.historicoAtos || []).find(a => a.id === itemId); if (deletedAct && currentUser) { logAction(currentUser.username, 'Eliminação de ato', processo.numero, `Ato '${deletedAct.descricao}' (${deletedAct.tipoAto || 'Geral'}) eliminado.`); } const updated = (processo.historicoAtos || []).filter(a => a.id !== itemId);
                                              if (onUpdateProcesso) {
                                                onUpdateProcesso({ ...processo, historicoAtos: updated });
                                              }
                                            }
                                          } else if (item.type === 'notificacao') {
                                            if (confirm('Deseja realmente eliminar esta notificação oficial do histórico?')) {
                                              const deletedNotif = notificacoesList.find(n => n.id === itemId); if (deletedNotif && currentUser) { logAction(currentUser.username, 'Eliminação de notificação', processo.numero, `Notificação oficial para '${deletedNotif.destinatario}' (${deletedNotif.tipo}) eliminada.`); } const updatedNotifs = notificacoesList.map(n => n.id === itemId ? { ...n, deleted: true } : n);
                                              setNotificacoesList(updatedNotifs.filter(n => n.processoNumero === processo.numero));
                                              const allNotifs = getNotificacoes().map(n => n.id === itemId ? { ...n, deleted: true, deletedAt: new Date().toISOString() } : n);
                                              localStorage.setItem('gestao_processos_notificacoes', JSON.stringify(allNotifs));
                                              const assoc = processo.documentos.find(d => d.notificacaoId === itemId && !d.deleted && !d.isAnexoDoc);
                                              if (assoc) {
                                                if (currentUser) { logAction(currentUser.username, 'Eliminação de documento', processo.numero, `Documento '${assoc.nome}' associado à notificação eliminada.`); } const updatedDocs = processo.documentos.map(d => d.id === assoc.id ? { ...d, deleted: true, deletedAt: new Date().toISOString() } : d);
                                                if (onUpdateProcesso) {
                                                  onUpdateProcesso({ ...processo, documentos: updatedDocs });
                                                }
                                              }
                                            }
                                          } else if (docForAction) {
                                            handleDeleteDocumento(docForAction.id);
                                          }
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="Eliminar permanentemente"
                                      >
                                        <Trash2 className="h-4 w-4 stroke-[2]" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {commentingItemId === itemId && (
                                  <tr className="bg-cyan-50/5">
                                    <td colSpan={6} className="py-3 px-6 bg-zinc-50/20 border-b border-zinc-150">
                                      <div className="flex flex-col gap-2 max-w-2xl ml-8 p-3 bg-white border border-cyan-200 rounded-xl shadow-xs">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                                            📝 Nota Interna de Trabalho / Comentário sobre o Ato
                                          </span>
                                          <button 
                                            onClick={() => setCommentingItemId(null)}
                                            className="text-zinc-400 hover:text-zinc-650 text-[10px] font-bold cursor-pointer"
                                          >
                                            Fechar
                                          </button>
                                        </div>
                                        <textarea
                                          value={tempCommentText}
                                          onChange={(e) => setTempCommentText(e.target.value)}
                                          placeholder="Adicione anotações, notas de estudo ou lembretes sobre este ato/documento..."
                                          className="w-full border border-zinc-200 rounded-lg p-2.5 text-xs focus:outline-hidden focus:border-[#3a9cb1] text-zinc-805 h-16 resize-none font-medium bg-white"
                                        />
                                        <div className="flex justify-end gap-2 text-xs font-sans">
                                          <button
                                            onClick={() => {
                                              saveTimelineComment(itemId, '');
                                              setCommentingItemId(null);
                                            }}
                                            className="px-2.5 py-1 text-[10px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold rounded-md cursor-pointer"
                                          >
                                            Limpar Nota
                                          </button>
                                          <button
                                            onClick={() => {
                                              saveTimelineComment(itemId, tempCommentText);
                                              setCommentingItemId(null);
                                            }}
                                            className="px-3 py-1 text-[10px] bg-[#3a9cb1] hover:bg-[#2b8296] text-white font-bold rounded-md cursor-pointer"
                                          >
                                            Gravar Comentário
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}

                                {isExpanded && (
                                  <tr className="bg-zinc-50/25">
                                    <td colSpan={6} className="py-4 px-6 border-b border-zinc-200/50">
                                      <div className="ml-8 text-xs font-sans border border-zinc-150/80 rounded-xl overflow-hidden bg-white shadow-3xs">
                                        <style>{`tr:has(.border-zinc-150\\/80) { display: none !important; }`}</style>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {isExpanded && (
                                  <tr className="bg-zinc-50/25">
                                    <td colSpan={6} className="py-4 px-6 border-b border-zinc-200/50">
                                      <div className="ml-8 space-y-4 text-xs font-sans">
                                        {item.type === 'ato' ? (
                                          (() => {
                                            const act = item.data;
                                            const matchedDocs = processo.documentos.filter(d => 
                                              !d.deleted && act.documentosIds && act.documentosIds.includes(d.id)
                                            );
                                            return (
                                              <div className="space-y-3.5 bg-white border border-zinc-200/80 p-5 rounded-xl shadow-3xs font-sans">
                                                <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                                                  <div className="flex gap-2.5 flex-wrap">
                                                    <span className="bg-purple-100 text-purple-805 text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider">
                                                      Ato: {act.tipoAto}
                                                    </span>
                                                    <span className="bg-zinc-150 text-zinc-700 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                                      Fase Processual: {act.fase}
                                                    </span>
                                                  </div>
                                                  <span className="text-[10px] text-zinc-400 font-mono">📅 Registado em: {act.createdAt || act.data}</span>
                                                </div>

                                                <div className="space-y-1 font-sans">
                                                  <strong className="text-zinc-450 text-[9px] uppercase font-bold tracking-wider">Descrição do Ato:</strong>
                                                  <p className="text-xs text-zinc-805 whitespace-pre-line leading-relaxed font-normal p-3 bg-zinc-50/50 border border-zinc-150 rounded-lg">
                                                    {act.descricao}
                                                  </p>
                                                </div>

                                                {(act.parteAssociada || act.advogadoPraticante) && (
                                                  <div className="bg-zinc-100 border border-zinc-155 rounded-lg p-3 flex flex-wrap gap-x-6 gap-y-1.5 text-zinc-655 font-semibold">
                                                    {act.parteAssociada && (
                                                      <span>👤 Parte Associada: <strong className="text-zinc-909 font-bold">{act.parteAssociada}</strong></span>
                                                    )}
                                                    {act.advogadoPraticante && (
                                                      <span>🎓 Quem Pratica o Ato: <strong className="text-zinc-909 font-bold">{act.advogadoPraticante}</strong></span>
                                                    )}
                                                  </div>
                                                )}

                                                {commentText && (
                                                  <div className="bg-cyan-50/20 border border-cyan-150 rounded-lg p-3 text-cyan-850 font-medium leading-relaxed">
                                                    💡 <strong className="text-cyan-900 font-bold">Nota de trabalho registada:</strong> "{commentText}"
                                                  </div>
                                                )}

                                                {matchedDocs.length > 0 && (
                                                  <div className="space-y-2 pt-1 font-sans">
                                                    <span className="block text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">
                                                      📂 Documentos Juntos a este Ato ({matchedDocs.length}):
                                                    </span>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                      {matchedDocs.map(doc => (
                                                        <div key={doc.id} className="bg-zinc-50 border border-zinc-150 hover:bg-slate-50/50 rounded-lg p-2.5 flex items-center justify-between gap-3 transition-colors">
                                                          <div className="min-w-0 flex-1 flex items-center gap-2">
                                                            <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                                            <span className="font-bold text-zinc-800 truncate font-mono text-[11px]" title={doc.nome}>
                                                              {doc.nome}
                                                            </span>
                                                          </div>
                                                          <div className="flex gap-1 shrink-0">
                                                            <button
                                                              type="button"
                                                              onClick={() => handleOpenDocAction(doc)}
                                                              className="text-[10px] bg-white hover:bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded font-bold cursor-pointer"
                                                            >
                                                              Ver
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => onDownloadFile(doc)}
                                                              className="text-[10px] bg-blue-50 hover:bg-blue-101 text-blue-700 px-2 py-0.5 rounded font-bold cursor-pointer"
                                                            >
                                                              Baixar
                                                            </button>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()
                                        ) : item.type === 'notificacao' ? (
                                          (() => {
                                            const notif = item.data;
                                            const assoc = processo.documentos.find(d => d.notificacaoId === notif.id && !d.deleted && !d.isAnexoDoc);
                                            const annexes = processo.documentos.filter(d => d.notificacaoId === notif.id && !d.deleted && d.isAnexoDoc === true);
                                            return (
                                              <div className="space-y-4 bg-white border border-zinc-200/80 p-5 rounded-xl shadow-3xs font-sans">
                                                <div className="p-3 bg-zinc-50 border border-zinc-150 rounded-lg space-y-1.5">
                                                  <strong className="text-zinc-555 text-[9px] uppercase font-bold tracking-wider block font-sans">Destinatário(s) da Notificação Oficial:</strong>
                                                  <ul className="list-disc pl-4 space-y-1 text-zinc-805 font-medium">
                                                    {notif.destinatarios.map((dst, di) => (
                                                      <li key={di}>
                                                        <strong>{dst.nome}</strong> - expedido para a morada <span className="italic text-zinc-505">{dst.morada}</span>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>

                                                <div className="space-y-1">
                                                  <div className="flex justify-between items-center pb-1">
                                                    <strong className="text-zinc-455 text-[9px] uppercase font-bold tracking-wider">Redação Notificada:</strong>
                                                    <span className="text-[10px] text-zinc-400 font-serif italic">Expediente Oficial de Notificação</span>
                                                  </div>
                                                  <div className="bg-white text-zinc-805 border-2 border-zinc-100 p-5 rounded-lg leading-relaxed whitespace-pre-line font-serif max-h-64 overflow-y-auto border-l-4 border-l-[#3a9cb1]">
                                                    {notif.textoEditado}
                                                  </div>
                                                </div>

                                                {commentText && (
                                                  <div className="bg-cyan-50/20 border border-cyan-150 rounded-lg p-3 text-cyan-850 font-medium">
                                                    💡 <strong className="text-cyan-900 font-bold">Nota de trabalho registada:</strong> "{commentText}"
                                                  </div>
                                                )}

                                                {(assoc || annexes.length > 0) && (
                                                  <div className="space-y-2 pt-1 border-t border-zinc-100 font-sans">
                                                    <span className="block text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">
                                                      📂 Ficheiros e Notificações Emitidos:
                                                    </span>
                                                    <div className="space-y-1.5">
                                                      {assoc && (
                                                        <div className="bg-zinc-50 border border-zinc-150 p-2.5 rounded-lg flex items-center justify-between gap-4">
                                                          <div className="flex items-center gap-2 min-w-0">
                                                            <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                                                            <span className="font-bold text-zinc-800 truncate font-mono text-[11px]">{assoc.nome}</span>
                                                            <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                                                              Notificação Autuada
                                                            </span>
                                                          </div>
                                                          <div className="flex gap-1.5 shrink-0">
                                                            <button
                                                              type="button"
                                                              onClick={() => handleOpenDocAction(assoc)}
                                                              className="text-[10px] bg-white hover:bg-zinc-101 border border-zinc-200 px-2.5 py-1 rounded font-bold cursor-pointer"
                                                            >
                                                              Visualizar
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => onDownloadFile(assoc)}
                                                              className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-808 px-2.5 py-1 rounded font-bold cursor-pointer"
                                                            >
                                                              Baixar
                                                            </button>
                                                          </div>
                                                        </div>
                                                      )}
                                                      {annexes.map(annexDoc => (
                                                        <div key={annexDoc.id} className="bg-zinc-50 border border-zinc-150 p-2.5 rounded-lg flex items-center justify-between gap-4">
                                                          <div className="flex items-center gap-2 min-w-0">
                                                            <Paperclip className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                                            <span className="font-bold text-zinc-800 truncate font-mono text-[11px]">{annexDoc.nome}</span>
                                                            <span className="bg-zinc-100 text-zinc-550 text-[9px] px-1.5 py-0.2 rounded font-mono">
                                                              {annexDoc.categoria || 'Anexo'}
                                                            </span>
                                                          </div>
                                                          <div className="shrink-0">
                                                            <button
                                                              type="button"
                                                              onClick={() => handleOpenDocAction(annexDoc)}
                                                              className="text-[10px] bg-white hover:bg-zinc-100 border border-zinc-205 px-2.5 py-0.5 rounded font-bold cursor-pointer"
                                                            >
                                                              Ler
                                                            </button>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          (() => {
                                            const doc = item.data;
                                            const docAnnexes = processo.documentos.filter(d => d.parentDocId === doc.id && !d.deleted);
                                            return (
                                              <div className="space-y-4 bg-white border border-zinc-205 p-5 rounded-xl shadow-3xs font-sans">
                                                <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 flex-wrap gap-2 text-[10.5px]">
                                                  <div>
                                                    <span className="bg-sky-100 text-[#287484] text-[10px] font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider mr-2">
                                                      Documento: {doc.categoria}
                                                    </span>
                                                    {doc.isCriadoNaApp && (
                                                      <span className="bg-indigo-100 text-indigo-805 text-[9px] px-2.0 py-0.5 rounded font-extrabold uppercase font-sans">
                                                        Criado Internamente
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="text-zinc-400 flex items-center gap-3 font-mono">
                                                    <span>Tamanho: <strong className="text-zinc-705">{doc.tamanho}</strong></span>
                                                    <span>•</span>
                                                    <span>Formato: <strong className="text-zinc-705">{doc.tipoMime}</strong></span>
                                                  </div>
                                                </div>

                                                {doc.conteudoTexto && (
                                                  <div className="space-y-1">
                                                    <strong className="text-zinc-455 text-[9px] uppercase font-bold tracking-wider block">Conteúdo do Documento:</strong>
                                                    <div className="text-zinc-805 bg-zinc-50 border border-zinc-150 p-3.5 rounded-lg leading-relaxed whitespace-pre-line font-serif max-h-48 overflow-y-auto w-full">
                                                      {doc.conteudoTexto}
                                                    </div>
                                                  </div>
                                                )}

                                                {doc.resumo && (
                                                  <div className="bg-amber-50/20 p-3 border border-amber-200/55 rounded-lg text-zinc-700 italic font-medium leading-relaxed shadow-3xs">
                                                    <strong className="text-amber-900 not-italic font-bold">Sumário Automático:</strong> "{doc.resumo}"
                                                  </div>
                                                )}

                                                {commentText && (
                                                  <div className="bg-cyan-50/20 border border-cyan-150 rounded-lg p-3 text-cyan-850 font-medium leading-relaxed">
                                                    💡 <strong className="text-cyan-900 font-bold">Nota de trabalho registada:</strong> "{commentText}"
                                                  </div>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-55 p-3 rounded-lg text-[11px] text-zinc-650 font-medium">
                                                  <div>
                                                    <span className="block text-[8.5px] uppercase font-bold text-zinc-405">Apresentante:</span>
                                                    <strong className="text-zinc-850 font-bold">{doc.parteApresentante || 'Não especificado'}</strong>
                                                  </div>
                                                  <div>
                                                    <span className="block text-[8.5px] uppercase font-bold text-zinc-405">Quem Pratica / Assina:</span>
                                                    <strong className="text-zinc-855 font-bold">{doc.advogadoApresentante || 'Secretaria Executiva'}</strong>
                                                  </div>
                                                  {doc.valorTaxaJustica !== undefined && (
                                                    <div className="col-span-1 sm:col-span-2 border-t border-zinc-150 pt-2.5 mt-0.5 flex flex-wrap items-center justify-between text-zinc-700">
                                                      <span>🧾 Autuação de Taxa de Justiça: <strong className="text-zinc-850 font-bold">{doc.valorTaxaJustica.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</strong></span>
                                                      {doc.pagadorTaxaJustica && (
                                                        <span>Pago por: <strong className="text-zinc-805 font-bold">{doc.pagadorTaxaJustica}</strong></span>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>

                                                {docAnnexes.length > 0 && (
                                                  <div className="space-y-2 pt-1.5 border-t border-zinc-150 font-sans">
                                                    <span className="block text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">
                                                      📎 Evidências e Documentos Anexados ({docAnnexes.length}):
                                                    </span>
                                                    <div className="space-y-1.5">
                                                      {docAnnexes.map(annexDoc => (
                                                        <div key={annexDoc.id} className="bg-zinc-50 border border-zinc-150 p-2.5 rounded-lg flex items-center justify-between gap-4">
                                                          <div className="flex items-center gap-2 min-w-0">
                                                            <FileText className="h-4 w-4 text-sky-550 shrink-0" />
                                                            <span className="font-bold text-zinc-800 truncate font-mono text-[11px]" title={annexDoc.nome}>
                                                              {annexDoc.nome}
                                                            </span>
                                                            <span className="bg-sky-50 text-sky-700 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">
                                                              {annexDoc.categoria || 'Evidência'}
                                                            </span>
                                                          </div>
                                                          <div className="shrink-0 flex gap-1">
                                                            <button
                                                              type="button"
                                                              onClick={() => handleOpenDocAction(annexDoc)}
                                                              className="text-[10px] bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded font-bold cursor-pointer"
                                                            >
                                                              Ver
                                                            </button>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTabSubProcess === 'estado' && (
        <div className="space-y-6">
          {/* Header Section */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                🔄 Gestão de Estado e Tramitação dos Autos
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                Consulte e atualize o estado processual corrente do processo ou programe alarmes de controle de prazos da secretaria.
              </p>
            </div>
            
            {/* Quick Summary Badges */}
            <div className="flex flex-wrap gap-2">
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900">
                Estado Atual: <span className="uppercase text-indigo-700">{processo.faseAtual || 'Sem Estado Definido'}</span>
              </div>
              <div className={`px-4 py-2 border rounded-xl text-xs font-bold ${
                processo.alarmeAtivo 
                  ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse' 
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600'
              }`}>
                Alarme: <span>{processo.alarmeAtivo ? `Ativo (${processo.alarmeData})` : 'Inativo'}</span>
              </div>
            </div>
          </div>

          {/* Quick Alarm Actions Row */}
          <div className="bg-white border border-rose-100 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs font-sans">
            <div>
              <span className="block text-xs font-black text-rose-900 uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1.5">
                <span className="animate-ping inline-block h-2 w-2 rounded-full bg-rose-505 shrink-0" />
                ⏰ Gestão Rápida de Alarme de Prazos
              </span>
              <p className="text-[11px] text-zinc-550 font-medium">
                Pode criar um alarme de prazo/agenda customizado para este processo ou remover instantaneamente qualquer alarme ativo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormAlarmeOpen(true);
                }}
                className="flex items-center gap-1.5 px-4.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-3xs hover:shadow-sm transition-all"
              >
                <span>Criar Alarme</span>
              </button>
              {processo.alarmeAtivo && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Deseja eliminar o alarme de prazo deste processo?')) {
                      if (onUpdateProcesso) {
                        onUpdateProcesso({
                          ...processo,
                          alarmeAtivo: false,
                          alarmeTipo: undefined,
                          alarmeData: undefined,
                          alarmeNota: undefined,
                          alarmeSilenciado: true
                        });
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 bg-white hover:bg-red-50 text-red-650 border border-zinc-200 hover:border-red-200 text-xs font-bold rounded-xl cursor-pointer shadow-3xs transition-all"
                >
                  <span>Eliminar Alarme</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column (7 cols): Estado / Tramitação History */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Actions Row */}
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Histórico de Alterações de Estado</h5>
                <button
                  type="button"
                  onClick={() => setIsFormEstadoOpen(!isFormEstadoOpen)}
                  className="flex items-center gap-1.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {isFormEstadoOpen ? 'Fechar Formulário' : 'Nova Informação'}
                </button>
              </div>

              {/* Toggleable New Estado Info Form */}
              {isFormEstadoOpen && (
                <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-200">
                  <h6 className="text-xs font-bold text-zinc-800 uppercase tracking-widest">Registar Nova Informação de Estado</h6>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Selecione o Estado *</label>
                      <select
                        value={newEstadoOpcao}
                        onChange={(e) => setNewEstadoOpcao(e.target.value)}
                        className="block w-full rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 py-3 text-sm text-zinc-850 font-bold focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all cursor-pointer"
                      >
                        <option value="aguarda prazo para ato das partes">Aguarda prazo para ato das partes</option>
                        <option value="concluso para despacho">Concluso para despacho</option>
                        <option value="concluso para decisão">Concluso para decisão</option>
                        <option value="aguarda data de diligência">Aguarda data de diligência</option>
                        <option value="aguarda data de julgamento">Aguarda data de julgamento</option>
                        <option value="em recurso">Em recurso</option>
                        <option value="outro">Outro (especificar)</option>
                      </select>
                    </div>

                    {newEstadoOpcao === 'outro' && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Especifique o Estado *</label>
                        <input
                          type="text"
                          value={newEstadoCustomOpcao}
                          onChange={(e) => setNewEstadoCustomOpcao(e.target.value)}
                          placeholder="Ex: Aguarda liquidação de custas, etc."
                          className="block w-full rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 py-3 text-sm text-zinc-850 font-bold focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Nota de Justificação / Observações (Opcional)</label>
                      <textarea
                        value={newEstadoNota}
                        onChange={(e) => setNewEstadoNota(e.target.value)}
                        placeholder="Insira detalhes adicionais sobre esta alteração de estado..."
                        rows={3}
                        className="block w-full rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-805 font-medium focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setNewEstadoNota('');
                          setNewEstadoCustomOpcao('');
                          setNewEstadoOpcao('aguarda prazo para ato das partes');
                          setIsFormEstadoOpen(false);
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const finalEstado = newEstadoOpcao === 'outro' ? (newEstadoCustomOpcao.trim() || 'Outro') : newEstadoOpcao;

                          const newEntry = {
                            id: Date.now().toString(),
                            data: getLocalTodayString(),
                            opcao: finalEstado,
                            nota: newEstadoNota,
                            funcionario: currentUser?.username || 'Secretaria Geral'
                          };
                          const updatedHistorico = processo.historicoEstados ? [...processo.historicoEstados, newEntry] : [newEntry];
                          
                          // Add also a historical act in the timeline so they can see it there too!
                          const newAct: HistoricoAto = {
                            id: 'act-' + Date.now().toString(),
                            data: getLocalTodayString(),
                            descricao: `Transição de Estado: ${finalEstado.toUpperCase()}${newEstadoNota ? ` - ${newEstadoNota}` : ''}`,
                            fase: processo.faseAtual || 'Instrução',
                            tipoAto: 'Outra Diligência Processual',
                            createdAt: new Date().toISOString()
                          };
                          const updatedTimeline = processo.historicoAtos ? [...processo.historicoAtos, newAct] : [newAct];

                          if (onUpdateProcesso) {
                            onUpdateProcesso({
                              ...processo,
                              faseAtual: finalEstado,
                              historicoEstados: updatedHistorico,
                              historicoAtos: updatedTimeline
                            });
                          }
                          setNewEstadoNota('');
                          setNewEstadoCustomOpcao('');
                          setNewEstadoOpcao('aguarda prazo para ato das partes');
                          setIsFormEstadoOpen(false);
                        }}
                        className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        Gravar Informação
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical timeline logs */}
              <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 bg-zinc-50 border-b border-zinc-100 font-bold text-xs text-zinc-700 uppercase tracking-wider">
                  Registo Cronológico de Estados
                </div>

                <div className="p-6 space-y-6">
                  {(!processo.historicoEstados || processo.historicoEstados.length === 0) ? (
                    <div className="text-center py-8 text-zinc-400 text-xs">
                      Nenhuma transição de estado registada no sistema. O estado atual padrão é <strong className="text-indigo-600 font-bold">"{processo.faseAtual || 'Sem Estado definido'}"</strong>.
                    </div>
                  ) : (
                    <div className="relative border-l border-indigo-200 ml-3.5 pl-6 space-y-6">
                      {processo.historicoEstados.map((h, i) => (
                        <div key={h.id || i} className="relative">
                          {/* Dot item indicator */}
                          <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-indigo-600 bg-white shadow-xs" />
                          
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg uppercase">
                                {h.opcao}
                              </span>
                              <span className="text-xs text-zinc-450 font-mono">{formatDateDot(h.data)}</span>
                            </div>
                            {h.nota && (
                              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed bg-zinc-50 border border-zinc-100 rounded-lg p-2.5 font-medium">
                                {h.nota}
                              </p>
                            )}
                            <div className="text-[10px] text-zinc-400 mt-1.5 flex items-center gap-1 font-mono">
                              Registado por: <span className="font-bold text-zinc-500 uppercase">{h.funcionario}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Alarmes section */}
            <div className="lg:col-span-5 space-y-6">
              {(() => {
                const alarmeInfo = getProcessoDetailAlarmeInfo(processo);
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Alarmes de Prazos</h5>
                      {(!alarmeInfo.ativo || alarmeInfo.isAutomatico) && (
                        <button
                          type="button"
                          onClick={() => setIsFormAlarmeOpen(!isFormAlarmeOpen)}
                          className="flex items-center gap-1.5 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          Alarmar
                        </button>
                      )}
                    </div>

                    {/* If Alarm is active, display nice status card */}
                    {alarmeInfo.ativo && (
                      <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                            <span className="animate-pulse inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />
                            {alarmeInfo.isAutomatico ? 'ALERTA AUTOMÁTICO ATIVO' : 'ALERTA DO UTILIZADOR ATIVO'}
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Deseja eliminar este alarme de prazo?')) {
                                if (onUpdateProcesso) {
                                  onUpdateProcesso({
                                    ...processo,
                                    alarmeAtivo: false,
                                    alarmeTipo: undefined,
                                    alarmeData: undefined,
                                    alarmeNota: undefined,
                                    alarmeSilenciado: true
                                  });
                                }
                              }
                            }}
                            className="px-3 py-1.5 bg-red-650 text-white hover:bg-red-700 font-bold rounded-lg text-[10px] uppercase shadow-3xs cursor-pointer transition-all"
                          >
                            Eliminar Alarme
                          </button>
                        </div>

                        <hr className="border-rose-100" />

                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div>
                            <span className="text-zinc-500 block text-[10px] uppercase font-mono">Data Limite:</span>
                            <strong className="text-rose-950 text-sm font-mono font-bold">{formatDateDot(alarmeInfo.data || '')}</strong>
                          </div>
                          <div className="mt-2">
                            <span className="text-zinc-500 block text-[10px] uppercase font-mono">Justificação do Alarme:</span>
                            <p className="text-zinc-800 font-bold bg-white border border-rose-100/85 rounded-xl p-3 mt-1 shadow-3xs leading-relaxed">
                              {alarmeInfo.justificacao}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Form to Set Alarme */}
              {isFormAlarmeOpen && (
                <div className="p-6 bg-white border border-zinc-200 rounded-2xl shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-200">
                  <h6 className="text-xs font-bold text-zinc-850 uppercase tracking-widest">Configurar Novo Alarme de Prazo</h6>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Data do Alarme *</label>
                      <input
                        type="date"
                        value={newAlarmeData}
                        onChange={(e) => setNewAlarmeData(e.target.value)}
                        required
                        className="block w-full rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-850 font-semibold focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all font-mono cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Justificação / Motivo *</label>
                        <select
                          value={newAlarmeJustificacao}
                          onChange={(e) => setNewAlarmeJustificacao(e.target.value)}
                          className="block w-full rounded-xl bg-zinc-50 border border-zinc-300 px-3.5 py-3 text-sm text-zinc-850 font-bold focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-hidden transition-all cursor-pointer"
                        >
                          <option value="concluir para despacho">Concluir para despacho</option>
                          <option value="concluir para decisão">Concluir para decisão</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>

                      {newAlarmeJustificacao === 'outro' && (
                        <div className="animate-in fade-in slide-in-from-left-2 duration-250">
                          <label className="block text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Especifique o outro motivo *</label>
                          <input
                            type="text"
                            value={newAlarmeCustomJustificacao}
                            onChange={(e) => setNewAlarmeCustomJustificacao(e.target.value)}
                            placeholder="Especifique pormenores do alarme..."
                            required
                            className="block w-full rounded-xl bg-zinc-50 border border-rose-300 px-3.5 py-3 text-sm text-zinc-800 font-semibold focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-100 focus:outline-hidden transition-all"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsFormAlarmeOpen(false)}
                        className="px-3.5 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newAlarmeData) {
                            alert('Selecione uma data válida para o alarme.');
                            return;
                          }
                          const finalNota = newAlarmeJustificacao === 'outro' 
                            ? newAlarmeCustomJustificacao 
                            : newAlarmeJustificacao;
                          if (!finalNota) {
                            alert('Especifique o motivo do alarme.');
                            return;
                          }
                          
                          if (onUpdateProcesso) {
                            onUpdateProcesso({
                              ...processo,
                              alarmeAtivo: true,
                              alarmeTipo: 'manual',
                              alarmeData: newAlarmeData,
                              alarmeNota: finalNota,
                              alarmeSilenciado: undefined
                            });
                          }
                          setIsFormAlarmeOpen(false);
                          setNewAlarmeData('');
                          setNewAlarmeCustomJustificacao('');
                        }}
                        className="px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        Gravar Alarme
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Helpful Information card regarding Alarms */}
              <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl">
                <h6 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  💡 Notificação de Alarmes
                </h6>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                  Quando ativo, o alarme de prazo gera alertas automáticos em destaque no painel principal do funcionário de secretaria judicial e do magistrado titular do processo.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {false && activeTabSubProcess === 'notificacoes' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
            <div>
              <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-605" />
                Módulo de Notificações Judiciais Oficiais / Secretaria
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                Gere, edite e envie ou imprima notificações e mandados no âmbito deste processo para todos os intervenientes declarados.
              </p>
            </div>
            {!showCreateNotif && (
              <button
                type="button"
                onClick={() => {
                  setShowCreateNotif(true);
                  const models = getFormModelos();
                  if (models.length > 0) {
                    handleSelectModelo(models[0].id);
                  }
                }}
                className="px-4 py-2 border border-zinc-250 hover:border-zinc-350 bg-white hover:bg-zinc-50 shadow-xs font-semibold rounded-xl text-xs text-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
              >
                <Plus className="h-4 w-4 text-blue-600" />
                Criar Notificação
              </button>
            )}
          </div>

          {showCreateNotif && (
            <form onSubmit={handleSaveNotificacaoSubmit} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6 animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <FileSignature className="h-4 w-4 text-zinc-500" />
                  Passo 1: Selecionar Modelo e Destinatários
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateNotif(false)}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="ct-modelo" className="block text-[10px] text-zinc-455 font-bold uppercase tracking-wider mb-1.5">
                      Modelo do Formulário de Notificação *
                    </label>
                    <select
                      id="ct-modelo"
                      required
                      value={selectedFormModeloId}
                      onChange={(e) => handleSelectModelo(e.target.value)}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-800 focus:border-blue-600 bg-white font-medium"
                    >
                      <option value="">-- Escolha um Modelo Base --</option>
                      {getFormModelos().map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ct-header-trib" className="block text-[10px] text-zinc-455 font-bold uppercase tracking-wider mb-1.5">
                      Tribunal do Cabeçalho de Impressão *
                    </label>
                    <select
                      id="ct-header-trib"
                      required
                      value={selectedTribunalHeaderId}
                      onChange={(e) => setSelectedTribunalHeaderId(e.target.value)}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-800 focus:border-blue-600 bg-white font-medium"
                    >
                      {getTribunais().map(t => (
                        <option key={t.id} value={t.id}>{t.tribunal} ({t.localidade})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ct-notif-parte" className="block text-[10px] text-zinc-455 font-bold uppercase tracking-wider mb-1.5">
                      Parte Apresentante *
                    </label>
                    <select
                      id="ct-notif-parte"
                      required
                      value={notifParteApresentante}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNotifParteApresentante(val);
                        if (val === 'Juízo') {
                          setNotifCriadoPorFuncionario(getProcessClerk());
                        } else {
                          setNotifCriadoPorFuncionario(getProcessJudge());
                        }
                      }}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-800 focus:border-blue-600 bg-white font-medium"
                    >
                      <option value="Juízo">Juízo</option>
                      <option value="Magistrado">Magistrado</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ct-funcionario-criador" className="block text-[10px] text-zinc-455 font-bold uppercase tracking-wider mb-1.5">
                      Quem Pratica o Ato *
                    </label>
                    <select
                      id="ct-funcionario-criador"
                      required
                      value={notifCriadoPorFuncionario}
                      onChange={(e) => setNotifCriadoPorFuncionario(e.target.value)}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-800 focus:border-blue-600 bg-white font-medium"
                    >
                      {notifParteApresentante === 'Juízo' ? (
                        <>
                          {getFuncionarios().map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                          {currentUser?.username && !getFuncionarios().includes(currentUser.username) && (
                            <option value={currentUser.username}>{currentUser.username} (Ligar atual)</option>
                          )}
                        </>
                      ) : (
                        <>
                          {getJuizes().map(j => (
                            <option key={j} value={j}>{j}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="bg-zinc-50/50 border border-zinc-200 rounded-xl p-4 space-y-3">
                  <span className="block text-[10px] text-zinc-455 font-bold uppercase tracking-wider">
                    Destinatários da Notificação (Checkboxes) *
                  </span>
                  <div className="space-y-3 max-h-52 overflow-y-auto">
                    {[
                      ...processo.autores.map(nome => ({ nome, funcao: 'Autor', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-150' })),
                      ...processo.reus.map(nome => ({ nome, funcao: 'Réu', badgeColor: 'bg-rose-50 text-rose-700 border-rose-150' })),
                      ...(processo.advogadosAutor || []).map(nome => ({ nome, funcao: 'Advogado do Autor', badgeColor: 'bg-blue-50 text-blue-700 border-blue-150' })),
                      ...(processo.advogadosReu || []).map(nome => ({ nome, funcao: 'Advogado do Réu', badgeColor: 'bg-amber-50 text-amber-700 border-amber-150' })),
                      ...(processo.procuradores || []).map(nome => ({ nome, funcao: 'Procurador', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-150' }))
                    ].filter(item => item.nome && item.nome.trim() !== '').map(({ nome, funcao, badgeColor }) => (
                      <div key={`${nome}-${funcao}`} className="p-2 bg-white rounded-lg border border-zinc-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 font-bold text-zinc-700 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={!!selectedDestinatarios[nome]}
                              onChange={(e) => {
                                setSelectedDestinatarios(prev => ({
                                  ...prev,
                                  [nome]: e.target.checked
                                }));
                              }}
                              className="h-4 w-4 accent-blue-600 rounded border-zinc-350 cursor-pointer shrink-0"
                            />
                            <span className="truncate">
                              {nome}
                              {getIntervenienteNuitByNome(nome) ? ` (NUIT: ${getIntervenienteNuitByNome(nome)})` : ''}
                            </span>
                          </label>
                          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${badgeColor} select-none shrink-0`}>
                            {funcao}
                          </span>
                        </div>
                        {selectedDestinatarios[nome] && (
                          <div className="pl-6 border-t border-zinc-100/50 pt-1.5 mt-1.5 space-y-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">Morada Oficial Assumida Automaticamente:</span>
                              <span className="text-[11px] font-bold text-zinc-800 bg-slate-150/40 border border-zinc-200/40 p-2 rounded-lg block break-words">
                                {findCurrentAddressFor(nome)}
                              </span>
                            </div>
                            <span className="block text-[9.5px] text-zinc-405 font-medium leading-relaxed">
                              💡 Para alterar esta morada de envio, atualize a Morada Atual diretamente na respetiva ficha do utilizador.
                              {onConsultarFicha && (
                                <button
                                  type="button"
                                  onClick={() => onConsultarFicha(nome)}
                                  className="text-blue-600 hover:underline hover:text-blue-800 ml-1.5 font-bold cursor-pointer"
                                >
                                  [ Abrir Ficha de {nome} ]
                                </button>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedFormModeloId && (
                <div className="space-y-3">
                  <div className="flex border-t border-zinc-100 pt-4 items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <FileSignature className="h-4 w-4 text-blue-600" />
                      Passo 2: Customizar Redação do Formulário para este Processo
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full">
                      ✏️ Edição sem alterar o modelo de formulário base
                    </span>
                  </div>
                  
                  <textarea
                    rows={12}
                    value={editedNotifTexto}
                    onChange={(e) => setEditedNotifTexto(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 p-4 text-xs font-mono bg-zinc-50 text-zinc-800 leading-relaxed focus:border-blue-600 focus:outline-hidden"
                    placeholder="Redija ou altere o conteúdo formal desta notificação específica..."
                  />
                  <p className="text-[10px] text-zinc-400 font-medium">
                    💡 Pode utilizar o texto acima livremente. No cabeçalho de cada folha de cópias impressas, o sistema preencherá os dados do tribunal, cabeçalho e destinatário correspondente de forma automatizada.
                  </p>
                </div>
              )}

              {selectedFormModeloId && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4.5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1.5">
                      <Paperclip className="h-4 w-4 text-zinc-500" />
                      Passo 3: Anexar Documentos / Comprovativos Complementares (Opcional)
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        multiple
                        id="bulk-notif-files"
                        className="hidden"
                        onChange={handleBulkNotifFilesUpload}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          document.getElementById('bulk-notif-files')?.click();
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-250 text-[10px] font-bold text-blue-600 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Upload className="h-3 w-3" />
                        Procurar do Computador
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifAnexos(prev => [
                            ...prev,
                            {
                              tempId: `notif-temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                              nome: 'Documento_Anexo.pdf',
                              categoria: 'Documento de Prova',
                              conteudoTexto: ''
                            }
                          ]);
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-250 text-[10px] font-bold text-zinc-650 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Plus className="h-3 w-3" />
                        Criar Slot Vazio
                      </button>
                    </div>
                  </div>

                  {notifAnexos.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic">
                      Nenhum documento complementar anexado a esta notificação. Se necessário, clique no botão acima para adicionar guias, comprovativos de envio ou registos adicionais.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {notifAnexos.map((file, idx) => (
                        <div key={file.tempId} className="p-3 bg-white rounded-lg border border-zinc-200 space-y-2 relative">
                          <button
                            type="button"
                            onClick={() => {
                              setNotifAnexos(prev => prev.filter(f => f.tempId !== file.tempId));
                            }}
                            className="absolute right-2 top-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover documento"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                            <div>
                              <label className="block text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Nome do Ficheiro *</label>
                              <input
                                type="text"
                                value={file.nome}
                                required
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNotifAnexos(prev => prev.map(f => f.tempId === file.tempId ? { ...f, nome: val } : f));
                                }}
                                className="block w-full text-xs rounded-lg border border-zinc-250 p-1.5 focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Categoria do Documento</label>
                              <select
                                value={file.categoria}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNotifAnexos(prev => prev.map(f => f.tempId === file.tempId ? { ...f, categoria: val } : f));
                                }}
                                className="block w-full text-xs rounded-lg border border-zinc-250 p-1.5 focus:outline-hidden cursor-pointer bg-white"
                              >
                                <option value="Documento de Prova">Documento de Prova</option>
                                <option value="Comprovativo de Envio">Comprovativo de Envio / Guia</option>
                                <option value="Ofício Externo">Ofício Externo / Comunicação</option>
                                <option value="Outro">Outro Documento de Apoio</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Associar Ficheiro Local</label>
                              <div className="border border-dashed border-zinc-350 hover:border-blue-400 rounded-lg p-1.5 text-center bg-zinc-50 cursor-pointer relative group flex items-center justify-center gap-1.5 h-[34px]">
                                <input
                                  type="file"
                                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                  onChange={(e) => {
                                    const picked = e.target.files?.[0];
                                    if (picked) {
                                      const sizeKb = (picked.size / 1024).toFixed(1);
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        const dataUrl = event.target?.result as string || '';
                                        const intro = `[Ficheiro complementar anexado: ${picked.name} - ${sizeKb} KB]\n\n`;
                                        const body = `CONTEÚDO DIGITAL SECURE - Este ficheiro (${picked.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente no arquivo digital do processo.`;
                                        
                                        let guessedCategory = file.categoria;
                                        if (picked.name.toLowerCase().includes('comprovativo') || picked.name.toLowerCase().includes('guia')) {
                                          guessedCategory = 'Comprovativo de Envio';
                                        } else if (picked.name.toLowerCase().includes('oficio') || picked.name.toLowerCase().includes('ofício')) {
                                          guessedCategory = 'Ofício Externo';
                                        }

                                        setNotifAnexos(prev => prev.map(f => f.tempId === file.tempId ? {
                                          ...f,
                                          nome: picked.name,
                                          categoria: guessedCategory,
                                          conteudoTexto: intro + body,
                                          conteudoUrl: dataUrl
                                        } : f));
                                      };
                                      reader.readAsDataURL(picked);
                                    }
                                  }}
                                />
                                <Upload className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
                                <span className="text-[10px] font-bold text-zinc-600 truncate max-w-[120px]">
                                  {file.nome !== 'Documento_Anexo.pdf' && file.nome !== 'Documento de Prova' ? file.nome : 'Escolher Ficheiro'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] text-zinc-400 uppercase font-bold mb-0.5">Teor / Texto Simulado do Ficheiro *</label>
                            <textarea
                              value={file.conteudoTexto}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNotifAnexos(prev => prev.map(f => f.tempId === file.tempId ? { ...f, conteudoTexto: val } : f));
                              }}
                              rows={1.5}
                              required
                              placeholder="Resumo ou descrição concisa do conteúdo deste anexo..."
                              className="block w-full text-xs rounded-lg border border-zinc-250 p-2 focus:outline-hidden"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateNotif(false)}
                  className="px-4 py-2 border border-blue-100 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 hover:bg-zinc-850 bg-zinc-950 text-white rounded-xl font-bold text-xs cursor-pointer shadow-sm"
                >
                  Gravar Notificação e Gerar Ficheiros
                </button>
              </div>
            </form>
          )}

          {/* List of generated notifications */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block border-b border-zinc-100 pb-2 mb-4">
              Histórico de Notificações Registadas e Expedidas ({notificacoesList.length})
            </span>

            <div className="divide-y divide-zinc-100 space-y-4">
              {notificacoesList.map((n) => {
                const mod = getFormModelos().find(m => m.id === n.formModeloId);
                const tr = getTribunais().find(t => t.id === n.tribunalId);
                return (
                  <div key={n.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-5 justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-900 text-sm">{mod ? mod.nome : 'Notificação Individual'}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-medium">
                          Criado: {new Date(n.dataCriacao).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          🏛️ {tr ? tr.tribunal : 'Comarca'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-150 p-3 rounded-lg text-xs">
                        <div>
                          <span className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-2">Destinatários Escolhidos ({n.destinatarios.length}):</span>
                          <div className="space-y-1.5 font-medium">
                            {n.destinatarios.map((dst, i) => (
                              <div key={i} className="text-[11px] text-zinc-700">
                                <strong className="text-zinc-950 font-bold">● {dst.nome}</strong>{' '}
                                <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200/60 rounded px-1.5 py-0.5 select-none inline-block ml-1">
                                  {getRoleLabel(dst.nome)}
                                </span> – <span className="text-[10px] italic text-zinc-500">{dst.morada}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="border-t md:border-t-0 md:border-l border-zinc-150 pt-2 md:pt-0 md:pl-3">
                          <span className="block text-[9px] text-zinc-400 font-bold uppercase tracking-wider mb-2">Firma / Redação Formal:</span>
                          <p className="text-[11px] text-zinc-650 max-h-24 overflow-y-auto font-mono whitespace-pre-wrap select-all leading-relaxed">
                            {n.textoEditado}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPrintSelectedNotif(n)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir Cópias Recibos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNotif(n.id)}
                        className="px-3.5 py-2 text-red-650 hover:bg-red-50 border border-transparent hover:border-red-100 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar Notificação
                      </button>
                    </div>
                  </div>
                );
              })}
              {notificacoesList.length === 0 && (
                <div className="text-center py-8 text-zinc-400 font-medium italic">
                  Nenhuma notificação oficial registada para este processo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROFESSIONAL MULTI-RECIPIENT PRINT MODAL PREVIEW OVERLAY */}
      {printSelectedNotif && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print">
          <div className="bg-slate-100 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh]">
            {/* Header control */}
            <div className="p-4 bg-zinc-900 text-white flex justify-between items-center rounded-t-3xl shadow-sm">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Pré-Visualização e Impressão de Notificações</h3>
                <span className="text-[11px] font-medium text-slate-400">Total de Cópias Geradas: {printSelectedNotif.destinatarios.length} (uma cópia independente com endereçamento específico para cada destinatário)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const originalTitle = document.title;
                    document.title = `Notificacoes_Proc_${processo.numero}`;
                    window.print();
                    document.title = originalTitle;
                  }}
                  className="px-4 py-2 bg-blue-605 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Todas ({printSelectedNotif.destinatarios.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSelectedNotif(null)}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer animate-pulse"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Scrollable multi-leaf simulator */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-700/20">
              {printSelectedNotif.destinatarios.map((dst, idx) => {
                const tr = getTribunais().find(t => t.id === printSelectedNotif.tribunalId);
                return (
                  <div key={idx} className="bg-white border border-zinc-200 p-8 shadow-md rounded-2xl max-w-2xl mx-auto space-y-6 relative overflow-hidden page-break-after-always">
                    {/* Page counter watermarked */}
                    <div className="absolute right-6 top-6 text-[10px] text-zinc-400 font-bold border border-zinc-200 px-2.5 py-1 rounded-full uppercase">
                      Cópia {idx + 1} de {printSelectedNotif.destinatarios.length}
                    </div>

                    {/* Official Court Header Image or Placeholder banner */}
                    {tr?.imagemCabecalho ? (
                      <div className="border-b-2 border-zinc-800 pb-3">
                        <img src={tr.imagemCabecalho} alt="Cabeçalho Oficial do Tribunal" className="h-20 w-full object-cover" referrerPolicy="no-referrer" />
                        <div className="text-right text-[9px] text-zinc-400 mt-1 uppercase font-bold tracking-widest">{tr.tribunal}</div>
                      </div>
                    ) : (
                      <div className="border-b-2 border-zinc-800 pb-4 text-center">
                        <div className="text-lg font-bold uppercase tracking-wider text-zinc-900 font-display flex items-center justify-center gap-2">
                          <Building className="h-6 w-6 text-indigo-600" />
                          {tr ? tr.tribunal : 'Tribunal Judicial de Comarca'}
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-0.5">República Portuguesa • DGAJ Coordenadas Locais</div>
                      </div>
                    )}

                    {/* Recipient area positioned clearly at the start */}
                    <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-2 mt-4">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400">Destinatário da Notificação / Citação:</span>
                      <div className="space-y-0.5 text-xs text-zinc-800">
                        <div className="text-sm font-bold text-zinc-950">{dst.nome}</div>
                        <div><strong className="font-semibold text-zinc-500">Qualidade / Função:</strong> {getRoleLabel(dst.nome)}</div>
                        <div><strong className="font-semibold text-zinc-500">Morada Registada:</strong> {dst.morada}</div>
                        <div><strong className="font-semibold text-zinc-500">Estado de Ação:</strong> Tramitação Integral via Secretaria</div>
                      </div>
                    </div>

                    {/* Process description block */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-zinc-150 py-3 text-[11px] text-zinc-650">
                      <div>
                        <strong>Processo Nº:</strong> <span className="font-mono text-zinc-900 font-bold select-all">{processo.numero}</span>
                      </div>
                      <div>
                        <strong>Data de Autuação:</strong> {processo.dataAutuacao}
                      </div>
                      <div>
                        <strong>Juiz de Causa:</strong> {processo.juizTitular || 'Secretaria Judicial'}
                      </div>
                    </div>

                    {/* Customized Template text compiled */}
                    <div className="text-zinc-800 leading-relaxed text-xs font-mono whitespace-pre-wrap p-2 border border-dashed border-zinc-150 rounded bg-slate-50/20 select-all">
                      {printSelectedNotif.textoEditado}
                    </div>

                    {/* Signature block */}
                    <div className="pt-8 grid grid-cols-2 gap-4 text-[10px] text-zinc-500">
                      <div className="text-center border-t border-zinc-200 pt-3">
                        O Técnico de Justiça Adjunto / Escrivão
                      </div>
                      <div className="text-center border-t border-zinc-200 pt-3">
                        Assinatura Eletrónica / Carimbo Local
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTabSubProcess === 'apensos' && (
        <div className="space-y-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 mb-2 uppercase tracking-wider font-display flex items-center gap-1.5">
              <span>🔗</span> Processos Apensos e Incidentes Conexos
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Estes são os processos secundários, apensos ou incidentes conexos autuados sob a dependência deste processo principal ({processo.numero}).
            </p>

            {apensosList.length === 0 ? (
              <div className="text-center py-10 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                <span className="text-2xl block mb-2">🔗</span>
                <p className="text-xs text-zinc-400 italic">Este processo não possui nenhum apenso ou incidente associado.</p>
                <p className="text-[10px] text-zinc-400 mt-2">
                  Pode criar um apenso registando um novo processo e definindo o campo "Apenso" como "Sim" com indicação deste número de processo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {apensosList.map((ap) => (
                  <div key={ap.numero} className="border border-zinc-205 rounded-xl bg-white p-5 hover:border-zinc-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono font-bold text-zinc-900 bg-zinc-100 px-2.5 py-1 rounded-md select-all">
                          {ap.numero}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          ap.tipo === 'civel' ? 'bg-indigo-50 text-indigo-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {ap.tipo === 'civel' ? 'Cível' : 'Penal'}
                        </span>
                      </div>
                      
                      <div className="text-xs space-y-1.5 text-zinc-650">
                        <div><strong className="font-semibold text-zinc-500 font-sans">Autor/Exequente:</strong> {(ap.autores || []).join(', ')}</div>
                        <div><strong className="font-semibold text-zinc-500 font-sans">Réu/Executado:</strong> {(ap.reus || []).join(', ')}</div>
                        <div><strong className="font-semibold text-zinc-500 font-sans">Juiz Titular:</strong> {ap.juizTitular}</div>
                        <div><strong className="font-semibold text-zinc-500 font-sans">Data Autuação:</strong> {ap.dataAutuacao}</div>
                      </div>
                    </div>

                    <div className="border-t border-zinc-150 pt-3 flex justify-between items-center bg-white">
                      <span className="text-[10px] text-zinc-400 font-medium">
                        📂 {ap.documentos.length} Documentos
                      </span>
                      {onSelectProcesso && (
                        <button
                          type="button"
                          onClick={() => onSelectProcesso(ap.numero)}
                          className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                          Abrir Apenso
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </>
    );
  };

  return (
    <>
      {isNewTabMode ? renderNewTabModeContent() : (
        <div className="space-y-6 font-sans">
          {standardHeaderContent}
          {renderSubProcessTabs()}
        </div>
      )}

      {/* SPECIAL MEDIA PRINT SUPPORT STYLE INJECTION */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .no-print {
            display: none !important;
          }
          .fixed {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          .page-break-after-always {
            page-break-after: always !important;
            break-after: page !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: 2cm !important;
            width: 100% !important;
            max-width: 100% !important;
            visibility: visible !important;
          }
          .page-break-after-always * {
            visibility: visible !important;
          }
        }
      `}</style>

      {/* Slide drawer / overlay modal for loading documents */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-zinc-200 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider font-display flex items-center gap-2">
                <Upload className="h-4.5 w-4.5 text-zinc-700" />
                Carregar Documento no Processo {processo.numero}
              </h3>
              <button
                onClick={() => setShowUploadForm(false)}
                className="text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1 rounded bg-zinc-100 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSubmitDocument} className="p-5 space-y-4">
              {uploadError && (
                <div className="rounded-xl bg-red-50 p-3 border border-red-100 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100 text-xs text-emerald-700 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Drag n drop simulated file picker of files */}
              <div 
                className="border-2 border-dashed border-zinc-200 rounded-xl p-4 text-center hover:border-zinc-400/80 transition-all cursor-pointer bg-zinc-50/20"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-9 w-9 bg-zinc-100 rounded-xl flex items-center justify-center mx-auto mb-2 text-zinc-500 border border-zinc-200/50">
                  <Upload className="h-4 w-4" />
                </div>
                <span className="block text-xs font-semibold text-zinc-800">
                  {nomeDocumento ? `Selecionado: ${nomeDocumento}` : 'Carregar ficheiro do computador'}
                </span>
                <span className="block text-[10px] text-zinc-400 mt-1">
                  Arraste para aqui o ficheiro ou clique para selecionar (PDF, TXT, DOCX)
                </span>
                <input
                  type="file"
                  id="processo-doc-file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Manual Fields validation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="form-doc-name" className="block text-xs font-medium text-zinc-600 mb-1">
                    Nome do Documento / Título
                  </label>
                  <input
                    type="text"
                    id="form-doc-name"
                    required
                    value={nomeDocumento}
                    onChange={(e) => setNomeDocumento(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden"
                    placeholder="ex: Procuracao_Forense"
                  />
                </div>

                <div>
                  <label htmlFor="form-doc-cat" className="block text-xs font-medium text-zinc-600 mb-1">
                    Categoria do Documento
                  </label>
                  <select
                    id="form-doc-cat"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden"
                  >
                    {getProcessAllowedActs(processo).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional Court Fee Fields */}
              {categoria.toLowerCase() === 'taxa de justiça' && (
                <div className="bg-blue-50/50 border border-blue-200 p-3.5 rounded-xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-blue-900">
                    <span className="text-base">💼</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Metadados de Taxa de Justiça</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label htmlFor="tax-val" className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Valor Pago (€) *
                      </label>
                      <input
                        type="number"
                        id="tax-val"
                        required
                        step="0.01"
                        min="0"
                        value={valorTaxaJustica}
                        onChange={(e) => setValorTaxaJustica(e.target.value)}
                        placeholder="ex: 124.50"
                        className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label htmlFor="tax-payer" className="block text-[11px] font-semibold text-zinc-700 mb-1">
                        Parte de Custas Pagante / Sujeito *
                      </label>
                      <select
                        id="tax-payer"
                        required
                        value={pagadorTaxaJustica}
                        onChange={(e) => setPagadorTaxaJustica(e.target.value)}
                        className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden cursor-pointer"
                      >
                        <option value="">-- Selecione uma parte do processo --</option>
                        {processo.autores.map((aut) => (
                          <option key={aut} value={`Autor (${aut})`}>{`Autor: ${aut}`}</option>
                        ))}
                        {processo.reus.map((reu) => (
                          <option key={reu} value={`Réu (${reu})`}>{`Réu: ${reu}`}</option>
                        ))}
                        <option value="Outro / Terceiro">Outro / Terceiro</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Text Field for Document Summary shown when any document classification is selected */}
              {categoria && (
                <div className="bg-amber-50/20 border border-amber-200/50 p-3.5 rounded-xl space-y-1.5 animate-in fade-in duration-200 shadow-3xs">
                  <label htmlFor="form-doc-summary" className="block text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span>Resumo / Síntese do Documento <span className="text-[10px] text-amber-600 font-normal font-sans">(Querendo - Opcional)</span></span>
                  </label>
                  <textarea
                    id="form-doc-summary"
                    rows={2}
                    value={resumoDocumento}
                    onChange={(e) => setResumoDocumento(e.target.value)}
                    placeholder="Escreva um breve resumo dos factos principais (ex: 'Oposição formal ao pedido cível com fundamento na validade do contrato, cláusula 12...')"
                    className="block w-full rounded-lg border border-amber-200 p-2.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden font-sans placeholder-zinc-400"
                  />
                  <p className="text-[9.5px] text-zinc-450 leading-relaxed">
                    💡 O resumo aparecerá exposto logo abaixo dos metadados do documento.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="form-doc-part" className="block text-xs font-medium text-zinc-600 mb-1">
                    Parte Apresentante
                  </label>
                  <select
                    id="form-doc-part"
                    value={parteApresentante}
                    onChange={(e) => setParteApresentante(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden"
                  >
                    {partesDisponiveis.map((item, idx) => (
                      <option key={idx} value={item}>{item}</option>
                    ))}
                    <option value="Outra Parte / Terceiro">Outra Parte / Terceiro</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="form-doc-lawyer" className="block text-xs font-medium text-zinc-600 mb-1">
                    Quem pratica o ato
                  </label>
                  <select
                    id="form-doc-lawyer"
                    value={advogadoApresentante}
                    onChange={(e) => setAdvogadoApresentante(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden"
                  >
                    {advogadosDisponiveis.map((item, idx) => (
                      <option key={idx} value={item}>{item}</option>
                    ))}
                    <option value="Sem mandatário (Próprio)">Sem mandatário (Próprio)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="form-doc-date" className="block text-xs font-medium text-zinc-600 mb-1">
                  Data de Apresentação
                </label>
                <input
                  type="date"
                  id="form-doc-date"
                  required
                  value={dataApresentacao}
                  onChange={(e) => setDataApresentacao(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label htmlFor="form-doc-content" className="block text-xs font-medium text-zinc-600 mb-1">
                  Conteúdo / Sumário do Documento (Texto ou Markdown)
                </label>
                <textarea
                  id="form-doc-content"
                  rows={4}
                  value={conteudoTexto}
                  onChange={(e) => setConteudoTexto(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 bg-white focus:border-zinc-950 focus:outline-hidden font-mono text-zinc-800 leading-relaxed"
                  placeholder="Escreva ou cole aqui a redação do documento ou declarações..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer font-display"
                >
                  Indexar Documento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT EDIT OVERLAY MODAL */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                ✏️ Editar Elementos do Documento
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="text-zinc-400 hover:text-zinc-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3.5 text-xs text-zinc-700">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Nome do Ficheiro *</label>
                <input
                  type="text"
                  value={editingDoc.nome}
                  onChange={(e) => setEditingDoc({ ...editingDoc, nome: e.target.value })}
                  className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Classificação / Tipo *</label>
                <select
                  value={editingDoc.categoria}
                  onChange={(e) => setEditingDoc({ ...editingDoc, categoria: e.target.value })}
                  className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden cursor-pointer"
                >
                  {getProcessAllowedActs(processo).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Data de Apresentação *</label>
                <input
                  type="date"
                  value={editingDoc.dataApresentacao}
                  onChange={(e) => setEditingDoc({ ...editingDoc, dataApresentacao: e.target.value })}
                  className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Resumo / Síntese do Documento</label>
                <textarea
                  rows={3}
                  value={editingDoc.resumo || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, resumo: e.target.value })}
                  placeholder="Escreva um breve resumo do documento..."
                  className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Parte Apresentante</label>
                  <select
                    value={['Juízo', 'Magistrado'].includes(editingDoc.parteApresentante || '') ? editingDoc.parteApresentante : 'Outro'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Juízo') {
                        setEditingDoc({
                          ...editingDoc,
                          parteApresentante: 'Juízo',
                          advogadoApresentante: getProcessClerk()
                        });
                      } else if (val === 'Magistrado') {
                        setEditingDoc({
                          ...editingDoc,
                          parteApresentante: 'Magistrado',
                          advogadoApresentante: getProcessJudge()
                        });
                      } else {
                        setEditingDoc({
                          ...editingDoc,
                          parteApresentante: ''
                        });
                      }
                    }}
                    className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden bg-white"
                  >
                    <option value="Juízo">Juízo</option>
                    <option value="Magistrado">Magistrado</option>
                    <option value="Outro">Outro (Texto Livre)</option>
                  </select>
                  {!['Juízo', 'Magistrado'].includes(editingDoc.parteApresentante || '') && (
                    <input
                      type="text"
                      value={editingDoc.parteApresentante || ''}
                      placeholder="Parte apresentante livre..."
                      onChange={(e) => setEditingDoc({ ...editingDoc, parteApresentante: e.target.value })}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden mt-1 bg-white"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold uppercase mb-1">Quem pratica o ato</label>
                  {editingDoc.parteApresentante === 'Juízo' ? (
                    <select
                      value={editingDoc.advogadoApresentante || ''}
                      onChange={(e) => setEditingDoc({ ...editingDoc, advogadoApresentante: e.target.value })}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden bg-white"
                    >
                      {getFuncionarios().map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                      {currentUser?.username && !getFuncionarios().includes(currentUser.username) && (
                        <option value={currentUser.username}>{currentUser.username}</option>
                      )}
                      {editingDoc.advogadoApresentante && !getFuncionarios().includes(editingDoc.advogadoApresentante) && (
                        <option value={editingDoc.advogadoApresentante}>{editingDoc.advogadoApresentante}</option>
                      )}
                    </select>
                  ) : editingDoc.parteApresentante === 'Magistrado' ? (
                    <select
                      value={editingDoc.advogadoApresentante || ''}
                      onChange={(e) => setEditingDoc({ ...editingDoc, advogadoApresentante: e.target.value })}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden bg-white"
                    >
                      {getJuizes().map(j => (
                        <option key={j} value={j}>{j}</option>
                      ))}
                      {editingDoc.advogadoApresentante && !getJuizes().includes(editingDoc.advogadoApresentante) && (
                        <option value={editingDoc.advogadoApresentante}>{editingDoc.advogadoApresentante}</option>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={editingDoc.advogadoApresentante || ''}
                      placeholder="Nome de quem pratica o ato..."
                      onChange={(e) => setEditingDoc({ ...editingDoc, advogadoApresentante: e.target.value })}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-1.8 text-xs focus:border-zinc-950 focus:outline-hidden bg-white"
                    />
                  )}
                </div>
              </div>

              {editingDoc.categoria.toLowerCase() === 'taxa de justiça' && (
                <div className="bg-blue-50/50 border border-blue-200 p-3 rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-blue-950 uppercase">Metadados de Taxa de Justiça</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Valor Pago (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingDoc.valorTaxaJustica || 0}
                        onChange={(e) => setEditingDoc({ ...editingDoc, valorTaxaJustica: parseFloat(e.target.value) || 0 })}
                        className="block w-full rounded bg-white border border-zinc-205 px-2 py-1 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Sujeito Pagante</label>
                      <input
                        type="text"
                        value={editingDoc.pagadorTaxaJustica || ''}
                        onChange={(e) => setEditingDoc({ ...editingDoc, pagadorTaxaJustica: e.target.value })}
                        className="block w-full rounded bg-white border border-zinc-205 px-2 py-1 text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              )}

               {/* SECTION: CO-EDIÇÃO DE DOCUMENTOS ANEXOS */}
               <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 mt-1 shadow-3xs">
                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-slate-205 pb-1.5">
                   <span className="block text-[10px] text-zinc-900 font-extrabold uppercase tracking-wider font-display">
                     📎 DOCUMENTOS ANEXOS ({editDocAnnexes.length})
                   </span>
                   <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg cursor-pointer transition-all border border-blue-200/50 hover:border-blue-300">
                     <Plus className="h-2.5 w-2.5" />
                     Anexar Outro Documento
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            Array.from(files).forEach((file: any, index) => {
                              const reader = new FileReader();
                              const sizeKb = (file.size / 1024).toFixed(1);
                              let guessedCategory = 'Documento de Apoio';
                              const nameLower = file.name.toLowerCase();
                              if (nameLower.includes('peticao') || nameLower.includes('peticão') || nameLower.includes('pi')) guessedCategory = 'Petição Inicial';
                              else if (nameLower.includes('contestacao') || nameLower.includes('contestação')) guessedCategory = 'Contestação';
                              else if (nameLower.includes('requerimento')) guessedCategory = 'Requerimento';
                              else if (nameLower.includes('procuracao') || nameLower.includes('procuração')) guessedCategory = 'Procuração';
                              else if (nameLower.includes('taxa') || nameLower.includes('custas') || nameLower.includes('pagamento')) guessedCategory = 'Taxa de Justiça';
                              else if (nameLower.includes('identificacao') || nameLower.includes('id') || nameLower.includes('cc')) guessedCategory = 'Documento de Identificação';

                              reader.onload = (evt) => {
                                const dataUrl = (evt.target?.result as string) || '';
                                const simulatedText = `[Ficheiro complementar anexado: ${file.name} - ${sizeKb} KB]\n\nCONTEÚDO DIGITAL SECURE - Este ficheiro (${file.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente.`;
                                const newSubDoc: Documento = {
                                  id: `doc-sub-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
                                  conteudoUrl: dataUrl.startsWith('data:') ? dataUrl : undefined,
                                  nome: file.name,
                                  categoria: guessedCategory,
                                  conteudoTexto: simulatedText,
                                  tamanho: `${sizeKb} KB`,
                                  tipoMime: file.type || 'application/pdf',
                                  parentDocId: editingDoc.id,
                                  isAnexoDoc: true,
                                  dataApresentacao: editingDoc.dataApresentacao,
                                  parteApresentante: editingDoc.parteApresentante,
                                  advogadoApresentante: editingDoc.advogadoApresentante,
                                  createdAt: new Date().toISOString()
                                };
                                setEditDocAnnexes(prev => [...prev, newSubDoc]);
                              };
                              reader.readAsDataURL(file);
                            });
                          }
                          e.target.value = '';
                        }}
                      />
                   </label>
                 </div>

                 {editDocAnnexes.length === 0 ? (
                   <div className="text-center py-3 bg-white/50 rounded-xl border border-zinc-150 text-slate-400 italic text-[10px]">
                     Nenhum anexo complementar associado.
                   </div>
                 ) : (
                   <div className="space-y-2 max-h-[160px] overflow-y-auto pr-0.5 flex flex-col">
                     {editDocAnnexes.map((subDoc, idx) => (
                       <div key={subDoc.id} className="p-3 bg-white border border-zinc-200 rounded-xl space-y-2 relative">
                         <div className="flex justify-between items-center bg-slate-50 border-b border-zinc-150 -mx-3 -mt-3 px-3 py-1.5 rounded-t-xl">
                           <span className="text-[9px] font-black text-slate-905 uppercase font-mono">
                             📎 Anexo #{idx + 1}
                           </span>
                           <button
                             type="button"
                             onClick={() => {
                               setEditDocAnnexes(prev => prev.filter(d => d.id !== subDoc.id));
                             }}
                             className="text-rose-650 hover:text-rose-800 text-[9.5px] font-bold cursor-pointer"
                           >
                             Excluir Anexo
                           </button>
                         </div>
                         <div className="grid grid-cols-2 gap-2 text-xs">
                           <div>
                             <label className="block text-[8px] text-zinc-400 font-bold uppercase mb-0.5">Nome do Anexo *</label>
                             <input
                               type="text"
                               value={subDoc.nome}
                               onChange={(e) => {
                                 const updated = [...editDocAnnexes];
                                 updated[idx].nome = e.target.value;
                                 setEditDocAnnexes(updated);
                               }}
                               className="w-full bg-white border border-zinc-200 rounded p-1 text-[11px] focus:outline-hidden"
                             />
                           </div>
                           <div>
                             <label className="block text-[8px] text-zinc-400 font-bold uppercase mb-0.5">Tipo</label>
                             <select
                               value={subDoc.categoria}
                               onChange={(e) => {
                                 const updated = [...editDocAnnexes];
                                 updated[idx].categoria = e.target.value;
                                 setEditDocAnnexes(updated);
                               }}
                               className="w-full bg-white border border-zinc-200 rounded p-1 text-[11px] cursor-pointer focus:outline-hidden"
                             >
                               <option value="Documento de Prova">Documento de Prova</option>
                               <option value="Comprovativo de Pagamento">Comprovativo de Pagamento</option>
                               <option value="Guia de Custas">Guia de Custas</option>
                               <option value="Relatório Técnico">Relatório Técnico</option>
                               <option value="Parecer Jurídico">Parecer Jurídico</option>
                               <option value="Outro">Outro Documento de Apoio</option>
                             </select>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  let updatedDocs = processo.documentos.map(d => d.id === editingDoc.id ? editingDoc : d);
                  
                  // Add/update editDocAnnexes
                  editDocAnnexes.forEach(clone => {
                    const exists = updatedDocs.some(d => d.id === clone.id);
                    if (exists) {
                      updatedDocs = updatedDocs.map(d => d.id === clone.id ? clone : d);
                    } else {
                      updatedDocs.push(clone);
                    }
                  });

                  // Delete removed annexes
                  processo.documentos.forEach(origDoc => {
                    if (!origDoc.deleted && origDoc.parentDocId === editingDoc.id) {
                      const isStillPresent = editDocAnnexes.some(ec => ec.id === origDoc.id);
                      if (!isStillPresent) {
                        updatedDocs = updatedDocs.map(d => d.id === origDoc.id ? { ...d, deleted: true, deletedAt: new Date().toISOString() } : d);
                        if (currentUser) logAction(currentUser.username, 'Eliminação de documento', processo.numero, `Documento ${origDoc.nome} eliminado.`);
                      }
                    }
                  });

                  if (onUpdateProcesso) {
                    onUpdateProcesso({ ...processo, documentos: updatedDocs });
                  }
                  setEditingDoc(null);
                  alert('Documento alterado e salvo com sucesso!');
                }}
                className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACT & DOCUMENTS EDIT OVERLAY MODAL */}
      {editingAct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 maxHeightSheet max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2 shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5 font-display">
                ✏️ Editar Ato Judiciário e Documentos Juntos
              </h3>
              <button
                type="button"
                onClick={() => setEditingAct(null)}
                className="text-zinc-400 hover:text-zinc-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-zinc-700">
              {/* SECTION A: ACT METADATA FIELDS */}
              <div className="bg-purple-50/20 border border-purple-100 rounded-2xl p-4.5 space-y-3">
                <span className="block text-[10px] text-purple-900 font-extrabold uppercase tracking-wider mb-1 font-display">
                  🟣 ELEMENTOS PRINCIPAIS DO ATO / EVENTO
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9.5px] text-zinc-500 font-bold uppercase mb-0.5">Tipo de Ato / Classificação *</label>
                    <select
                      value={editActTipoCode}
                      onChange={(e) => setEditActTipoCode(e.target.value)}
                      className="w-full bg-white p-2 border border-zinc-250 rounded-lg focus:outline-hidden font-semibold cursor-pointer"
                    >
                      {getProcessAllowedActs(processo).map((classification) => (
                        <option key={classification} value={classification}>
                          {classification}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-zinc-500 font-bold uppercase mb-0.5">Data Ocorrência *</label>
                    <input
                      type="date"
                      value={editActDateStr}
                      onChange={(e) => setEditActDateStr(e.target.value)}
                      className="w-full bg-white p-2 border border-zinc-250 rounded-lg font-mono focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9.5px] text-zinc-500 font-bold uppercase mb-0.5">Fase do Processo</label>
                    <select
                      value={editActFaseCode}
                      onChange={(e) => setEditActFaseCode(e.target.value)}
                      className="w-full bg-white p-2 border border-zinc-250 rounded-lg focus:outline-hidden text-xs cursor-pointer"
                    >
                      {getProcessAllowedPhases(processo).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-zinc-500 font-bold uppercase mb-0.5">Parte Associada</label>
                    <select
                      value={editActPartePrat}
                      onChange={(e) => {
                        const newParte = e.target.value;
                        setEditActPartePrat(newParte);
                        const opts = getQuemPraticaOptions(newParte);
                        if (opts.length > 0) {
                          setEditActAdvPrat(opts[0]);
                        } else {
                          setEditActAdvPrat('');
                        }
                      }}
                      className="w-full bg-white p-2 border border-zinc-250 rounded-lg focus:outline-hidden text-xs cursor-pointer"
                    >
                      <option value="">Nenhuma / Tribunal</option>
                      {partesDisponiveis.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-zinc-500 font-bold uppercase mb-0.5">Quem Pratica o Ato (Se aplicável)</label>
                    <select
                      value={editActAdvPrat}
                      onChange={(e) => setEditActAdvPrat(e.target.value)}
                      className="w-full bg-white p-2 border border-zinc-250 rounded-lg focus:outline-hidden text-xs cursor-pointer"
                    >
                      <option value="">Nenhum / Secretaria Judicial</option>
                      {getQuemPraticaOptions(editActPartePrat).map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9.5px] text-zinc-500 font-bold uppercase mb-0.5">Súmula / Descrição Detalhada do Ato *</label>
                  <textarea
                    value={editActDescStr}
                    onChange={(e) => setEditActDescStr(e.target.value)}
                    rows={2.5}
                    className="w-full bg-white p-2 border border-zinc-250 rounded-lg focus:outline-hidden text-xs leading-normal"
                    placeholder="Descrição formal..."
                    required
                  />
                </div>
              </div>

               {/* SECTION B: DOCUMENTS JUNTOS (ATTACHED DOCUMENTS CO-EDITING) */}
               <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/60 pb-2">
                   <span className="block text-[10px] text-slate-900 font-extrabold uppercase tracking-wider font-display">
                     📎 CO-EDIÇÃO DE DOCUMENTOS JUNTOS / ANEXOS ({editActDocsClones.length})
                   </span>
                   <button type="button" onClick={() => editActFileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] font-bold rounded-lg cursor-pointer transition-all border border-purple-200/50 hover:border-purple-300">
                     <Plus className="h-3 w-3" />
                     Anexar Novo Ficheiro</button><input ref={editActFileInputRef} type="file" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (files && files.length > 0) { Array.from(files).forEach((file: any, index) => { const reader = new FileReader(); const sizeKb = (file.size / 1024).toFixed(1); let guessedCategory = 'Documento de Apoio'; const nameLower = file.name.toLowerCase(); if (nameLower.includes('peticao') || nameLower.includes('peticão') || nameLower.includes('pi')) guessedCategory = 'Petição Inicial'; else if (nameLower.includes('contestacao') || nameLower.includes('contestação')) guessedCategory = 'Contestação'; else if (nameLower.includes('requerimento')) guessedCategory = 'Requerimento'; else if (nameLower.includes('procuracao') || nameLower.includes('procuração')) guessedCategory = 'Procuração'; else if (nameLower.includes('taxa') || nameLower.includes('custas') || nameLower.includes('pagamento')) guessedCategory = 'Taxa de Justiça'; else if (nameLower.includes('identificacao') || nameLower.includes('id') || nameLower.includes('cc')) guessedCategory = 'Documento de Identificação'; reader.onload = (evt) => { const dataUrl = (evt.target?.result as string) || ''; const simulatedText = `[Ficheiro real importado: ${file.name} - ${sizeKb} KB]\n\nCONTEÚDO DIGITAL SECURE - Este ficheiro (${file.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente.`; const newDoc: Documento = { id: `doc-new-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`, conteudoUrl: dataUrl.startsWith('data:') ? dataUrl : undefined, nome: file.name, categoria: guessedCategory, conteudoTexto: simulatedText, tamanho: `${sizeKb} KB`, tipoMime: file.type || 'application/pdf', dataApresentacao: editActDateStr || new Date().toISOString().split('T')[0], parteApresentante: editActPartePrat || 'Outro', advogadoApresentante: editActAdvPrat || 'Advogado', createdAt: new Date().toISOString() }; setEditActDocsClones(prev => [...prev, newDoc]); }; reader.readAsDataURL(file); }); } e.target.value = ''; }} />
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            Array.from(files).forEach((file: any, index) => {
                              const reader = new FileReader();
                              const sizeKb = (file.size / 1024).toFixed(1);
                              let guessedCategory = 'Documento de Apoio';
                              const nameLower = file.name.toLowerCase();
                              if (nameLower.includes('peticao') || nameLower.includes('peticão') || nameLower.includes('pi')) guessedCategory = 'Petição Inicial';
                              else if (nameLower.includes('contestacao') || nameLower.includes('contestação')) guessedCategory = 'Contestação';
                              else if (nameLower.includes('requerimento')) guessedCategory = 'Requerimento';
                              else if (nameLower.includes('procuracao') || nameLower.includes('procuração')) guessedCategory = 'Procuração';
                              else if (nameLower.includes('taxa') || nameLower.includes('custas') || nameLower.includes('pagamento')) guessedCategory = 'Taxa de Justiça';
                              else if (nameLower.includes('identificacao') || nameLower.includes('id') || nameLower.includes('cc')) guessedCategory = 'Documento de Identificação';

                              reader.onload = (evt) => {
                                const dataUrl = (evt.target?.result as string) || '';
                                const simulatedText = `[Ficheiro real importado: ${file.name} - ${sizeKb} KB]\n\nCONTEÚDO DIGITAL SECURE - Este ficheiro (${file.name}) foi carregado com sucesso a partir do dispositivo do utilizador e guardado de forma persistente.`;
                                const newDoc: Documento = {
                                  id: `doc-new-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
                                  conteudoUrl: dataUrl.startsWith('data:') ? dataUrl : undefined,
                                  nome: file.name,
                                  categoria: guessedCategory,
                                  conteudoTexto: simulatedText,
                                  tamanho: `${sizeKb} KB`,
                                  tipoMime: file.type || 'application/pdf',
                                  dataApresentacao: editActDateStr || new Date().toISOString().split('T')[0],
                                  parteApresentante: editActPartePrat || 'Outro',
                                  advogadoApresentante: editActAdvPrat || 'Advogado',
                                  createdAt: new Date().toISOString()
                                };
                                setEditActDocsClones(prev => [...prev, newDoc]);
                              };
                              reader.readAsDataURL(file);
                            });
                          }
                          e.target.value = '';
                        }}
                      />
                    <></>
                 </div>

                {editActDocsClones.length === 0 ? (
                  <div className="text-center py-4 bg-white/50 rounded-xl border border-zinc-150 text-slate-400 italic font-medium">
                    Sem documentos anexos a este ato processual.
                  </div>
                ) : (
                  <div className="space-y-3 flex flex-col">
                    {editActDocsClones.map((doc, idx) => (
                      <div key={doc.id} className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-3 shadow-3xs relative overflow-hidden">
                        <div className="flex justify-between items-center bg-slate-100/50 -mx-3.5 -mt-3.5 p-2.5 px-3.5 border-b border-zinc-150 shrink-0">
                          <span className="text-[10px] font-black text-slate-900 uppercase font-mono">
                            📄 Documento #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditActDocsClones(prev => prev.filter(d => d.id !== doc.id));
                            }}
                            className="text-rose-650 hover:text-rose-800 text-[9.5px] font-bold cursor-pointer"
                            title="Remover este documento da lista de anexos deste ato"
                          >
                            Remover Conexão
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 text-xs text-zinc-700">
                          <div>
                            <label className="block text-[9px] text-zinc-400 font-bold uppercase mb-0.5">Nome do Ficheiro *</label>
                            <input
                              type="text"
                              value={doc.nome}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditActDocsClones(prev => prev.map((d, i) => i === idx ? { ...d, nome: val } : d));
                              }}
                              className="w-full bg-white border border-zinc-200 rounded p-1 text-xs focus:ring-1 focus:ring-blue-100 focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] text-zinc-400 font-bold uppercase mb-0.5">Classificação</label>
                            <select
                              value={doc.categoria}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditActDocsClones(prev => prev.map((d, i) => i === idx ? { ...d, categoria: val } : d));
                              }}
                              className="w-full bg-white border border-zinc-200 rounded p-1 text-xs cursor-pointer focus:outline-hidden"
                            >
                              {getProcessAllowedActs(processo).map((classification) => (
                                <option key={classification} value={classification}>
                                  {classification}
                                  </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-[9px] text-zinc-400 font-bold uppercase mb-0.5">Súmula / Resumo do Ficheiro</label>
                          <textarea
                            value={doc.resumo || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditActDocsClones(prev => prev.map((d, i) => i === idx ? { ...d, resumo: val } : d));
                            }}
                            rows={1.5}
                            className="w-full bg-white border border-zinc-200 rounded p-1 text-xs focus:outline-hidden leading-relaxed"
                            placeholder="Resumo do documento..."
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] text-zinc-400 font-bold uppercase mb-0.5 font-mono">Conteúdos Textuais de OCR extraídos (Editável)</label>
                          <textarea
                            value={doc.conteudoTexto || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditActDocsClones(prev => prev.map((d, i) => i === idx ? { ...d, conteudoTexto: val } : d));
                            }}
                            rows={2.5}
                            className="w-full bg-white border border-zinc-200 rounded p-1 text-[11px] font-mono leading-relaxed"
                            placeholder="Carregando dados digitais do tribunal virtual..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Associar documento do processo que está com status solto */}
                {processo.documentos.filter(d => !d.deleted && !editActDocsClones.some(ec => ec.id === d.id)).length > 0 && (
                  <div className="mt-3.5 pt-2 border-t border-dashed border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase font-display">📎 Linkar ficheiro administrativo existente do processo:</span>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const docToAdd = processo.documentos.find(d => d.id === val);
                          if (docToAdd) {
                            setEditActDocsClones(prev => [...prev, JSON.parse(JSON.stringify(docToAdd))]);
                          }
                        }
                      }}
                      className="bg-white border border-zinc-250 rounded-lg text-xs p-1 px-2 select-none w-full sm:max-w-[220px]"
                      value=""
                    >
                      <option value="">-- Escolher Doc --</option>
                      {processo.documentos.filter(d => !d.deleted && !editActDocsClones.some(ec => ec.id === d.id)).map(d => (
                        <option key={d.id} value={d.id}>{d.nome} ({d.categoria})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 shrink-0">
              <button
                type="button"
                onClick={() => setEditingAct(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditAct}
                className="px-4 py-2 bg-purple-650 hover:bg-purple-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-3xs"
              >
                Gravar Modificações do Ato e Documentos
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
