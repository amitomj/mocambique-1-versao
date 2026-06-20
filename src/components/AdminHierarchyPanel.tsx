import React, { useState, useEffect } from 'react';
import { Processo } from '../types';
import { getStoredAreasHierarchy, saveStoredAreasHierarchy, AreaProcessual, CivilEspecie, CivilActionType } from '../utils/civilHierarchy';
import { Plus, Trash2, Edit2, ChevronUp, ChevronDown } from 'lucide-react';

export const AdminHierarchyPanel: React.FC<{ processos: Processo[] }> = ({ processos }) => {
  const [areas, setAreas] = useState<AreaProcessual[]>([]);

  useEffect(() => {
    setAreas(getStoredAreasHierarchy());
  }, []);

  const save = (newAreas: AreaProcessual[]) => {
    setAreas(newAreas);
    saveStoredAreasHierarchy(newAreas);
  };

  const addArea = () => {
    const nome = prompt("Nome da nova área processual");
    if (nome) save([...areas, { id: Date.now().toString(), nome, especies: [] }]);
  };

  const editArea = (id: string, nome: string) => {
    const novoNome = prompt("Editar nome da área", nome);
    if (novoNome) save(areas.map(a => a.id === id ? { ...a, nome: novoNome } : a));
  };

  const archiveArea = (id: string, nome: string) => {
    const usedProcessos = processos.filter(p => p.tipo === nome && !p.deleted);
    if (usedProcessos.length > 0) {
        const nums = usedProcessos.map(p => p.numero).join(', ');
        alert(`Não é possível arquivar a área "${nome}" porque está associada a registos ativos.\n\nProcessos afetados: ${nums}\n\nPor favor, edite ou arquive estes processos primeiro para poder prosseguir.`);
        return;
    }
    if (confirm("Mover área para o arquivo?")) {
      save(areas.map(a => a.id === id ? { ...a, deleted: true, deletedAt: new Date().toISOString() } : a));
    }
  };

  const moveArea = (id: string, direction: 'up' | 'down') => {
    const visibleIndices = areas.map((a, i) => ({ a, i })).filter(item => !item.a.deleted);
    const targetIdx = visibleIndices.findIndex(item => item.a.id === id);
    if (targetIdx === -1) return;

    const swapWithIdx = direction === 'up' ? targetIdx - 1 : targetIdx + 1;
    if (swapWithIdx < 0 || swapWithIdx >= visibleIndices.length) return;

    const realIdx1 = visibleIndices[targetIdx].i;
    const realIdx2 = visibleIndices[swapWithIdx].i;

    const newAreas = [...areas];
    const temp = newAreas[realIdx1];
    newAreas[realIdx1] = newAreas[realIdx2];
    newAreas[realIdx2] = temp;
    save(newAreas);
  };

  const addEspecie = (areaId: string) => {
    const especie = prompt("Nome da nova espécie");
    if (especie) save(areas.map(a => a.id === areaId ? { ...a, especies: [...a.especies, { especie, accoes: [] }] } : a));
  };

  const editEspecie = (areaId: string, oldNome: string, novoNome: string) => {
      save(areas.map(a => a.id === areaId ? { ...a, especies: a.especies.map(e => e.especie === oldNome ? { ...e, especie: novoNome } : e) } : a));
  };

  const archiveEspecie = (areaId: string, areaNome: string, especieNome: string) => {
    const usedProcessos = processos.filter(p => p.tipo === areaNome && p.especieCivel === especieNome && !p.deleted);
    if (usedProcessos.length > 0) {
        const nums = usedProcessos.map(p => p.numero).join(', ');
        alert(`Não é possível arquivar a espécie "${especieNome}" porque está associada a registos ativos.\n\nProcessos afetados: ${nums}\n\nPor favor, edite ou arquive estes processos primeiro para poder prosseguir.`);
        return;
    }
    if (confirm("Mover espécie para o arquivo?")) {
      save(areas.map(a => a.id === areaId ? { ...a, especies: a.especies.map(e => e.especie === especieNome ? { ...e, deleted: true, deletedAt: new Date().toISOString() } : e) } : a));
    }
  };

  const moveEspecie = (areaId: string, especieNome: string, direction: 'up' | 'down') => {
    const newAreas = areas.map(area => {
      if (area.id !== areaId) return area;

      const visibleIndices = area.especies.map((e, i) => ({ e, i })).filter(item => !item.e.deleted);
      const targetIdx = visibleIndices.findIndex(item => item.e.especie === especieNome);
      if (targetIdx === -1) return area;

      const swapWithIdx = direction === 'up' ? targetIdx - 1 : targetIdx + 1;
      if (swapWithIdx < 0 || swapWithIdx >= visibleIndices.length) return area;

      const realIdx1 = visibleIndices[targetIdx].i;
      const realIdx2 = visibleIndices[swapWithIdx].i;

      const newEspecies = [...area.especies];
      const temp = newEspecies[realIdx1];
      newEspecies[realIdx1] = newEspecies[realIdx2];
      newEspecies[realIdx2] = temp;

      return { ...area, especies: newEspecies };
    });
    save(newAreas);
  };

  const addAccao = (areaId: string, especieNome: string) => {
    const nome = prompt("Nome do novo tipo de ação");
    if (nome) save(areas.map(a => a.id === areaId ? { ...a, especies: a.especies.map(e => e.especie === especieNome ? { ...e, accoes: [...e.accoes, { nome }] } : e) } : a));
  };

  const editAccao = (areaId: string, especieNome: string, oldNome: string, novoNome: string) => {
      if (!novoNome) return;
      save(areas.map(a => a.id === areaId ? { ...a, especies: a.especies.map(e => e.especie === especieNome ? { ...e, accoes: e.accoes.map(ac => ac.nome === oldNome ? {...ac, nome: novoNome} : ac) } : e) } : a));
  };

  const archiveAccao = (areaId: string, areaNome: string, especieNome: string, accaoNome: string) => {
    const usedProcessos = processos.filter(p => p.tipo === areaNome && p.especieCivel === especieNome && p.tipoAccaoCivel === accaoNome && !p.deleted);
    if (usedProcessos.length > 0) {
        const nums = usedProcessos.map(p => p.numero).join(', ');
        alert(`Não é possível eliminar o tipo de ação "${accaoNome}" porque está associado a registos ativos.\n\nProcessos afetados: ${nums}\n\nPor favor, edite ou arquive estes processos primeiro para poder prosseguir.`);
        return;
    }
    if (confirm(`Deseja eliminar definitivamente o tipo de ação "${accaoNome}"?`)) {
      save(areas.map(a => a.id === areaId ? {
        ...a,
        especies: a.especies.map(e => e.especie === especieNome ? {
          ...e,
          accoes: e.accoes.filter(ac => ac.nome !== accaoNome)
        } : e)
      } : a));
    }
  };

  const moveAccao = (areaId: string, especieNome: string, accaoNome: string, direction: 'up' | 'down') => {
    const newAreas = areas.map(area => {
      if (area.id !== areaId) return area;

      const newEspecies = area.especies.map(e => {
        if (e.especie !== especieNome) return e;

        const visibleIndices = e.accoes.map((ac, i) => ({ ac, i })).filter(item => !item.ac.deleted);
        const targetIdx = visibleIndices.findIndex(item => item.ac.nome === accaoNome);
        if (targetIdx === -1) return e;

        const swapWithIdx = direction === 'up' ? targetIdx - 1 : targetIdx + 1;
        if (swapWithIdx < 0 || swapWithIdx >= visibleIndices.length) return e;

        const realIdx1 = visibleIndices[targetIdx].i;
        const realIdx2 = visibleIndices[swapWithIdx].i;

        const newAccoes = [...e.accoes];
        const temp = newAccoes[realIdx1];
        newAccoes[realIdx1] = newAccoes[realIdx2];
        newAccoes[realIdx2] = temp;

        return { ...e, accoes: newAccoes };
      });

      return { ...area, especies: newEspecies };
    });
    save(newAreas);
  };

  const visibleAreas = areas.filter(a => !a.deleted);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
        <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider">Estrutura Processual</h3>
        <button 
          onClick={addArea} 
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={20} /> Nova Área Processual
        </button>
      </div>
      
      <div className="space-y-6">
        {visibleAreas.map((area, areaIdx) => {
          const visibleEspecies = area.especies.filter(e => !e.deleted);
          return (
            <div key={area.id} className="p-5 border border-slate-200 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                    <button 
                      onClick={() => moveArea(area.id, 'up')} 
                      disabled={areaIdx === 0}
                      title="Mover para Cima"
                      className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button 
                      onClick={() => moveArea(area.id, 'down')} 
                      disabled={areaIdx === visibleAreas.length - 1}
                      title="Mover para Baixo"
                      className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <h4 className="font-bold text-lg text-slate-900">{area.nome}</h4>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button onClick={() => editArea(area.id, area.nome)} className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"><Edit2 size={20}/></button>
                  <button onClick={() => archiveArea(area.id, area.nome)} className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"><Trash2 size={20} /></button>
                  <div className="h-6 w-px bg-slate-200 mx-2"></div>
                  <button onClick={() => addEspecie(area.id)} className="text-blue-600 hover:text-blue-800 cursor-pointer text-sm flex items-center gap-1.5 font-bold uppercase tracking-wide"><Plus size={18} /> Espécie</button>
                </div>
              </div>
              <div className="ml-2 sm:ml-4 space-y-4">
                {visibleEspecies.map((especie, idx) => {
                  const visibleAccoes = especie.accoes.filter(ac => !ac.deleted);
                  return (
                    <div key={idx} className="border-l-4 border-slate-200 pl-5 py-1">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-slate-50 py-2 px-3 rounded-lg mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col bg-white border border-slate-200 rounded p-0.5 shadow-xs">
                            <button 
                              onClick={() => moveEspecie(area.id, especie.especie, 'up')} 
                              disabled={idx === 0}
                              title="Mover para Cima"
                              className="p-0.5 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button 
                              onClick={() => moveEspecie(area.id, especie.especie, 'down')} 
                              disabled={idx === visibleEspecies.length - 1}
                              title="Mover para Baixo"
                              className="p-0.5 text-slate-500 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          <span className="font-bold text-slate-800 text-base">{especie.especie}</span>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button onClick={() => editEspecie(area.id, especie.especie, prompt("Editar espécie", especie.especie) || especie.especie)} className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"><Edit2 size={18}/></button>
                          <button onClick={() => archiveEspecie(area.id, area.nome, especie.especie)} className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"><Trash2 size={18} /></button>
                          <button onClick={() => addAccao(area.id, especie.especie)} className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"><Plus size={18} /></button>
                        </div>
                      </div>
                      <div className="ml-2 space-y-1.5">
                        {visibleAccoes.map((ac, idxA) => (
                          <div key={idxA} className="group flex justify-between items-center text-sm text-slate-600 py-1.5 px-3 border border-slate-100 rounded-lg hover:border-slate-200 hover:bg-slate-50/40 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col bg-slate-50 border border-slate-200 rounded p-0.5">
                                <button 
                                  onClick={() => moveAccao(area.id, especie.especie, ac.nome, 'up')} 
                                  disabled={idxA === 0}
                                  title="Mover para Cima"
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  <ChevronUp size={12} />
                                </button>
                                <button 
                                  onClick={() => moveAccao(area.id, especie.especie, ac.nome, 'down')} 
                                  disabled={idxA === visibleAccoes.length - 1}
                                  title="Mover para Baixo"
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  <ChevronDown size={12} />
                                </button>
                              </div>
                              <span className="font-medium">• {ac.nome}</span>
                            </div>
                            <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => editAccao(area.id, especie.especie, ac.nome, prompt("Editar ação", ac.nome) || ac.nome)} className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"><Edit2 size={16}/></button>
                              <button onClick={() => archiveAccao(area.id, area.nome, especie.especie, ac.nome)} className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"><Trash2 size={16} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
