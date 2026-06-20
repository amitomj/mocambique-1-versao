/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'administrador' | 'utilizador';

export interface Tribunal {
  id: string; // Dynamic ID, e.g. UUID
  localidade: string;
  tribunal: string;
  imagemCabecalho?: string; // base64 or placeholder URL
}

export interface FormModelo {
  id: string; // Dynamic ID, e.g. UUID
  nome: string;
  texto: string; // Draft Template Text content
  tribunalId?: string; // Optional default court ID
}

export interface ProcessNotificacao {
  id: string; // Dynamic ID
  processoNumero: string;
  formModeloId: string;
  tribunalId: string; // Selected court ID for headers
  destinatarios: { nome: string; morada: string }[]; // Recipient details taken at creation time
  textoEditado: string; // Modified text for this process notification
  dataCriacao: string;
  criadoPorFuncionario?: string; // Name of the clerk who created the notification
  documentosAnexosIds?: string[]; // IDs of associated supplementary/annexed documents
  deleted?: boolean; // Soft delete flag
  deletedAt?: string; // Date of deletion
}

export interface User {
  username: string;
  role: UserRole;
  password?: string; // Stored safely in local SQLite-first mock DB
  createdAt: string;
  tribunalId?: string; // Association with a Court
}

export interface HistoricoAto {
  id: string;
  data: string;
  descricao: string;
  fase: string;
  tipoAto?: string; // Custom type of act (e.g. Audiência, Notificação)
  documentosIds?: string[]; // IDs of associated documents
  parteAssociada?: string; // Associated party name
  advogadoPraticante?: string; // Practicing lawyer name
  createdAt: string;
}

export interface Documento {
  id: string;
  nome: string;
  categoria: string;
  dataApresentacao: string;
  parteApresentante: string;
  advogadoApresentante: string;
  conteudoUrl?: string; // Optional real URL or base64 data URL
  conteudoTexto?: string; // Simulated text/markdown preview
  tamanho: string;
  tipoMime: string;
  resumo?: string; // Optional document summary
  valorTaxaJustica?: number; // Paid court fee amount
  pagadorTaxaJustica?: string; // Member name of plaintiff/defendant who paid
  deleted?: boolean; // Soft delete flag
  deletedAt?: string; // Date of deletion
  notificacaoId?: string; // Association with a created notification
  createdAt?: string; // High-precision creation ISO timestamp
  criadoPor?: string; // Clerk or Judge name who produced this document/despacho
  parentDocId?: string; // Association to main document for attachments
  isAnexoDoc?: boolean; // Flag to indicate if this is a supplementary attachment
  isCriadoNaApp?: boolean; // Flag indicating if created inside the app
}

export interface Processo {
  id?: string; // Dynamic ID for DB sync
  numero: string; // Unique process identifier
  autores: string[]; // List of plaintiffs
  reus: string[]; // List of defendants
  dataAutuacao: string; // Action filing date
  juizTitular: string; // Appointed judge
  advogadosAutor: string[]; // List of plaintiff lawyers
  advogadosReu: string[]; // List of defendant lawyers
  procuradores?: string[]; // List of procuratories/attorneys
  funcionarios?: string[]; // List of associated responsible officers/clerks
  notificacoesDestinatarios?: string[]; // List of people (advogados/procuradores) designated to receive notifications
  documentos: Documento[];
  createdAt: string;
  parentProcessoNumero?: string; // If this process is an apenso (sub-case) of another process
  tipo?: string; // Process type (Crime, Civil or custom Area)
  especieCivel?: string; // "Processo de declaração" | "Processo de execução" | "Processos especiais"
  tipoAccaoCivel?: string; // E.g. "processo ordinário", "execução para pagamento de quantia certa", etc.
  valorAcao?: number; // Value of civel action in EUR
  alarmeData?: string; // Alert on/after this date (YYYY-MM-DD)
  alarmeAtivo?: boolean; // If alarm is enabled and silencable
  alarmeTipo?: 'automatico' | 'manual'; // Type of alarm
  alarmeNota?: string; // Details why alarmed
  alarmeSilenciado?: boolean; // Flag to indicate if automatic alarm was explicitly eliminated
  alarmeDias?: number; // Custom automatic alarm duration in days (e.g. 30, 60, 90 or custom)
  faseAtual?: string; // Process phase description
  historicoAtos?: HistoricoAto[]; // Complete registry of timeline events
  historicoEstados?: Array<{
    id: string;
    data: string;
    opcao: string;
    nota?: string;
    funcionario: string;
  }>;
  deleted?: boolean; // Soft delete flag
  deletedAt?: string; // Date of deletion
  agendaCompromissos?: Array<{
    id: string;
    titulo: string;
    dataLimite: string;
    destinatario?: string;
    responsavel?: string;
    fase?: string;
    createdAt: string;
  }>;
}

export interface SQLiteLog {
  timestamp: string;
  query: string;
  params?: string;
  impact: string;
}
