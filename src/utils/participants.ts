/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MoradaItem {
  id: string;
  endereco: string;
  isAtual: boolean;
}

export interface IntervenienteFicha {
  nome: string;
  nuit?: string; // Mozambican fiscal number
  nomePai: string;
  nomeMae: string;
  dataNascimento: string;
  bilheteIdentidade: string;
  profissao: string;
  moradas: MoradaItem[];
  telefone: string;
  email: string;
  tipo?: 'autor' | 'reu' | 'procurador';
}

export interface AdvogadoFicha {
  nome: string;
  cedulaProfissional: string;
  bilheteIdentidade: string;
  moradasProfissionais: MoradaItem[];
  telefone: string;
  email: string;
  fax: string;
}

const STORAGE_KEYS = {
  INTERVENIENTES: 'gestao_processos_intervenientes_fichas',
  ADVOGADOS_FICHAS: 'gestao_processos_advogados_detalhados_fichas'
};

// Seed Intervenientes empty by default for clean real data testing
const SEED_INTERVENIENTES: IntervenienteFicha[] = [];

// Seed Advogados Fichas empty by default
const SEED_ADVOGADOS_FICHAS: AdvogadoFicha[] = [];

export function getIntervenientes(): IntervenienteFicha[] {
  const raw = localStorage.getItem(STORAGE_KEYS.INTERVENIENTES);
  let list: IntervenienteFicha[] = [];
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.INTERVENIENTES, JSON.stringify([]));
    list = [];
  } else {
    try {
      list = JSON.parse(raw);
    } catch (e) {
      list = [];
    }
  }

  // Dynamically harvest names from all existing trials in parallel
  try {
    const procsRaw = localStorage.getItem('gestao_processos_processos');
    if (procsRaw) {
      const procs = JSON.parse(procsRaw);
      if (Array.isArray(procs)) {
        const existingNamesLower = new Set(list.map(i => i.nome.trim().toLowerCase()));
        for (const p of procs) {
          const namesInProc = [...(p.autores || []), ...(p.reus || [])];
          for (const rawName of namesInProc) {
            const name = rawName.trim();
            if (name && !existingNamesLower.has(name.toLowerCase())) {
              list.push({
                nome: name,
                nomePai: '',
                nomeMae: '',
                dataNascimento: '',
                bilheteIdentidade: '',
                profissao: '',
                moradas: [],
                telefone: '',
                email: '',
                tipo: undefined
              });
              existingNamesLower.add(name.toLowerCase());
            }
          }
        }
      }
    }
  } catch (err) {
    // Graceful catch for empty or malformed storage during initial setup
  }

  return list;
}

export function saveInterveniente(ficha: IntervenienteFicha): { success: boolean; message: string; list: IntervenienteFicha[] } {
  const list = getIntervenientes();
  const index = list.findIndex(i => i.nome.trim().toLowerCase() === ficha.nome.trim().toLowerCase());
  
  if (index >= 0) {
    list[index] = ficha;
  } else {
    list.push(ficha);
  }
  
  localStorage.setItem(STORAGE_KEYS.INTERVENIENTES, JSON.stringify(list));
  return { success: true, message: `Ficha de interveniente "${ficha.nome}" guardada com sucesso!`, list };
}

export function deleteInterveniente(nome: string): IntervenienteFicha[] {
  const list = getIntervenientes();
  const updated = list.filter(i => i.nome.trim().toLowerCase() !== nome.trim().toLowerCase());
  localStorage.setItem(STORAGE_KEYS.INTERVENIENTES, JSON.stringify(updated));
  return updated;
}

export function getAdvogadosFichas(): AdvogadoFicha[] {
  const raw = localStorage.getItem(STORAGE_KEYS.ADVOGADOS_FICHAS);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.ADVOGADOS_FICHAS, JSON.stringify([]));
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveAdvogadoFicha(ficha: AdvogadoFicha): { success: boolean; message: string; list: AdvogadoFicha[] } {
  const list = getAdvogadosFichas();
  const index = list.findIndex(a => a.nome.trim().toLowerCase() === ficha.nome.trim().toLowerCase());
  
  if (index >= 0) {
    list[index] = ficha;
  } else {
    list.push(ficha);
  }
  
  localStorage.setItem(STORAGE_KEYS.ADVOGADOS_FICHAS, JSON.stringify(list));
  return { success: true, message: `Ficha de advogado "${ficha.nome}" guardada com sucesso!`, list };
}

export function deleteAdvogadoFicha(nome: string): AdvogadoFicha[] {
  const list = getAdvogadosFichas();
  const updated = list.filter(a => a.nome.trim().toLowerCase() !== nome.trim().toLowerCase());
  localStorage.setItem(STORAGE_KEYS.ADVOGADOS_FICHAS, JSON.stringify(updated));
  return updated;
}

export function getIntervenienteNuitByNome(nome: string): string | undefined {
  if (!nome) return undefined;
  const list = getIntervenientes();
  const found = list.find(i => i.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  return found?.nuit;
}

