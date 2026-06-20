/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, User, Shield, Phone, Mail, Award, MapPin, Printer, Edit2, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { IntervenienteFicha, AdvogadoFicha, getIntervenientes, getAdvogadosFichas, saveInterveniente, saveAdvogadoFicha } from '../utils/participants';
import FichaIntervenienteModal from './FichaIntervenienteModal';
import FichaAdvogadoModal from './FichaAdvogadoModal';

interface FichaConsultarModalProps {
  nome: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void; // call when edits successfully saved
}

export default function FichaConsultarModal({
  nome,
  isOpen,
  onClose,
  onUpdated
}: FichaConsultarModalProps) {
  const [interveniente, setInterveniente] = useState<IntervenienteFicha | null>(null);
  const [advogado, setAdvogado] = useState<AdvogadoFicha | null>(null);

  // Edit sub-modal states
  const [isEditIntervenienteOpen, setIsEditIntervenienteOpen] = useState(false);
  const [isEditAdvogadoOpen, setIsEditAdvogadoOpen] = useState(false);

  useEffect(() => {
    if (isOpen && nome) {
      // 1. Search Intervenientes
      const inters = getIntervenientes();
      const foundInter = inters.find(i => i.nome.trim().toLowerCase() === nome.trim().toLowerCase());
      
      if (foundInter) {
        setInterveniente(foundInter);
        setAdvogado(null);
      } else {
        // 2. Search Lawyers
        const advs = getAdvogadosFichas();
        const foundAdv = advs.find(a => a.nome.trim().toLowerCase() === nome.trim().toLowerCase());
        
        if (foundAdv) {
          setAdvogado(foundAdv);
          setInterveniente(null);
        } else {
          // Reset
          setInterveniente(null);
          setAdvogado(null);
        }
      }
    }
  }, [isOpen, nome]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // If not found in detailed records, give prompt to create it!
  const isNotFound = !interveniente && !advogado;

  const handleCreateAutoInterveniente = (tipo: 'autor' | 'reu') => {
    setIsEditIntervenienteOpen(true);
  };

  const handleCreateAutoAdvogado = () => {
    setIsEditAdvogadoOpen(true);
  };

  const handleSaveInterveniente = (ficha: IntervenienteFicha) => {
    saveInterveniente(ficha);
    setInterveniente(ficha);
    if (onUpdated) onUpdated();
  };

  const handleSaveAdvogado = (ficha: AdvogadoFicha) => {
    saveAdvogadoFicha(ficha);
    setAdvogado(ficha);
    if (onUpdated) onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:relative print:inset-0 print:p-0 print:bg-white print:backdrop-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 print:shadow-none print:border-none print:max-w-full">
        
        {/* Header - Hidden on Print */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
              Registo de Ficha
            </span>
            <span className="text-xs text-slate-500 font-medium">Consulta de dados oficiais em autos</span>
          </div>
          <div className="flex items-center gap-2">
            {!isNotFound && (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Imprimir Ficha"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (interveniente) setIsEditIntervenienteOpen(true);
                    if (advogado) setIsEditAdvogadoOpen(true);
                  }}
                  className="p-1.5 hover:bg-slate-200 text-indigo-600 hover:text-indigo-800 rounded-lg transition-colors cursor-pointer"
                  title="Editar Ficha"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </>
            )}
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 space-y-6 text-xs text-slate-700 print:p-0 print:text-black">
          
          {/* case: NOT FOUND YET (Offer to create Ficha) */}
          {isNotFound && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <FileText className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 font-display">Nome Simples Detetado</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  O nome <strong className="text-slate-700 font-semibold">"{nome}"</strong> está listado, mas ainda sem ficha individual de interveniente ou de mandatário preenchida.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={() => handleCreateAutoInterveniente('autor')}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all text-xs cursor-pointer"
                >
                  Criar Ficha de Autor
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateAutoInterveniente('reu')}
                  className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all text-xs cursor-pointer"
                >
                  Criar Ficha de Réu
                </button>
                <button
                  type="button"
                  onClick={handleCreateAutoAdvogado}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all text-xs cursor-pointer"
                >
                  Criar Ficha de Advogado
                </button>
              </div>
            </div>
          )}

          {/* CASE: INTERVENIENTE (Autor / Réu) */}
          {interveniente && (
            <div className="space-y-5">
              {/* Badge & Name Header */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 ${
                    interveniente.tipo === 'autor' 
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' 
                      : 'bg-rose-50 text-rose-700 border border-rose-150'
                  }`}>
                    Ficha Judicial de {interveniente.tipo === 'autor' ? 'Autor' : 'Réu'}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight font-display select-all">
                    {interveniente.nome}
                  </h3>
                </div>
                <div className="shrink-0 text-slate-300 print:hidden">
                  <User className="h-10 w-10 stroke-1" />
                </div>
              </div>

              {/* Grid 2-column fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filiação (Pai)</span>
                  <span className="text-xs font-semibold text-slate-800">{interveniente.nomePai || 'N/D'}</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Filiação (Mãe)</span>
                  <span className="text-xs font-semibold text-slate-800">{interveniente.nomeMae || 'N/D'}</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data de Nascimento</span>
                  <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1 font-mono">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {interveniente.dataNascimento || 'N/D'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bilhete de Identidade / CC</span>
                  <span className="text-xs font-semibold text-slate-800 font-mono">{interveniente.bilheteIdentidade || 'N/D'}</span>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Profissão / Ocupação</span>
                  <span className="text-xs font-semibold text-slate-800">{interveniente.profissao || 'N/D'}</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telefone de Contacto</span>
                  <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1 font-mono">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {interveniente.telefone || 'N/D'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Endereço Eletrónico (Email)</span>
                  <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1 font-mono select-all">
                    <Mail className="h-3 w-3 text-slate-400" />
                    {interveniente.email || 'N/D'}
                  </span>
                </div>
              </div>

              {/* Multi Moradas layout */}
              <div className="space-y-2 pt-2">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Histórico de Moradas Registadas</span>
                <div className="space-y-2">
                  {interveniente.moradas && interveniente.moradas.length > 0 ? (
                    interveniente.moradas.map(m => (
                      <div key={m.id} className={`p-2.5 border rounded-xl flex items-start gap-2.5 ${
                        m.isAtual 
                          ? 'bg-blue-50/30 border-blue-200' 
                          : 'bg-slate-50/50 border-slate-100'
                      }`}>
                        <MapPin className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${m.isAtual ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="text-[11px] leading-relaxed">
                          <p className={`font-medium ${m.isAtual ? 'text-blue-900 font-semibold' : 'text-slate-700'}`}>{m.endereco}</p>
                          {m.isAtual && (
                            <span className="inline-flex items-center gap-1 text-[8px] bg-blue-100 text-blue-800 px-1.5 py-0.1 rounded font-bold uppercase tracking-wider mt-1 select-none">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Morada Atual para Notificações Censitárias
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-400 italic bg-slate-50 border border-slate-100 rounded-xl">
                      Nenhuma morada associada a esta ficha de interveniente.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CASE: ADVOGADO */}
          {advogado && (
            <div className="space-y-5">
              {/* Badge & Name Header */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 bg-blue-50 text-blue-700 border border-blue-150">
                    Ficha de Advogado Mandatário
                  </span>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight font-display select-all">
                    {advogado.nome}
                  </h3>
                </div>
                <div className="shrink-0 text-slate-300 print:hidden">
                  <Award className="h-10 w-10 stroke-1" />
                </div>
              </div>

              {/* Grid 2-column fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cédula Profissional</span>
                  <span className="text-xs font-bold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                    {advogado.cedulaProfissional || 'N/D'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bilhete de Identidade / CC</span>
                  <span className="text-xs font-semibold text-slate-800 font-mono">{advogado.bilheteIdentidade || 'N/D'}</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Telefone do Escritório</span>
                  <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1 font-mono">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {advogado.telefone || 'N/D'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Correio Eletrónico (Email)</span>
                  <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1 font-mono select-all">
                    <Mail className="h-3 w-3 text-slate-400" />
                    {advogado.email || 'N/D'}
                  </span>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contacto Telefax (Fax)</span>
                  <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1 font-mono">
                    <Printer className="h-3 w-3 text-slate-400" />
                    {advogado.fax || 'N/D'}
                  </span>
                </div>
              </div>

              {/* Multi Moradas layout */}
              <div className="space-y-2 pt-2">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Histórico de Moradas Profissionais</span>
                <div className="space-y-2">
                  {advogado.moradasProfissionais && advogado.moradasProfissionais.length > 0 ? (
                    advogado.moradasProfissionais.map(m => (
                      <div key={m.id} className={`p-2.5 border rounded-xl flex items-start gap-2.5 ${
                        m.isAtual 
                          ? 'bg-blue-50/30 border-blue-200' 
                          : 'bg-slate-50/50 border-slate-100'
                      }`}>
                        <MapPin className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${m.isAtual ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div className="text-[11px] leading-relaxed">
                          <p className={`font-medium ${m.isAtual ? 'text-blue-900 font-semibold' : 'text-slate-700'}`}>{m.endereco}</p>
                          {m.isAtual && (
                            <span className="inline-flex items-center gap-1 text-[8px] bg-blue-100 text-blue-800 px-1.5 py-0.1 rounded font-bold uppercase tracking-wider mt-1 select-none">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Escritório / Sede de Correspondência Principal
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-400 italic bg-slate-50 border border-slate-100 rounded-xl">
                      Nenhuma morada profissional associada a esta ficha.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Signature/Footer on Print */}
          <div className="hidden border-t-2 border-black mt-16 pt-8 text-center space-y-12 print:block">
            <div className="text-[10px] uppercase font-bold tracking-wider">
              Autenticado digitalmente pelo Tribunal Judicial e Secretaria Geral
            </div>
            <div className="grid grid-cols-2 gap-12 text-sm">
              <div className="border-t border-slate-300 pt-3">
                O Mandatário/Interveniente
              </div>
              <div className="border-t border-slate-300 pt-3">
                A Secretaria Judicial (Juízo de Turno)
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions - Close Button */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 hover:bg-slate-200 bg-slate-800 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition-all"
          >
            Fechar Ficha
          </button>
        </div>

      </div>

      {/* Sub-modals for editing detailed sheets */}
      <FichaIntervenienteModal
        isOpen={isEditIntervenienteOpen}
        onClose={() => setIsEditIntervenienteOpen(false)}
        onSave={handleSaveInterveniente}
        tipo={interveniente?.tipo || 'autor'}
        initialNome={nome}
        existingFicha={interveniente || undefined}
      />

      <FichaAdvogadoModal
        isOpen={isEditAdvogadoOpen}
        onClose={() => setIsEditAdvogadoOpen(false)}
        onSave={handleSaveAdvogado}
        initialNome={nome}
        existingFicha={advogado || undefined}
      />

    </div>
  );
}
