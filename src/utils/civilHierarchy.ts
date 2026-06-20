/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CivilActionType {
  nome: string;
  atos: string[];
  fases?: string[]; // Custom phases for this specific action type
  deleted?: boolean;
  deletedAt?: string;
}

export interface CivilEspecie {
  especie: string;
  accoes: CivilActionType[];
  deleted?: boolean;
  deletedAt?: string;
}

export const DEFAULT_FASES = [
  "Instrução / Articulados",
  "Fase de Saneamento",
  "Coleção de Provas / Inquérito",
  "Audiência de Julgamento",
  "Sentença / Decisão Final",
  "Fase de Recurso",
  "Fase Executiva"
];

const INITIAL_CIVIL_HIERARCHY: CivilEspecie[] = [
  {
    especie: "Processo de declaração",
    accoes: [
      {
        nome: "processo ordinário",
        atos: [
          "Petição Inicial",
          "Citação",
          "Contestação",
          "Contestação com Reconvenção",
          "Réplica",
          "Tréplica",
          "Articulado Superveniente",
          "Resposta ao Articulado Superveniente",
          "Audiência Preliminar",
          "Dispensa de Audiência Preliminar",
          "Tentativa de Conciliação",
          "Despacho Saneador",
          "Selecção da Matéria de Facto",
          "Indicação das Provas",
          "Alteração do Rol de Testemunhas",
          "Produção Antecipada de Provas",
          "Relatório Pericial Singular",
          "Relatório Pericial Colegial",
          "Inspecção Judicial",
          "Acta de Audiência e Julgamento - Juiz Singular",
          "Acta de Audiência e Julgamento - Tribunal Colectivo",
          "Julgamento da Matéria de Facto",
          "Sentença",
          "Sentença - Rectificação de Erros Materiais",
          "Sentença - Esclarecimento ou Reforma da Sentença",
          "Recurso",
          "Recurso - Apelação",
          "Recurso - Revista",
          "Recurso - Revista Excepcional",
          "Recurso - Revisão",
          "Recurso - Despacho sobre o Requerimento de Recurso",
          "Recurso - Reclamação contra o Indeferimento do Recurso",
          "Recurso - Caução",
          "Recurso - Junção de Documentos com as Alegações",
          "Acórdão",
          "Acórdão - Reforma do Acórdão em Caso de Nulidades",
          "Uniformização de Jurisprudência",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "processo sumário",
        atos: [
          "Petição Inicial",
          "Citação",
          "Contestação",
          "Resposta à Contestação",
          "Resposta à Reconvenção",
          "Audiência Preliminar",
          "Dispensa de Audiência Preliminar",
          "Tentativa de Conciliação",
          "Despacho Saneador",
          "Selecção da Matéria de Facto",
          "Indicação das Provas",
          "Alteração do Rol de Testemunhas",
          "Acta de Audiência e Julgamento - Juiz Singular",
          "Julgamento da Matéria de Facto",
          "Sentença",
          "Sentença - Rectificação de Erros Materiais",
          "Sentença - Esclarecimento ou Reforma da Sentença",
          "Recurso",
          "Recurso - Apelação",
          "Recurso - Revista",
          "Recurso - Revista Excepcional",
          "Recurso - Revisão",
          "Recurso - Despacho sobre o Requerimento de Recurso",
          "Recurso - Reclamação contra o Indeferimento do Recurso",
          "Recurso - Caução",
          "Recurso - Junção de Documentos com as Alegações",
          "Acórdão",
          "Acórdão - Reforma do Acórdão em Caso de Nulidades",
          "Uniformização de Jurisprudência",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "processo sumaríssimo",
        atos: [
          "Petição Inicial",
          "Citação",
          "Contestação",
          "Acta de Audiência e Julgamento - Juiz Singular",
          "Julgamento da Matéria de Facto",
          "Sentença",
          "Sentença - Rectificação de Erros Materiais",
          "Sentença - Esclarecimento ou Reforma da Sentença"
        ]
      }
    ]
  },
  {
    especie: "Processo de execução",
    accoes: [
      {
        nome: "execução para pagamento de quantia certa",
        atos: [
          "Requerimento Executivo",
          "Recusa do Requerimento",
          "Designação de Solicitador de Execução",
          "Despacho Liminar e Citação Prévia",
          "Dispensa de Despacho Liminar",
          "Dispensa da Citação Prévia",
          "Oposição à Execução",
          "Oposição à Penhora",
          "Penhora",
          "Auto de Penhora",
          "Conversão do Arresto em Penhora",
          "Levantamento da Penhora",
          "Citação",
          "Reclamação de Créditos",
          "Impugnação de Créditos Reclamados",
          "Resposta do Reclamante",
          "Pagamento",
          "Adjudicação de Bens ao Exequente",
          "Consignação de Rendimentos",
          "Pagamento em Prestações",
          "Venda",
          "Venda - Determinação da Modalidade e do Valor Base dos Bens",
          "Venda - Venda Antecipada de Bens",
          "Venda - Dispensa de Depósito aos Credores",
          "Venda - Cancelamento dos Registos",
          "Venda - Propostas em Carta Fechada",
          "Venda - Bens Vendidos nas Bolsas",
          "Venda - Venda Directa",
          "Venda - Venda por Negociação Particular",
          "Venda - Venda em Estabelecimento de Leilão",
          "Venda - Irregularidades da Venda",
          "Venda - Venda em Depósito Público",
          "Venda - Anulação da Venda e Indemnização do Comprador",
          "Remição",
          "Cessação da Execução pelo Pagamento Voluntário",
          "Extinção da Execução",
          "Renovação da Execução Extinta",
          "Anulação da Execução, por Falta ou Nulidade de Citação do Executado",
          "Recurso de Apelação",
          "Recurso de Revista",
          "Acórdão"
        ]
      },
      {
        nome: "execução para entrega de coisa certa",
        atos: [
          "Requerimento Executivo",
          "Citação",
          "Oposição à Execução",
          "Suspensão da Execução",
          "Conversão da Execução",
          "Penhora",
          "Auto de Penhora",
          "Levantamento da Penhora",
          "Reclamação de Créditos",
          "Impugnação de Créditos Reclamados",
          "Resposta do Reclamante",
          "Pagamento",
          "Adjudicação de Bens ao Exequente",
          "Consignação de Rendimentos",
          "Pagamento em Prestações",
          "Venda",
          "Venda - Determinação da Modalidade e do Valor Base dos Bens",
          "Venda - Venda Antecipada de Bens",
          "Venda - Dispensa de Depósito aos Credores",
          "Venda - Cancelamento dos Registos",
          "Venda - Propostas em Carta Fechada",
          "Venda - Bens Vendidos nas Bolsas",
          "Venda - Venda Directa",
          "Venda - Venda por Negociação Particular",
          "Venda - Venda em Estabelecimento de Leilão",
          "Venda - Irregularidades da Venda",
          "Venda - Venda em Depósito Público",
          "Venda - Anulação da Venda e Indemnização do Comprador",
          "Remição",
          "Cessação da Execução pelo Pagamento Voluntário",
          "Extinção da Execução",
          "Renovação da Execução Extinta",
          "Anulação da Execução, por Falta ou Nulidade de Citação do Executado",
          "Recurso de Apelação",
          "Recurso de Revista",
          "Acórdão"
        ]
      },
      {
        nome: "execução para prestação de facto",
        atos: [
          "Requerimento Executivo",
          "Citação",
          "Oposição à Execução",
          "Fixação de Prazo para a Prestação",
          "Conversão da Execução",
          "Relatório de Avaliação do Custo da Prestação",
          "Penhora",
          "Auto de Penhora",
          "Levantamento da Penhora",
          "Reclamação de Créditos",
          "Impugnação de Créditos Reclamados",
          "Resposta do Reclamante",
          "Pagamento",
          "Adjudicação de Bens ao Exequente",
          "Consignação de Rendimentos",
          "Pagamento em Prestações",
          "Venda",
          "Venda - Determinação da Modalidade e do Valor Base dos Bens",
          "Venda - Venda Antecipada de Bens",
          "Venda - Dispensa de Depósito aos Credores",
          "Venda - Cancelamento dos Registos",
          "Venda - Propostas em Carta Fechada",
          "Venda - Bens Vendidos nas Bolsas",
          "Venda - Venda Directa",
          "Venda - Venda por Negociação Particular",
          "Venda - Venda em Estabelecimento de Leilão",
          "Venda - Irregularidades da Venda",
          "Venda - Venda em Depósito Público",
          "Venda - Anulação da Venda e Indemnização do Comprador",
          "Remição",
          "Cessação da Execução pelo Pagamento Voluntário",
          "Extinção da Execução",
          "Renovação da Execução Extinta",
          "Anulação da Execução, por Falta ou Nulidade de Citação do Executado",
          "Recurso de Apelação",
          "Recurso de Revista",
          "Acórdão"
        ]
      }
    ]
  },
  {
    especie: "Processos especiais",
    accoes: [
      {
        nome: "interdições e inabilitações",
        atos: [
          "Petição Inicial",
          "Editais",
          "Citação",
          "Designação de Curador Provisório",
          "Contestação",
          "Interrogatório do Requerido",
          "Exame Pericial",
          "Sentença",
          "Recurso de Apelação",
          "Levantamento da Interdição ou Inabilitação",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "prestação de caução",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Oposição",
          "Prestação de Caução",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "do reforço e substituição das garantias especiais das obrigações",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Oposição",
          "Reforço e Substituição da Caução",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "expurgação de hipotecas e extinção de privilégios",
        atos: [
          "Requerimento Inicial",
          "Citação dos Credores Inscritos",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "venda antecipada de penhor",
        atos: [
          "Requerimento Inicial",
          "Decisão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "prestação de contas",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Apresentação de Contas pelo Réu",
          "Contestação das Contas pelo Autor",
          "Prestação Espontânea de Contas",
          "Prestação de Contas por Dependência de Outra Causa",
          "Prestação Espontânea de Contas do Tutor ou Curador",
          "Prestação Forçada de Contas do Tutor ou Curador",
          "Prestação de Contas no Caso de Cessação da Incapacidade ou Falecimento do Incapaz",
          "Prestação de Contas Relativas a Bens de Especial Valor, do Administrator e do Adoptante",
          "Prestação de Contas do Depositário Judicial",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "consignação em depósito",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Contestação",
          "Depósito",
          "Decisão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "divisão de coisa comum e regulação e repartição de avarias marítimas",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Oposição",
          "Perícia",
          "Conferência de Interessados",
          "Decisão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "reforma de documentos, autos e livros",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Conferência de Interessados",
          "Sentença",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "acção de indemnização contra magistrados",
        atos: [
          "Petição Inicial",
          "Citação",
          "Contestação",
          "Ata de Julgamento",
          "Sentença",
          "Recurso de Apelação",
          "Recurso de Agravo",
          "Acórdão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "revisão de sentenças estrangeiras",
        atos: [
          "Petição Inicial",
          "Citação",
          "Contestação",
          "Ata de Julgamento",
          "Sentença",
          "Recurso de Revista",
          "Acórdão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "justificação de ausência",
        atos: [
          "Petição Inicial",
          "Citação Edital",
          "Contestação",
          "Ata de Julgamento",
          "Sentença",
          "Recurso de Revista",
          "Acórdão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "execução especial por alimentos",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Oposição à Execução",
          "Oposição à Penhora",
          "Ata de Julgamento",
          "Sentença",
          "Recurso de Revista",
          "Acórdão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "liquidação de patrimónios",
        atos: [
          "Requerimento Inicial",
          "Liquidação Total",
          "Liquidação Parcial e Partilha em Espécie",
          "Impossibilidade de Obter a Liquidação Total",
          "Destituição dos Liquidatários",
          "Decisão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "inventário",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Relação de Interessados",
          "Relação de Bens",
          "Reclamação à Relação de Bens",
          "Reclamação contra o Valor Atribuido aos Bens",
          "Reclamação e Verificação de Créditos",
          "Representação de Incapazes ou Ausentes",
          "Habilitação",
          "Exercício do Direito de Preferência",
          "Cumulação de Inventários",
          "Nomeação do Cabeça de Casal",
          "Conferência de Interessados",
          "Passivo da Herança",
          "Pagamento das Dívidas por Todos",
          "Pagamento das Dívidas por Alguns Interessados",
          "Insolvência da Herança",
          "Avaliação dos Bens",
          "Licitações",
          "Avaliação de Bens Doados quando Arguida a Inoficiosidade",
          "Avaliação de Bens Legados quando Arguida a Inoficiosidade",
          "Despacho sobre a Forma à Partilha",
          "Preenchimento dos Quinhões",
          "Mapa de Partilha",
          "Pagamento ou Depósito de Tornas",
          "Reclamações contra o Mapa",
          "Sorte dos Lotes",
          "Sentença Homologatória da Partilha",
          "Despacho",
          "Notificações",
          "Emenda da Partilha",
          "Anulação da Partilha"
        ]
      },
      {
        nome: "divórcio e separação litigiosos",
        atos: [
          "Petição Inicial",
          "Citação",
          "Tentativa de Conciliação",
          "Contestação",
          "Ata de Julgamento",
          "Sentença",
          "Recurso",
          "Acórdão",
          "Despacho",
          "Notificação"
        ]
      },
      {
        nome: "alimentos a filhos maiores ou emancipados",
        atos: [
          "Requerimento Inicial",
          "Ata de Julgamento",
          "Sentença"
        ]
      },
      {
        nome: "atribuição de casa de morada de família",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Tentativa de Conciliação",
          "Contestação",
          "Sentença"
        ]
      },
      {
        nome: "separação ou divórcio por mutuo consentimento",
        atos: [
          "Requerimento Inicial",
          "Citação",
          "Primeira Conferência",
          "Suspensão ou Adiamento da Conferência"
        ]
      }
    ]
  }
];

export interface AreaProcessual {
  id: string; // "civel", "crime", or custom random id
  nome: string; // "Processo Cível", "Processo Crime", or custom
  especies: CivilEspecie[];
  deleted?: boolean;
  deletedAt?: string;
}

export const INITIAL_AREAS_HIERARCHY: AreaProcessual[] = [
  {
    id: "civel",
    nome: "Processo Cível",
    especies: INITIAL_CIVIL_HIERARCHY,
  },
  {
    id: "crime",
    nome: "Processo Crime",
    especies: [
      {
        especie: "Processo de Instrução",
        accoes: [
          {
            nome: "inquérito e instrução",
            atos: [
              "Auto de Notícia",
              "Acusação formal (Ministério Público)",
              "Despacho de Pronúncia",
              "Defesa do Arguido",
              "Inquérito",
              "Audiência e Julgamento",
              "Recurso",
              "Despacho",
              "Notificação"
            ]
          }
        ]
      },
      {
        especie: "Processo Comum",
        accoes: [
          {
            nome: "processo de querela",
            atos: [
              "Auto de Notícia",
              "Acusação",
              "Contestação",
              "Instrução",
              "Audiência e Julgamento",
              "Sentença",
              "Despacho",
              "Notificação"
            ]
          },
          {
            nome: "processo de polícia correicional",
            atos: [
              "Auto de Notícia",
              "Acusação",
              "Contestação",
              "Audiência",
              "Sentença",
              "Notificação"
            ]
          },
          {
            nome: "processo sumário crime",
            atos: [
              "Auto de notícia em flagrante",
              "Julgamento sumário",
              "Sentença crime"
            ]
          }
        ]
      }
    ]
  }
];

const LOCAL_STORAGE_KEY = 'gestao_processos_civil_hierarchy_v3';
const AREAS_STORAGE_KEY = 'gestao_processos_areas_hierarchy_v4';

export function getStoredAreasHierarchy(): AreaProcessual[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return INITIAL_AREAS_HIERARCHY;
  }
  const stored = localStorage.getItem(AREAS_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(INITIAL_AREAS_HIERARCHY));
    return INITIAL_AREAS_HIERARCHY;
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id) {
      return parsed;
    }
    localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(INITIAL_AREAS_HIERARCHY));
    return INITIAL_AREAS_HIERARCHY;
  } catch (e) {
    localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(INITIAL_AREAS_HIERARCHY));
    return INITIAL_AREAS_HIERARCHY;
  }
}

export function saveStoredAreasHierarchy(areas: AreaProcessual[]) {
  localStorage.setItem(AREAS_STORAGE_KEY, JSON.stringify(areas));
  // Keep CIVIL_HIERARCHY local storage sync updated for compatibility
  const civelArea = areas.find(a => a.id === 'civel');
  if (civelArea) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(civelArea.especies));
  }
}

export function getStoredHierarchy(): CivilEspecie[] {
  const areas = getStoredAreasHierarchy();
  const civel = areas.find(a => a.id === 'civel');
  return civel ? civel.especies : INITIAL_CIVIL_HIERARCHY;
}

export const CIVIL_HIERARCHY = getStoredHierarchy();

export function saveStoredHierarchy(hierarchy: CivilEspecie[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(hierarchy));
  const areas = getStoredAreasHierarchy();
  const civelIdx = areas.findIndex(a => a.id === 'civel');
  if (civelIdx !== -1) {
    areas[civelIdx].especies = hierarchy;
    saveStoredAreasHierarchy(areas);
  }
}

export function addCustomActTypeToHierarchy(especieName: string, accaoName: string, newAct: string): CivilEspecie[] {
  const current = getStoredHierarchy();
  const foundEspecie = current.find(e => e.especie === especieName);
  if (foundEspecie) {
    const foundAccao = foundEspecie.accoes.find(a => a.nome.toLowerCase() === accaoName.toLowerCase());
    if (foundAccao) {
      if (!foundAccao.atos.includes(newAct)) {
        foundAccao.atos.push(newAct);
      }
    }
  }
  saveStoredHierarchy(current);
  return current;
}

export function addCustomPhaseToHierarchy(especieName: string, accaoName: string, newPhase: string): CivilEspecie[] {
  const current = getStoredHierarchy();
  const foundEspecie = current.find(e => e.especie === especieName);
  if (foundEspecie) {
    const foundAccao = foundEspecie.accoes.find(a => a.nome.toLowerCase() === accaoName.toLowerCase());
    if (foundAccao) {
      if (!foundAccao.fases) {
        foundAccao.fases = [...DEFAULT_FASES];
      }
      if (!foundAccao.fases.includes(newPhase)) {
        foundAccao.fases.push(newPhase);
      }
    }
  }
  saveStoredHierarchy(current);
  return current;
}

export function getCustomProcessAllowedActs(especie?: string, tipoAccao?: string, areaId: string = 'civel'): string[] {
  if (!especie || !tipoAccao) {
    return ["Petição Inicial", "Contestação", "Réplica", "Sentença", "Despacho", "Notificação", "Outro"];
  }
  const current = getStoredAreasHierarchy();
  const foundArea = current.find(a => a.id === areaId);
  if (foundArea) {
    const foundEspecie = foundArea.especies.find(e => e.especie === especie);
    if (foundEspecie) {
      const foundAccao = foundEspecie.accoes.find(a => a.nome.toLowerCase() === tipoAccao.toLowerCase());
      if (foundAccao && foundAccao.atos.length > 0) {
        return foundAccao.atos;
      }
    }
  }
  for (const group of current) {
    const foundE = group.especies.find(e => e.especie === especie);
    if (foundE) {
      const foundA = foundE.accoes.find(a => a.nome.toLowerCase() === tipoAccao.toLowerCase());
      if (foundA && foundA.atos.length > 0) {
        return foundA.atos;
      }
    }
  }
  return ["Petição Inicial", "Contestação", "Réplica", "Sentença", "Despacho", "Notificação", "Outro"];
}

export function getCustomProcessAllowedPhases(especie?: string, tipoAccao?: string, areaId: string = 'civel'): string[] {
  if (!especie || !tipoAccao) {
    return DEFAULT_FASES;
  }
  const current = getStoredAreasHierarchy();
  const foundArea = current.find(a => a.id === areaId);
  if (foundArea) {
    const foundEspecie = foundArea.especies.find(e => e.especie === especie);
    if (foundEspecie) {
      const foundAccao = foundEspecie.accoes.find(a => a.nome.toLowerCase() === tipoAccao.toLowerCase());
      if (foundAccao && foundAccao.fases && foundAccao.fases.length > 0) {
        return foundAccao.fases;
      }
    }
  }
  for (const group of current) {
    const foundE = group.especies.find(e => e.especie === especie);
    if (foundE) {
      const foundA = foundE.accoes.find(a => a.nome.toLowerCase() === tipoAccao.toLowerCase());
      if (foundA && foundA.fases && foundA.fases.length > 0) {
        return foundA.fases;
      }
    }
  }
  return DEFAULT_FASES;
}

export function getArchivedHierarchy(): { area?: AreaProcessual, especie?: CivilEspecie, accao?: CivilActionType, type: 'area' | 'especie' | 'accao' }[] {
    const areas = getStoredAreasHierarchy();
    const archived: { area?: AreaProcessual, especie?: CivilEspecie, accao?: CivilActionType, type: 'area' | 'especie' | 'accao' }[] = [];
    
    areas.forEach(area => {
        if (area.deleted) {
            archived.push({ area, type: 'area' });
        } else {
            area.especies.forEach(especie => {
                if (especie.deleted) {
                    archived.push({ area, especie, type: 'especie' });
                } else {
                    especie.accoes.forEach(accao => {
                        if (accao.deleted) {
                            archived.push({ area, especie, accao, type: 'accao' });
                        }
                    });
                }
            });
        }
    });

    return archived;
}
