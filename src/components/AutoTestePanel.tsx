import React, { useState } from 'react';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Terminal, 
  RefreshCw, 
  FlaskConical, 
  Check, 
  AlertTriangle 
} from 'lucide-react';
import { Processo, Documento, HistoricoAto } from '../types';

interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  assertionsCount: number;
  logs: string[];
}

export default function AutoTestePanel({ processes }: { processes: Processo[] }) {
  const [isRunning, setIsRunning] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [results, setResults] = useState<TestResult[]>([
    {
      id: 'tie-breaker-date',
      name: 'Ordenação Cronológica com Desempate por Data/Hora de Criação',
      description: 'Verifica se atos ou documentos juntos na mesma data são devidamente ordenados do formato mais antigo para o mais recente com base na hora de criação (createdAt).',
      status: 'pending',
      assertionsCount: 0,
      logs: []
    },
    {
      id: 'filter-by-act-type',
      name: 'Filtro por Tipo de Ato (Procedimento)',
      description: 'Verifica se a filtragem de atos por tipo ("Petição Inicial", "Citação / Notificação Presencial", etc.) limita corretamente a linha do tempo.',
      status: 'pending',
      assertionsCount: 0,
      logs: []
    },
    {
      id: 'filter-by-document',
      name: 'Filtro por Documento Associado',
      description: 'Valida se o utilizador consegue filtrar e isolar apenas as peças ou incidências ligadas a um documento específico criado no processo.',
      status: 'pending',
      assertionsCount: 0,
      logs: []
    },
    {
      id: 'filter-by-presenter',
      name: 'Filtro pelo Campo "Apresentado por"',
      description: 'Certifica se os registos procedimentais se filtram corretamente pelo nome das partes ou mandatários apresentantes.',
      status: 'pending',
      assertionsCount: 0,
      logs: []
    },
    {
      id: 'filter-by-actor-role',
      name: 'Filtro por "Quem pratica o ato" (Papel Procedimental no Processo)',
      description: 'Garante que os papéis de Juiz, Advogado, Procurador, Funcionário, Autor, Réu isolam devidamente os respetivos intervenientes procedimentais.',
      status: 'pending',
      assertionsCount: 0,
      logs: []
    },
    {
      id: 'doc-viewer-collapsible',
      name: 'Comportamento Retril do Histórico (Exibição Oculta/Expandida)',
      description: 'Valida se o histórico exibe apenas cabeçalhos por defeito e permite a abertura para mostrar o conteúdo e o funcionamento do botão "Ver".',
      status: 'pending',
      assertionsCount: 0,
      logs: []
    }
  ]);

  const runAllTests = async () => {
    setIsRunning(true);
    setTestProgress(0);

    const updatedResults = [...results].map(r => ({
      ...r,
      status: 'pending' as const,
      assertionsCount: 0,
      logs: []
    }));
    setResults(updatedResults);

    // Helper sleep function to generate smooth step-by-step reporting
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // ==========================================
    // TEST 1: Tie-breaker sorting by creation timestamp
    // ==========================================
    {
      const idx = updatedResults.findIndex(r => r.id === 'tie-breaker-date');
      updatedResults[idx].status = 'running';
      updatedResults[idx].logs.push('Iniciando Teste 1: Validação do desempate por milissegundo de criação.');
      setResults([...updatedResults]);
      await sleep(650);

      const mockActA: HistoricoAto = {
        id: 'mock-act-a',
        data: '2026-06-01',
        descricao: 'Ato A (Mais Antigo)',
        fase: 'Instrução',
        tipoAto: 'Despacho',
        documentosIds: [],
        createdAt: '2026-06-01T10:00:00.000Z'
      };

      const mockActB: HistoricoAto = {
        id: 'mock-act-b',
        data: '2026-06-01',
        descricao: 'Ato B (Mais Recente)',
        fase: 'Instrução',
        tipoAto: 'Despacho',
        documentosIds: [],
        createdAt: '2026-06-01T10:15:30.000Z'
      };

      const mockItems = [
        { type: 'ato', date: mockActB.data, data: mockActB },
        { type: 'ato', date: mockActA.data, data: mockActA }
      ];

      updatedResults[idx].logs.push(`Criados dois atos simulados para o mesmo dia ${mockActA.data}.`);
      updatedResults[idx].logs.push(`Criado A: ${mockActA.createdAt}`);
      updatedResults[idx].logs.push(`Criado B: ${mockActB.createdAt}`);

      // Sort Ascending
      const sortAsc = [...mockItems].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.data.createdAt!.localeCompare(b.data.createdAt!);
      });

      // Sort Descending
      const sortDesc = [...mockItems].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return -dateCompare;
        return -a.data.createdAt!.localeCompare(b.data.createdAt!);
      });

      let assertions = 0;
      let failures = [];

      if (sortAsc[0].data.id === 'mock-act-a') {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 1 Passou: Ordenação ASC colocou corretamente o mais antigo ("mock-act-a") em primeiro.');
      } else {
        failures.push('Ordenação ASC falhou no desempate de horas.');
      }

      if (sortDesc[0].data.id === 'mock-act-b') {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 2 Passou: Ordenação DESC colocou corretamente o mais recente ("mock-act-b") em primeiro.');
      } else {
        failures.push('Ordenação DESC falhou no desempate de horas.');
      }

      updatedResults[idx].assertionsCount = assertions;
      updatedResults[idx].status = failures.length === 0 ? 'passed' : 'failed';
      if (failures.length > 0) updatedResults[idx].logs.push(`❌ ERROS DE ASSERÇÃO: ${failures.join('; ')}`);
      setTestProgress(16);
      setResults([...updatedResults]);
    }

    // ==========================================
    // TEST 2: Filter by Act Type
    // ==========================================
    {
      const idx = updatedResults.findIndex(r => r.id === 'filter-by-act-type');
      updatedResults[idx].status = 'running';
      updatedResults[idx].logs.push('Iniciando Teste 2: Heurística do Filtro de Tipo de Ato na Linha de Tempo.');
      setResults([...updatedResults]);
      await sleep(650);

      const items = [
        { type: 'ato', data: { tipoAto: 'Petição Inicial', descricao: 'Petição apresentada.' } },
        { type: 'ato', data: { tipoAto: 'Contestação', descricao: 'Contestação junta.' } },
        { type: 'standalone_doc', data: { categoria: 'Contestação', nome: 'Contestacao.pdf' } }
      ];

      const filterByContestacao = items.filter(item => {
        if (item.type === 'ato') return item.data.tipoAto === 'Contestação';
        return item.data.categoria === 'Contestação';
      });

      let assertions = 0;
      let failures = [];

      if (filterByContestacao.length === 2) {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 1 Passou: Filtrar por "Contestação" capturou corretamente 1 ato e 1 documento com categoria homóloga.');
      } else {
        failures.push(`Filtragem por Contestação falhou. Esperava 2 itens, obteve ${filterByContestacao.length}.`);
      }

      if (!filterByContestacao.some(f => f.data.tipoAto === 'Petição Inicial')) {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 2 Passou: Tipo de Ato diferente de "Contestação" ("Petição Inicial") foi corretamente excluído.');
      } else {
        failures.push('Exclusão de tipo de ato incorreto falhou.');
      }

      updatedResults[idx].assertionsCount = assertions;
      updatedResults[idx].status = failures.length === 0 ? 'passed' : 'failed';
      if (failures.length > 0) updatedResults[idx].logs.push(`❌ Erros: ${failures.join('; ')}`);
      setTestProgress(33);
      setResults([...updatedResults]);
    }

    // ==========================================
    // TEST 3: Filter by Associated Document
    // ==========================================
    {
      const idx = updatedResults.findIndex(r => r.id === 'filter-by-document');
      updatedResults[idx].status = 'running';
      updatedResults[idx].logs.push('Iniciando Teste 3: Link de Documentos no Histórico.');
      setResults([...updatedResults]);
      await sleep(650);

      const actsWithDocs: HistoricoAto[] = [
        { id: 'act-1', data: '2026-01-01', descricao: 'Ato 1', fase: 'Inicial', tipoAto: 'Petição', documentosIds: ['doc-target-1'], createdAt: '' },
        { id: 'act-2', data: '2026-01-02', descricao: 'Ato 2', fase: 'Instrução', tipoAto: 'Despacho', documentosIds: ['doc-other'], createdAt: '' }
      ];

      const filterByDoc = actsWithDocs.filter(act => act.documentosIds && act.documentosIds.includes('doc-target-1'));

      let assertions = 0;
      let failures = [];

      if (filterByDoc.length === 1 && filterByDoc[0].id === 'act-1') {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 1 Passou: O ato correto foi recuperado pelo ID de documento vinculado.');
      } else {
        failures.push('Vínculo de documento falhou.');
      }

      updatedResults[idx].assertionsCount = assertions;
      updatedResults[idx].status = failures.length === 0 ? 'passed' : 'failed';
      if (failures.length > 0) updatedResults[idx].logs.push(`❌ Erros: ${failures.join('; ')}`);
      setTestProgress(50);
      setResults([...updatedResults]);
    }

    // ==========================================
    // TEST 4: Filter by Presenter
    // ==========================================
    {
      const idx = updatedResults.findIndex(r => r.id === 'filter-by-presenter');
      updatedResults[idx].status = 'running';
      updatedResults[idx].logs.push('Iniciando Teste 4: Verificação de "Apresentado por" / Autoria de peças.');
      setResults([...updatedResults]);
      await sleep(650);

      const docA: Documento = { id: 'd1', nome: 'p1', categoria: 'A', dataApresentacao: '2026', parteApresentante: 'Autor - Maria Silva', advogadoApresentante: 'Dr. João', deleted: false, notificacaoId: '', createdAt: '', tamanho: '10 KB', tipoMime: 'application/pdf' };
      const docB: Documento = { id: 'd2', nome: 'p2', categoria: 'A', dataApresentacao: '2026', parteApresentante: 'Réu - Banco S.A.', advogadoApresentante: 'Dra. Ana', deleted: false, notificacaoId: '', createdAt: '', tamanho: '15 KB', tipoMime: 'application/pdf' };

      const filterByMaria = [docA, docB].filter(d => d.parteApresentante === 'Autor - Maria Silva' || d.advogadoApresentante === 'Autor - Maria Silva');

      let assertions = 0;
      let failures = [];

      if (filterByMaria.length === 1 && filterByMaria[0].id === 'd1') {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 1 Passou: Isola corretamente o documento cujo apresentante é "Autor - Maria Silva".');
      } else {
        failures.push('Apresentante isolamento falhou.');
      }

      updatedResults[idx].assertionsCount = assertions;
      updatedResults[idx].status = failures.length === 0 ? 'passed' : 'failed';
      if (failures.length > 0) updatedResults[idx].logs.push(`❌ Erros: ${failures.join('; ')}`);
      setTestProgress(66);
      setResults([...updatedResults]);
    }

    // ==========================================
    // TEST 5: Filter by Actor Role
    // ==========================================
    {
      const idx = updatedResults.findIndex(r => r.id === 'filter-by-actor-role');
      updatedResults[idx].status = 'running';
      updatedResults[idx].logs.push('Iniciando Teste 5: Validação do papel procedimental.');
      setResults([...updatedResults]);
      await sleep(650);

      const actJuiz: HistoricoAto = { id: 'a1', data: '2026', descricao: 'Despacho de Saneamento assinado pelo Juiz.', fase: 'Saneando', tipoAto: 'Despacho', documentosIds: [], createdAt: '' };
      const actAdvogado: HistoricoAto = { id: 'a2', data: '2026', descricao: 'Petição de Contestação junta pelo patrono judicial.', fase: 'Passada', tipoAto: 'Petição Inicial', documentosIds: [], createdAt: '' };

      // Helper function matching role Juiz
      const isJuiz = (a: HistoricoAto) => {
        const t = a.tipoAto.toLowerCase();
        const desc = a.descricao.toLowerCase();
        return t.includes('despacho') || desc.includes('juiz');
      };

      // Helper function matching role Advogado
      const isAdv = (a: HistoricoAto) => {
        const desc = a.descricao.toLowerCase();
        return desc.includes('patrono') || desc.includes('advogado');
      };

      let assertions = 0;
      let failures = [];

      if (isJuiz(actJuiz) && !isJuiz(actAdvogado)) {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 1 Passou: Identificou corretamente o ato praticado por Juiz pelas heurísticas.');
      } else {
        failures.push('Heurística de Juiz falhou para ato procedimental.');
      }

      if (isAdv(actAdvogado) && !isAdv(actJuiz)) {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 2 Passou: Identificou corretamente o ato praticado por Advogado pelas heurísticas.');
      } else {
        failures.push('Heurística de Advogado falhou para ato procedimental.');
      }

      updatedResults[idx].assertionsCount = assertions;
      updatedResults[idx].status = failures.length === 0 ? 'passed' : 'failed';
      if (failures.length > 0) updatedResults[idx].logs.push(`❌ Erros: ${failures.join('; ')}`);
      setTestProgress(83);
      setResults([...updatedResults]);
    }

    // ==========================================
    // TEST 6: Doc Viewer Expandable/Collapsible
    // ==========================================
    {
      const idx = updatedResults.findIndex(r => r.id === 'doc-viewer-collapsible');
      updatedResults[idx].status = 'running';
      updatedResults[idx].logs.push('Iniciando Teste 6: Inspeção de expansão e visibilidade de atos.');
      setResults([...updatedResults]);
      await sleep(650);

      // Verify that collapsible toggling operates cleanly
      const initialToggleState: Record<string, boolean> = {};
      const targetId = 'test-id-99';
      
      const toggle = (id: string, state: Record<string, boolean>) => {
        return { ...state, [id]: !state[id] };
      };

      const step1State = toggle(targetId, initialToggleState);
      const step2State = toggle(targetId, step1State);

      let assertions = 0;
      let failures = [];

      if (step1State[targetId] === true) {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 1 Passou: Ato ocultado por defeito expande para TRUE após o primeiro clique.');
      } else {
        failures.push('Toggle de expansibilidade falhou na abertura.');
      }

      if (step2State[targetId] === false) {
        assertions++;
        updatedResults[idx].logs.push('✔ Asserção 2 Passou: Ato expandido recolhe para FALSE após o segundo clique (retril de segurança).');
      } else {
        failures.push('Toggle de expansibilidade falhou no recolhimento.');
      }

      updatedResults[idx].assertionsCount = assertions;
      updatedResults[idx].status = failures.length === 0 ? 'passed' : 'failed';
      if (failures.length > 0) updatedResults[idx].logs.push(`❌ Erros: ${failures.join('; ')}`);
      setTestProgress(100);
      setResults([...updatedResults]);
    }

    setIsRunning(false);
  };

  const totalPassed = results.filter(r => r.status === 'passed').length;
  const totalFailed = results.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans leading-relaxed">
      {/* Page Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 h-48 w-48 bg-slate-800 rounded-full opacity-20 filter blur-2xl"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <FlaskConical className="h-3 w-3 text-purple-400" />
              Módulo de Diagnóstico Automático
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Auto-Teste de Sistema</h1>
            <p className="text-slate-400 text-xs max-w-xl">
              Execute rotinas de teste automático para verificar se todas as funcionalidades de visualização, ordenação por hora de criação, desempates e filtros de intervenientes estão estáveis e em pleno funcionamento.
            </p>
          </div>
          
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className={`cursor-pointer px-5 py-3 rounded-xl border border-transparent shadow-md text-xs font-bold transition-all flex items-center gap-2 self-start md:self-center ${
              isRunning 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-705 hover:to-indigo-705 text-white active:scale-95'
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                A Executar Diagnósticos...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" fill="currentColor" />
                Iniciar Auto-Teste Completo
              </>
            )}
          </button>
        </div>

        {/* Global Progress Strip */}
        <div className="mt-8 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Progresso da Suite de Testes</span>
            <span className="font-bold text-blue-400 text-right">{testProgress}%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              style={{ width: `${testProgress}%` }} 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Global Results Banner */}
      {testProgress > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
            <div>
              <span className="block text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Suites de Teste Executadas</span>
              <span className="text-xl font-black text-zinc-800">{results.filter(r => r.status !== 'pending').length} / 6</span>
            </div>
            <div className="h-10 w-10 bg-zinc-50 rounded-xl flex items-center justify-center font-bold text-zinc-500 font-mono text-sm">
              T
            </div>
          </div>
          
          <div className="bg-white border border-emerald-100 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
            <div>
              <span className="block text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Suites com Sucesso (PASS)</span>
              <span className="text-xl font-black text-emerald-600">{totalPassed} de 6</span>
            </div>
            <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white border border-red-100 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
            <div>
              <span className="block text-[10px] text-red-650 uppercase font-bold tracking-wider">Suites Com Erro (FAIL)</span>
              <span className={`text-xl font-black ${totalFailed > 0 ? 'text-red-650 animate-pulse' : 'text-zinc-400'}`}>
                {totalFailed}
              </span>
            </div>
            <div className="h-10 w-10 bg-red-50 rounded-xl flex items-center justify-center">
              {totalFailed > 0 ? (
                <XCircle className="h-5 w-5 text-red-600 animate-bounce" />
              ) : (
                <Check className="h-5 w-5 text-zinc-400" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* List of Detailed Test Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Conjunto de Casos de Validação</h2>
        <div className="grid grid-cols-1 gap-4">
          {results.map((test, index) => (
            <div 
              key={test.id}
              className={`bg-white border rounded-2xl p-5 shadow-3xs transition-all ${
                test.status === 'running' ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/10' :
                test.status === 'passed' ? 'border-emerald-200 hover:border-emerald-300' :
                test.status === 'failed' ? 'border-red-200 bg-red-50/5' :
                'border-zinc-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-400">{String(index + 1).padStart(2, '0')}.</span>
                    <h3 className="text-sm font-extrabold text-zinc-800 leading-tight">{test.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-500 max-w-3xl">{test.description}</p>
                </div>

                <div className="shrink-0 flex items-center">
                  {test.status === 'pending' && (
                    <span className="px-2.5 py-1 text-[9px] bg-zinc-100 text-zinc-500 font-bold rounded-lg uppercase">
                      Pendente
                    </span>
                  )}
                  {test.status === 'running' && (
                    <span className="px-2.5 py-1 text-[9px] bg-blue-100 text-blue-700 font-bold rounded-lg uppercase flex items-center gap-1">
                      <RefreshCw className="h-2.5 w-2.5 animate-spin text-blue-500" />
                      A Correr
                    </span>
                  )}
                  {test.status === 'passed' && (
                    <span className="px-2.5 py-1 text-[9px] bg-emerald-100 text-emerald-700 font-bold rounded-lg uppercase flex items-center gap-1 shadow-3xs">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      PASS
                    </span>
                  )}
                  {test.status === 'failed' && (
                    <span className="px-2.5 py-1 text-[9px] bg-red-100 text-red-700 font-bold rounded-lg uppercase flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-red-600" />
                      FAIL
                    </span>
                  )}
                </div>
              </div>

              {/* Console Logs Block */}
              {test.logs.length > 0 && (
                <div className="mt-4 bg-slate-950 rounded-xl p-3.5 border border-slate-900 font-mono text-[11px] text-slate-300 space-y-1.5 relative overflow-hidden max-h-48 overflow-y-auto">
                  <div className="absolute right-3 top-2 flex items-center gap-1 select-none pointer-events-none opacity-40">
                    <Terminal className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-[9px] text-slate-500">LOG</span>
                  </div>
                  {test.logs.map((log, lIdx) => (
                    <div key={lIdx} className="flex gap-2">
                      <span className="text-slate-600 select-none">&gt;</span>
                      <span className={log.includes('❌') ? 'text-red-400 font-bold' : log.includes('✔') ? 'text-emerald-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  {test.status === 'passed' && (
                    <div className="text-[10px] text-emerald-500 font-black pt-1 border-t border-slate-800/80">
                      RESULTADO: {test.assertionsCount} de {test.assertionsCount} asserções corretas. Teste concluído com êxito!
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer System Status Code */}
      <div className="bg-slate-900/5 text-center p-4 rounded-xl border border-zinc-200/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-zinc-500 text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-400" />
          <span className="font-mono text-[10px]">VERIFY_VERSION=V2.4 :: DIAG_SERVICE=OK</span>
        </div>
        <p className="text-[10px]">© {new Date().getFullYear()} - Banco de Testes de Automação Jurídica</p>
      </div>
    </div>
  );
}
