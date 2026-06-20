/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Home, CheckCircle2, Award, Phone, Mail, Printer, CreditCard, User } from 'lucide-react';
import { AdvogadoFicha, MoradaItem } from '../utils/participants';

interface FichaAdvogadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ficha: AdvogadoFicha) => void;
  initialNome?: string;
  existingFicha?: AdvogadoFicha;
}

export default function FichaAdvogadoModal({
  isOpen,
  onClose,
  onSave,
  initialNome = '',
  existingFicha
}: FichaAdvogadoModalProps) {
  const [nome, setNome] = useState('');
  const [cedulaProfissional, setCedulaProfissional] = useState('');
  const [bilheteIdentidade, setBilheteIdentidade] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [fax, setFax] = useState('');
  
  // Professional addresses
  const [moradasProfissionais, setMoradasProfissionais] = useState<MoradaItem[]>([]);
  const [novaMorada, setNovaMorada] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (existingFicha) {
        setNome(existingFicha.nome || '');
        setCedulaProfissional(existingFicha.cedulaProfissional || '');
        setBilheteIdentidade(existingFicha.bilheteIdentidade || '');
        setMoradasProfissionais(existingFicha.moradasProfissionais || []);
        setTelefone(existingFicha.telefone || '');
        setEmail(existingFicha.email || '');
        setFax(existingFicha.fax || '');
      } else {
        setNome(initialNome);
        setCedulaProfissional('');
        setBilheteIdentidade('');
        setMoradasProfissionais([]);
        setTelefone('');
        setEmail('');
        setFax('');
      }
      setNovaMorada('');
      setErrorMsg('');
    }
  }, [isOpen, existingFicha, initialNome]);

  if (!isOpen) return null;

  const handleAddMorada = () => {
    const addressStr = novaMorada.trim();
    if (!addressStr) return;

    const isFirst = moradasProfissionais.length === 0;
    const newItem: MoradaItem = {
      id: `morada-p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      endereco: addressStr,
      isAtual: isFirst
    };

    setMoradasProfissionais([...moradasProfissionais, newItem]);
    setNovaMorada('');
  };

  const handleMarkAsAtual = (id: string) => {
    setMoradasProfissionais(prev => prev.map(m => ({
      ...m,
      isAtual: m.id === id
    })));
  };

  const handleRemoveMorada = (id: string) => {
    setMoradasProfissionais(prev => {
      const filtered = prev.filter(m => m.id !== id);
      if (filtered.length > 0 && !filtered.some(m => m.isAtual)) {
        filtered[0].isAtual = true;
      }
      return filtered;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!nome.trim()) {
      setErrorMsg('O nome do advogado é de preenchimento obrigatório.');
      return;
    }

    const savedFicha: AdvogadoFicha = {
      nome: nome.trim(),
      cedulaProfissional: cedulaProfissional.trim() || 'N/D',
      bilheteIdentidade: bilheteIdentidade.trim() || 'N/D',
      moradasProfissionais: moradasProfissionais,
      telefone: telefone.trim() || 'N/D',
      email: email.trim() || 'N/D',
      fax: fax.trim() || 'N/D'
    };

    onSave(savedFicha);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight font-display">
                Ficha de Advogado Regulamentado
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">Preencha o registo oficial de patrono / mandatário judicial</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 rounded-lg font-semibold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-5">
            {/* Secção 1: Identificação Profissional */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                1. Matrícula e Dados do Mandatário
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Nome Oficial Mandatário *</label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Dr. Pedro Fonseca Rebelo"
                      className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 text-xs font-medium focus:border-blue-500 focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Cédula Profissional (OA)</label>
                  <div className="relative">
                    <Award className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={cedulaProfissional}
                      onChange={(e) => setCedulaProfissional(e.target.value)}
                      placeholder="Ex: 8945P"
                      className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Bilhete de Identidade / CC</label>
                  <div className="relative">
                    <CreditCard className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={bilheteIdentidade}
                      onChange={(e) => setBilheteIdentidade(e.target.value)}
                      placeholder="Ex: 11547844-0-YY9"
                      className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 text-xs font-medium font-mono focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Secção 2: Contactos e Correspondência */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                2. Redes de Comunicação do Escritório
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Telefone Profissional</label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="Ex: 223 456 789"
                      className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 text-xs font-medium font-mono focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Correio Eletrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ex: rebelo.adv@mail.pt"
                      className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 text-xs font-medium font-mono focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Linha de Telefax (Fax)</label>
                  <div className="relative">
                    <Printer className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={fax}
                      onChange={(e) => setFax(e.target.value)}
                      placeholder="Ex: 223 456 790"
                      className="w-full rounded-lg bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 text-xs font-medium font-mono focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Secção 3: Moradas Profissionais (Escritórios) */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                3. Escritórios / Domicílio Profissional
              </h4>

              <p className="text-[10px] text-slate-500">
                Pode registar vários endereços profissionais. Marque com a <strong className="text-blue-600 font-semibold">estrela (morada atual)</strong> o escritório onde se deve centrar a receção de correspondência de representação.
              </p>

              {/* Input row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={novaMorada}
                  onChange={(e) => setNovaMorada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMorada();
                    }
                  }}
                  placeholder="Escreva um domicílio profissional completo..."
                  className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-medium focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddMorada}
                  className="px-3 bg-slate-800 hover:bg-slate-705 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </button>
              </div>

              {/* List of offices */}
              <div className="space-y-2 max-h-42 overflow-y-auto">
                {moradasProfissionais.map((m) => (
                  <div key={m.id} className={`flex items-center justify-between p-3 border rounded-xl transition-all ${
                    m.isAtual 
                      ? 'bg-blue-50/50 border-blue-200' 
                      : 'bg-slate-50 border-slate-150'
                  }`}>
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <Home className={`h-4 w-4 mt-0.5 shrink-0 ${m.isAtual ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div className="text-[11px] leading-relaxed text-slate-800 font-medium min-w-0">
                        <p className="break-words font-medium">{m.endereco}</p>
                        {m.isAtual && (
                          <span className="inline-flex items-center gap-1 text-[9px] text-blue-700 font-bold bg-blue-100/50 px-1.5 py-0.2 rounded-md mt-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Escritório / Sede de Notificação Atual
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-3 shrink-0">
                      {!m.isAtual && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsAtual(m.id)}
                          className="px-2 py-1 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-350 text-[10px] font-bold text-slate-600 rounded-lg transition-all cursor-pointer"
                        >
                          Marcar como Atual
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveMorada(m.id)}
                        className="p-1.5 border border-red-100 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-all cursor-pointer"
                        title="Remover morada profissional"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {moradasProfissionais.length === 0 && (
                  <div className="text-center py-4 text-slate-400 italic bg-slate-50 border border-dashed border-slate-150 rounded-xl">
                    Nenhuma morada profissional registada. Adicione uma no formulário acima.
                  </div>
                )}
              </div>
            </div>
            
            {/* Form actionsFooter */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 -mx-6 -mb-6 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Confirmar e Registar Advogado
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
