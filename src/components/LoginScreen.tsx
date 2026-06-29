/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Shield, Lock, UserCheck, AlertCircle, RefreshCw, Landmark } from 'lucide-react';
import { getUsers, createFirstAdmin, setActiveUser, getTribunais, initLocalStorageSeed, seedFictitiousData } from '../utils/storage';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedTribunalId, setSelectedTribunalId] = useState('');
  const [tribunaisList, setTribunaisList] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [registeredUsersList, setRegisteredUsersList] = useState<any[]>([]);
  const [showSavedCredentials, setShowSavedCredentials] = useState(false);
  const [setupUser, setSetupUser] = useState<any | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Check if system has any registered users
  useEffect(() => {
    const list = getUsers();
    setRegisteredUsersList(list);
    if (list.length === 0) {
      setIsFirstRun(true);
    } else {
      setIsFirstRun(false);
    }
    const tribs = getTribunais();
    setTribunaisList(tribs);
    if (tribs.length > 0) {
      setSelectedTribunalId(tribs[0].id);
    }
  }, []);

  const handleRegisterAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedUsername) {
      setError('Por favor, introduza um nome de utilizador.');
      return;
    }
    if (trimmedUsername.length < 3) {
      setError('O nome de utilizador deve ter pelo menos 3 caracteres.');
      return;
    }
    if (!trimmedPassword) {
      setError('Por favor, introduza uma palavra-passe.');
      return;
    }
    if (trimmedPassword.length < 4) {
      setError('A palavra-passe deve ter pelo menos 4 caracteres.');
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      setError('As palavras-passe introduzidas não coincidem.');
      return;
    }

    try {
      const admin = createFirstAdmin(trimmedUsername, trimmedPassword, selectedTribunalId || undefined);
      setSuccess('Administrador registado com sucesso! A iniciar sessão...');
      setTimeout(() => {
        onLoginSuccess(admin);
      }, 1200);
    } catch (err) {
      setError('Ocorreu um erro ao registar o administrador.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    const list = getUsers();
    const foundUser = list.find(
      u => u.username.trim().toLowerCase() === cleanUsername
    );

    if (!foundUser || (foundUser.password || '').trim() !== cleanPassword) {
      setError('Utilizador ou palavra-passe incorreta.');
      return;
    }

    if (foundUser.active === false) {
      setError('Esta conta de utilizador encontra-se inativa. Por favor, contacte o administrador do sistema.');
      return;
    }

    if (foundUser.needsSetup) {
      setSetupUser(foundUser);
      setNewUsername(foundUser.username); // pre-populate with current full name / username as suggestion
      setError('');
      setSuccess('');
      return;
    }

    setActiveUser(foundUser);
    onLoginSuccess(foundUser);
  };

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimUser = newUsername.trim();
    const trimPass = newPassword.trim();
    const trimConf = confirmNewPassword.trim();

    if (!trimUser) {
      setError('Por favor, introduza o novo nome de utilizador.');
      return;
    }
    if (trimUser.length < 3) {
      setError('O nome de utilizador deve ter pelo menos 3 caracteres.');
      return;
    }
    if (!trimPass) {
      setError('Por favor, introduza a nova palavra-passe.');
      return;
    }
    if (trimPass.length < 4) {
      setError('A palavra-passe deve ter pelo menos 4 caracteres.');
      return;
    }
    if (trimPass === '123') {
      setError('Por razões de segurança, a nova palavra-passe não pode ser "123".');
      return;
    }
    if (trimPass !== trimConf) {
      setError('As palavras-passe introduzidas não coincidem.');
      return;
    }

    const list = getUsers();
    const usernameExists = list.some(
      u => u.username.trim().toLowerCase() === trimUser.toLowerCase() && 
           u.username.trim().toLowerCase() !== setupUser.username.trim().toLowerCase()
    );

    if (usernameExists) {
      setError('Este nome de utilizador já se encontra em utilização.');
      return;
    }

    // Update user in local storage
    const updatedUsers = list.map(u => {
      if (u.username.toLowerCase() === setupUser.username.toLowerCase()) {
        return {
          ...u,
          username: trimUser,
          password: trimPass,
          needsSetup: false
        };
      }
      return u;
    });

    localStorage.setItem('gestao_processos_users', JSON.stringify(updatedUsers));
    
    const updatedUser = updatedUsers.find(u => u.username.toLowerCase() === trimUser.toLowerCase());

    setSuccess('Conta configurada com sucesso! A iniciar sessão...');
    setTimeout(() => {
      setActiveUser(updatedUser);
      onLoginSuccess(updatedUser);
    }, 1200);
  };  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col lg:flex-row font-sans selection:bg-zinc-800 selection:text-white antialiased">
      {/* LEFT PANEL: BREATHTAKING WELCOME BOX */}
      <div className="flex-1 bg-zinc-900 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-zinc-800 relative overflow-hidden">
        {/* Abstract background graphics */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none">
          <div className="absolute -left-10 -top-10 w-96 h-96 rounded-full border border-white"></div>
          <div className="absolute right-0 bottom-0 w-80 h-80 rounded-full border border-white"></div>
        </div>

        {/* Header brand */}
        <div className="flex items-center gap-3.5 z-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-slate-700 to-zinc-900 flex items-center justify-center text-white border border-zinc-650 shadow-md">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">Tribunais da República</h1>
            <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase mt-0.5 block">Portal de Apoio Judicial v2.4</span>
          </div>
        </div>

        {/* Main core welcome body */}
        <div className="my-auto py-12 lg:py-0 max-w-xl z-10 space-y-8">
          <div className="space-y-4">
            <span className="bg-zinc-800 text-zinc-350 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border border-zinc-700 inline-block animate-pulse">
              🛡️ Base de Dados Local Segura
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight font-display leading-[1.1] select-none">
              Portal de Apoio à Célula e Expediente Judicial
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-normal leading-relaxed select-none">
              Bem-vindo à ferramenta unificada local de tramitação processual. Concebida especificamente para oficiais e técnicos judiciais agilizarem as suas tarefas diárias de consulta, registo de ocorrências e expedição de notificações.
            </p>
          </div>

          {/* Quick list features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5 p-4.5 bg-zinc-950/40 border border-zinc-800 rounded-2xl select-none">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                ⚡ Pesquisa Ágil
              </span>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Localize e consulte processos, o seu andamento, fases ativas e o arquivo de atos em segundos.
              </p>
            </div>

            <div className="space-y-1.5 p-4.5 bg-zinc-950/40 border border-zinc-800 rounded-2xl select-none">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                📅 Alertas e Agenda
              </span>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Consulte datas limite com sinalização e alarmes no painel para um controlo de tempo rigoroso.
              </p>
            </div>

            <div className="space-y-1.5 p-4.5 bg-zinc-950/40 border border-zinc-800 rounded-2xl select-none">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                📂 Disco Amovível e Backups
              </span>
              <p className="text-[11px] text-zinc-400 leading-normal">
                Sincronia automática de base de dados SQLite simulada e backups agendados no Disco C local.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info lock */}
        <div className="text-[11px] text-zinc-500 z-10 flex items-center gap-1.5 select-none">
          <Lock className="h-3 w-3 text-zinc-400" />
          <span>Direitos exclusivos do utilizador local • Proteção física offline integral</span>
        </div>
      </div>

      {/* RIGHT PANEL: SPACIOUS WORKBENCH */}
      <div className="w-full lg:w-[450px] xl:w-[500px] bg-[#fdfdfd] flex flex-col justify-center p-8 sm:p-12 lg:p-16 relative">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-zinc-900 font-display tracking-tight">
              {setupUser 
                ? 'Configuração de Acesso' 
                : isFirstRun 
                  ? 'Configuração do Sistema' 
                  : 'Aceder ao Portal'}
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {setupUser
                ? `Olá, ${setupUser.fullName || setupUser.username}. Por questões de segurança, configure o seu nome de utilizador e palavra-passe personalizados para o primeiro acesso.`
                : isFirstRun
                  ? 'Registe o primeiro utilizador administrador com direitos para parametrizar o tribunal e utilizadores'
                  : 'Introduza as suas credenciais locais para iniciar sessão e começar a tramitar'}
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6 sm:p-8 space-y-5">
            {setupUser ? (
              /* First Login account setup */
              <form onSubmit={handleSetupSubmit} className="space-y-5">
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-[11px] text-zinc-600 leading-relaxed">
                  <span className="font-bold block mb-1 text-zinc-850">🔒 Configuração Inicial Obrigatória:</span>
                  Configure os seus novos dados de acesso. O seu nome completo original permanecerá vinculado para garantir os seus acessos aos processos.
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 p-3 border border-red-100 text-xs text-red-700 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100 text-xs text-emerald-700 flex items-start gap-2.5">
                    <UserCheck className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{success}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="setup-username" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Novo Nome de Utilizador
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      id="setup-username"
                      name="newUsername"
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="Escolha o seu nome de utilizador"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="setup-password" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Nova Palavra-Passe
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      id="setup-password"
                      name="newPassword"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200/80 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="Min. 4 caracteres (diferente de 123)"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="setup-confirm-password" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Confirmar Nova Palavra-Passe
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-zinc-400 font-bold" />
                    </div>
                    <input
                      id="setup-confirm-password"
                      name="confirmNewPassword"
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200/80 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="Confirme a nova palavra-passe"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSetupUser(null);
                      setError('');
                      setSuccess('');
                    }}
                    className="w-1/3 py-2.5 px-4 rounded-xl text-sm font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-all font-display cursor-pointer text-center"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-zinc-950 hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-zinc-950 transition-all font-display shadow-sm cursor-pointer"
                  >
                    Confirmar e Entrar
                  </button>
                </div>
              </form>
            ) : isFirstRun ? (
              /* First run registration */
              <form onSubmit={handleRegisterAdmin} className="space-y-5">
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-[11px] text-zinc-600 leading-relaxed">
                  <span className="font-bold block mb-1 text-zinc-850">⚠️ Primeiro Registo Local:</span>
                  O primeiro utilizador registado neste dispositivo assume automaticamente a categoria de <strong>Administrador (Admin)</strong>. Guarde bem estas credenciais.
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 p-3 border border-red-100 text-xs text-red-700 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100 text-xs text-emerald-700 flex items-start gap-2.5">
                    <UserCheck className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{success}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="admin-username" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Nome de Utilizador
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      id="admin-username"
                      name="username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="ex: tecnico_silva"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="admin-password" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Palavra-Passe
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      id="admin-password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200/80 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="admin-confirm-password" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Confirmar Palavra-Passe
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-zinc-400 font-bold" />
                    </div>
                    <input
                      id="admin-confirm-password"
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200/80 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="admin-tribunal" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Tribunal Associado *
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Landmark className="h-4 w-4 text-zinc-400" />
                    </div>
                    <select
                      id="admin-tribunal"
                      required
                      value={selectedTribunalId}
                      onChange={(e) => setSelectedTribunalId(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-200/80 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-white focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all cursor-pointer"
                    >
                      {tribunaisList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.tribunal} ({t.localidade})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-zinc-950 hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-zinc-950 transition-all font-display shadow-sm cursor-pointer"
                  >
                    Registar Administrador e Entrar
                  </button>
                </div>
              </form>
            ) : (
              /* Regular login form */
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="rounded-xl bg-red-50 p-3 border border-red-105 text-xs text-red-700 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="login-username" className="block text-xs font-medium text-zinc-650 mb-1.5">
                    Nome de Utilizador
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <User className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-205 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="Introduza o seu nome de utilizador"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-medium text-zinc-650">
                      Palavra-Passe
                    </label>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-zinc-205 pl-9 pr-3 py-2 text-sm text-zinc-900 bg-zinc-50/20 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950/30 focus:outline-hidden transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-zinc-950 hover:bg-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-zinc-950 transition-all font-display shadow-sm cursor-pointer"
                  >
                    Iniciar Sessão
                  </button>
                </div>

                {!(window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') && (
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Pretende realmente repor todo o sistema para o estado inicial? Isto apagará a base de dados simulada.")) {
                            localStorage.clear();
                            initLocalStorageSeed();
                            const list = getUsers();
                            setRegisteredUsersList(list);
                            if (list.length === 0) {
                              setIsFirstRun(true);
                              setUsername('');
                              setPassword('');
                            } else {
                              setIsFirstRun(false);
                              setUsername('antonio.j.gomes@csm.org.pt');
                              setPassword('123');
                            }
                            setConfirmPassword('');
                            setError('');
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 bg-zinc-50/55 hover:bg-zinc-100 border border-zinc-200 rounded px-2 py-1 cursor-pointer transition-all"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Repor Sistema Completo
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Deseja semear os 4 processos fictícios de teste para o ambiente de desenvolvimento, incluindo juízes, procuradores, funcionários, advogados e partes?")) {
                            const res = seedFictitiousData();
                            window.alert(res.message);
                            // Refresh accounts list
                            setRegisteredUsersList(getUsers());
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 rounded px-2 py-1 cursor-pointer transition-all font-semibold"
                      >
                        🌱 Semear 4 Casos Fictícios
                      </button>

                      {registeredUsersList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowSavedCredentials(!showSavedCredentials)}
                          className="inline-flex items-center gap-1 text-[10px] text-zinc-455 hover:text-blue-600 bg-zinc-50/55 hover:bg-zinc-100 border border-zinc-200 rounded px-2 py-1 cursor-pointer transition-all font-semibold"
                        >
                          🔑 {showSavedCredentials ? "Ocultar Contas" : "Ver Contas no LocalStorage"}
                        </button>
                      )}
                    </div>

                    {showSavedCredentials && registeredUsersList.length > 0 && (
                      <div className="w-full text-left bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-650 space-y-2 mt-1.5 animate-in fade-in duration-100">
                        <span className="font-bold text-slate-800 block">Contas dadas como criadas na Sandbox:</span>
                        <div className="space-y-1">
                          {registeredUsersList.map((u, i) => (
                            <div 
                              key={i} 
                              onClick={() => {
                                setUsername(u.username);
                                setPassword(u.password || '');
                              }}
                              className="flex justify-between items-center border-b border-slate-100 pb-1 last:border-0 last:pb-0 font-mono text-[10.5px] cursor-pointer hover:bg-white p-1 rounded transition-colors group"
                              title="Clique para preencher"
                            >
                              <span className="text-slate-600 group-hover:text-blue-600 group-hover:font-medium transition-colors">👤 {u.username} ({u.role})</span>
                              <span className="font-bold text-slate-900 bg-slate-200/50 hover:bg-blue-100 px-1.5 py-0.2 rounded transition-colors select-all">
                                Pas: {u.password}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-455 leading-normal italic">
                          * Clique em qualquer conta acima para preenchimento rápido automático.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>

          <p className="text-center text-[10px] text-zinc-400 leading-none">
            República Portuguesa • Direção-Geral da Administração da Justiça
          </p>
        </div>
      </div>
    </div>
  );
}
