import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  FilePlus2, 
  FolderSearch, 
  Clock, 
  FileText, 
  RefreshCw, 
  Briefcase, 
  HelpCircle, 
  ChevronRight, 
  Check, 
  AlertTriangle, 
  HardDrive,
  Info,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react';

interface ManualUtilizadorProps {
  onNavigateToTab?: (tab: 'inicial' | 'pesquisa' | 'registo' | 'disco') => void;
}

export default function ManualUtilizador({ onNavigateToTab }: ManualUtilizadorProps) {
  const [activeChapter, setActiveChapter] = useState<string>('intro');
  const [searchQuery, setSearchQuery] = useState('');

  const chapters = [
    {
      id: 'intro',
      title: '📖 Introdução ao JurisLocal',
      category: 'Geral',
      tags: ['geral', 'juris', 'vistas', 'sistema']
    },
    {
      id: 'registo',
      title: '1. Novo Registo e Autuação',
      category: 'Procedimentos',
      tags: ['registo', 'autuação', 'crime', 'cível', 'campos', 'apensos', 'notificações', 'valor', 'ficheiros', 'anexos']
    },
    {
      id: 'pesquisa',
      title: '2. Pesquisa e Consulta de Processos',
      category: 'Procedimentos',
      tags: ['pesquisar', 'consulta', 'filtro', 'fuzzy', 'levenshtein', 'resultados', 'busca']
    },
    {
      id: 'ficha',
      title: '3. Ficha do Processo (Edição e Ocultação)',
      category: 'Visualização',
      tags: ['ficha', 'ocultar', 'editar', 'autuação', 'juiz', 'advogados', 'modificar']
    },
    {
      id: 'tab-timeline',
      title: '4.1 Tab: Linha Temporal & Histórico',
      category: 'Abas Tecnológicas',
      tags: ['linha temporal', 'histórico', 'diligência', 'registo de ato', 'ocorrencia', 'agenda', 'calendário']
    },
    {
      id: 'tab-documentos',
      title: '4.2 Tab: Documentos Digitais',
      category: 'Abas Tecnológicas',
      tags: ['documentos', 'pdf', 'txt', 'descarga', 'impressão', 'compilar', 'arquivo', 'leitor']
    },
    {
      id: 'tab-estado',
      title: '4.3 Tab: Estado & Alarmes',
      category: 'Abas Tecnológicas',
      tags: ['estado', 'fase', 'alterar', 'alarmes', 'silenciar', 'concluir', 'prazos']
    },
    {
      id: 'tab-apensos',
      title: '4.4 Tab: Apensos & Conexões',
      category: 'Abas Tecnológicas',
      tags: ['apensos', 'relação', 'conectar', 'processos']
    },
    {
      id: 'splitview',
      title: '5. Split-View e Agenda de Prazos',
      category: 'Ecrã da Direita',
      tags: ['split-view', 'agenda', 'duplo painel', 'ocr', 'digitalização', 'assistente', 'minutador', 'automatização']
    }
  ];

  // Fuzzy match on chapters for search
  const filteredChapters = chapters.filter(ch => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return ch.title.toLowerCase().includes(query) || 
           ch.tags.some(tag => tag.toLowerCase().includes(query)) ||
           ch.category.toLowerCase().includes(query);
  });

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Search and Title banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-display tracking-tight text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-400" />
              Manual Oficial do Utilizador e Administrativo
            </h2>
            <p className="text-xs text-slate-350 max-w-xl">
              Documentação interativa geral das operações e rotinas do JurisLocal. Saiba como autuar, pesquisar, gerir prazos judiciais e emitir certidões.
            </p>
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar no manual..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-905 text-white placeholder-slate-450 border border-slate-700/80 rounded-xl px-9 py-2 text-xs focus:outline-hidden transition-all focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Left index navigation block */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4.5 space-y-4 shadow-3xs sticky top-3">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-1.5">
            Índice de Capítulos
          </span>
          
          <nav className="space-y-1">
            {filteredChapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChapter(ch.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  activeChapter === ch.id
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-100 font-extrabold shadow-3xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <span className="truncate">{ch.title}</span>
                <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${
                  activeChapter === ch.id ? 'transform translate-x-0.5 text-indigo-700 font-black' : 'text-slate-400'
                }`} />
              </button>
            ))}
            {filteredChapters.length === 0 && (
              <p className="text-xs italic text-slate-400 p-2 text-center">Nenhum capítulo encontrado.</p>
            )}
          </nav>
          
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 text-[10.5px] leading-relaxed text-slate-500">
            <strong className="text-slate-700 block mb-0.5">ℹ️ Dica Rápida:</strong>
            Os alarmes automáticos de processos são criados imediatamente na autuação (15 dias para Crime e 30 dias para Cível).
          </div>
        </div>

        {/* Right documentation content block */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">

          {/* CHAPTER: INTRODUÇÃO */}
          {activeChapter === 'intro' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Boas-vindas</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">JurisLocal • Solução Offline Independente</h3>
              </div>
              
              <p className="text-sm text-slate-600 leading-relaxed">
                O **JurisLocal** é a plataforma definitiva de expediente eletrónico, arquivo e gestão de processos judiciais de nível local. Desenhado para funcionar **100% offline** e com armazenamento isolado no dispositivo do tribunal (no "Disco C:\"), garante aos magistrados, procuradores e funcionários do tribunal a máxima segurança e soberania de dados processuais.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 pt-2">
                <div className="p-4 border border-emerald-100 bg-emerald-50/40 rounded-xl space-y-2">
                  <span className="text-xl">💼</span>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">Soberania Offline</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">Todos os ficheiros e metadados estão localizados permanentemente no espaço local física de armazenamento, prevenindo fugas de informação ou falhas de internet.</p>
                </div>
                <div className="p-4 border border-blue-100 bg-blue-50/40 rounded-xl space-y-2">
                  <span className="text-xl">⚡</span>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">Automatização Inteligente</h4>
                  <p className="text-[11px] text-blue-800 leading-relaxed">Leitor OCR integrado para documentos físicos, autuação automática baseada em digitalizações e sugestões inteligentes de minutas processuais.</p>
                </div>
                <div className="p-4 border border-amber-100 bg-amber-50/40 rounded-xl space-y-2">
                  <span className="text-xl">⏰</span>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">Segurança de Prazos</h4>
                  <p className="text-[11px] text-amber-800 leading-relaxed">Alarmes gerados automaticamente garantem que prazos legais (como as contestações em processos cíveis ou investigações criminais) nunca expiram.</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-500" />
                  Ecrãs e Fluxos de Trabalho Recomendados
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600 leading-relaxed pl-1">
                  <li>**Autuação**: Utilize a aba **"Novo Registo"** para cadastrar manualmente um caso ou use o **Assistente de OCR** no ecrã principal para digitalizar a Petição Inicial/Auto de Notícia recebido.</li>
                  <li>**Consulta e Instrução**: Localize o processo na aba **"Pesquisar Processos"**, abra o detalhe do caso e controle as provas, atos da linha de tempo, e ficheiros.</li>
                  <li>**Despachos e Documentação**: Na barra lateral direita do detalhe, use o **Minutador Inteligente** para gerar mandados de notificação ou despachos judiciais com base nos atos registados.</li>
                  <li>**Multitrabalho Isolado (Novos Separadores)**: Os menus principais na Página Inicial (Registo, Pesquisa, Explorador, Secretaria/Perfis, Manual) abrem autonomamente em **novos separadores** do browser. Isto permite manter uma vista de painel principal permanente enquanto trabalha de forma focada e em paralelo noutras áreas do JurisLocal.</li>
                </ol>
              </div>

              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => setActiveChapter('registo')}
                  className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Começar Manual: 1. Novo Registo</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}


          {/* CHAPTER: NOVO REGISTO */}
          {activeChapter === 'registo' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 1</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">Procedimento de Novo Registo e Autuação</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                A abertura de um novo processo cível ou crime no JurisLocal é feita através do formulário estrito de autuação na aba **"Novo Registo"**. Este ecrã gera instantaneamente a pasta raiz física do processo no diretório do tribunal (ex: `C:\GestaoProcessos\PROC-2026-X\`) e define os alarmes para segurança do expediente judicial.
              </p>

              <div className="bg-amber-50/70 border-l-4 border-amber-500 p-4 rounded-r-xl space-y-1.5 text-xs text-amber-950">
                <strong className="font-bold flex items-center gap-1">⏰ IMPORTANTE: Ativação Automática de Alarmes !</strong>
                <p className="leading-relaxed">
                  Para garantir o controlo absoluto do tempo e evitar a expiração de prazos legais, o JurisLocal cria **automaticamente** um alarme com prazos judiciais específicos logo no momento em que Grava o novo processo:
                </p>
                <ul className="list-disc pl-4 space-y-1 mt-1 font-medium text-amber-900">
                  <li>**Processos Crimes**: Alarme automático definido para **15 dias** após a data de autuação.</li>
                  <li>**Processos Cíveis**: Alarme automático definido para **30 dias** após a data de autuação (prazo padrão para contestação).</li>
                </ul>
              </div>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 pt-2">
                Explicação de Cada Campo a Preencher
              </h4>

              <div className="space-y-4 text-xs text-slate-650 leading-relaxed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">1. Número do Processo (Registo)</strong>
                    <p className="text-[11px]">Identificador do caso. Deve usar a notação padrão portuguesa ou judicial típica, por exemplo <code className="bg-slate-150 px-1 rounded text-red-700 font-mono text-[10px]">PROC-2026/020</code> ou <code className="bg-slate-150 px-1 rounded text-red-700 font-mono text-[10px]">Nuipc-123/26</code>. Campo obrigatório e único.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">2. Tipo de Processo (Cível vs Crime)</strong>
                    <p className="text-[11px]">Determina a natureza jurídica e altera os subcampos do formulário. Adicionalmente, rege o alarme inicial calculado automaticamente pelo sistema.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <strong className="text-slate-900 block font-bold text-[12px]">3. Autores / Demandantes & Réus / Demandados</strong>
                  <p className="text-[11px]">Partes ativas e passivas da lide. No caso de processos-crime, o Autor é tipicamente o *Ministério Público (MP)* e o Ofendido; o Réu é o *Arguido*. Podem ser adicionados vários nomes em lote clicando na tecla **Enter** ou botão de inserção rápida.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">4. Data de Autuação</strong>
                    <p className="text-[11px]">A data do momento da entrada da petição ou ocorrência do crime na secretaria judicial. É esta data que serve de âncora para os cálculos automáticos de prazos.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">5. Juiz Titular</strong>
                    <p className="text-[11px]">Sorteado ou designado legalmente para o caso. Há uma base de dados local de Magistrados, podendo também selecionar-se livremente.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">6. Advogados Provisórios das Partes</strong>
                    <p className="text-[11px]">Advogados associados ao Autor da Petição e ao Réu contestante. Útil para registar quem é legalmente mandatado no início do processo.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">7. Procuradores (Representantes Criminais)</strong>
                    <p className="text-[11px]">Procuradores adjuntos ou oficiais mandatados à representação processual do Réu ou do Estado para assinar as peças na secretaria.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">8. Apensos (Checkbox de Conexão)</strong>
                    <p className="text-[11px]">Permite assinalar que este novo caso é um apenso dependente (ex: procedimento cautelar ou recurso) de um processo principal já existente.</p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <strong className="text-slate-900 block font-bold text-[12px]">9. Notificações / Destinatários</strong>
                    <p className="text-[11px]">Lista prévia de contactos, correus, testemunhas ou mandatários do caso que devem ser informados automaticamente no decorrer das decisões.</p>
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50/50 border border-indigo-150 rounded-xl space-y-2">
                  <span className="text-indigo-950 font-bold block">Campos Condicionais de Ações Cíveis:</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-905 block">Valor da Ação:</strong>
                      <p className="text-[10px] text-slate-500">Valor em Euros. Regula os limites das alçadas recursivas judiciais (por exemplo, recursos para a Relação ou Supremo).</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-905 block">Espécie Cível:</strong>
                      <p className="text-[10px] text-slate-500">Identificação administrativa (ex: Acções de Condenação, Procedimentos Cautelares, Execuções).</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-905 block">Tipo de Ação Cível:</strong>
                      <p className="text-[10px] text-slate-500">Forma do processo de acordo com a lei processual civil (ex: Comum, Executivo, Urgente).</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <strong className="text-slate-900 block font-bold text-[12px]">10. Documentos Iniciais do Processo (Fila de Ficheiros)</strong>
                  <p className="text-[11px]">
                    Espaço para anexar diretamente os primeiros arquivos digitais pertencentes ao processo (ex: Petição Inicial em formato PDF ou Auto de Notícia da PSP/GNR). Para cada ficheiro adicionado provisoriamente à fila, deve selecionar a respetiva Categoria (Ex: *Petição Inicial*, *Certidão*, *Comprovativo*) e o autor apresentante. A secretaria criará os slots digitais correspondentes.
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs flex gap-3 text-emerald-950 items-start">
                <span className="text-xl shrink-0 mt-0.5">💡</span>
                <div className="space-y-1">
                  <strong className="font-bold block">Procedimento Prático Célere:</strong>
                  <p className="text-slate-700 leading-relaxed">
                    Após preencher todos os dados, clique no botão **"Autuar e Criar Pastas de Processo"**. O JurisLocal verificará a sintaxe, criará as pastas virtuais no ambiente local, anexará os ficheiros à Linha de Tempo geral e irá redirecioná-lo automaticamente ao ecrã de detalhe para que possa iniciar o trabalho.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* CHAPTER: PESQUISAR PROCESSOS */}
          {activeChapter === 'pesquisa' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 2</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">Pesquisa e Consulta de Processos</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                O JurisLocal possui motores de pesquisa avançados e com tolerância de digitação para garantir um acesso veloz e fiável aos autos criminais ou cíveis, bem como aos apensos, salvaguardando o tempo do expediente profissional.
              </p>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 pt-2 flex items-center gap-1.5">
                <FolderSearch className="h-4 w-4 text-blue-500" />
                Como funciona a Pesquisa de Processos (Campos e Filtros)
              </h4>

              <div className="text-xs text-slate-650 leading-relaxed space-y-4">
                <p>Navegue ao separador **"Pesquisar Processos"** no menu principal. O painel apresenta filtros rápidos de secretaria e o input de termo:</p>

                <ul className="list-disc pl-5 space-y-1.5">
                  <li>**Campos de Busca Unificada**: Permite colar todo ou parte do Número do processo, ou procurar pelo **Nome do Autor, do Réu, ou dos seus Advogados e Procuradores**.</li>
                  <li>**Distância de Edição de Levenshtein (Fuzzy Match)**: O sistema tolera pequenos erros ortográficos ou omissões ao pesquisar nomes de processos e advogados ou intervenientes. Por exemplo se escrever "Souza", a pesquisa retornará corretamente "Dr. Mário de Sousa Gomes", compensando gralhas e abreviaturas.</li>
                  <li>**Filtro por Tipo**: Segmentação instantânea selecionando entre *Todos*, *Apenas Processos Cíveis* ou *Apenas Processos Crimes*.</li>
                  <li>**Filtro por Juiz Titular**: Permite visualizar exclusivamente os autos atribuídos à competência de uma determinado Juiz da comarca.</li>
                  <li>**Filtro por Fase Processual**: Segmentação por estado atual da ação (ex: *Instrução Inicial*, *Concluso*, *Decisão Final*, *Arquivado*, etc.).</li>
                </ul>
              </div>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 pt-2 flex items-center gap-1.5">
                Elementos do Resultado de Pesquisa
              </h4>

              <div className="text-xs text-slate-650 leading-relaxed space-y-3">
                <p>O resultado é atualizado em tempo real à medida que digita ou alterna filtros. Cada linha/card de processo nos resultados indica:</p>
                
                <div className="p-4 border border-slate-250 bg-slate-50/50 rounded-xl space-y-2 font-mono text-[11px] text-slate-700 shadow-2xs">
                  <div className="flex items-center gap-2 justify-between flex-wrap">
                    <span className="font-extrabold text-blue-900 text-sm">PROC-2026/011 ⏰⚠️</span>
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] rounded font-bold">ALERTA ATIVO</span>
                  </div>
                  <div>**Tipo / Espécie**: Processo Cível | Ordinário</div>
                  <div>**Data Autuação**: 2026-01-20</div>
                  <div>**Juiz Titular**: Dra. Isabel Maria de Albuquerque</div>
                  <div>**Partes**: Braga Comercial, Lda @ Imobiliária Sol do Norte, Lda.</div>
                  <div>**Fase Processual Corrente**: Instrução Inicial</div>
                </div>

                <p className="text-xs">
                  **Acesso Focado (Abrir Processo)**: Para visualizar e trabalhar num processo específico, clique no **Número do Processo (link a azul)** ou no botão **"Visualizar Processo Completo"**. O interface mudará para a perspetiva de ecrã integral do processo focado.
                </p>
              </div>
            </div>
          )}


          {/* CHAPTER: FICHA DO PROCESSO */}
          {activeChapter === 'ficha' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 3</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">A Ficha de Autuação do Processo</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                As propriedades principais de autuação encontram-se expostas de forma sintetizada no cabeçalho do ecrã de consulta do processo. O sistema JurisLocal permite otimizar a área visual e corrigir permanentemente metadados.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="p-5 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👁️‍🗨️</span>
                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-widest leading-none">Ocultar Ficha do Processo</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Durante trabalhos extensos de leitura de despachos ou organização do split-view no seu monitor, a ficha de autuação superior pode ocupar valioso espaço vertical.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed font-bold">
                    👉 Como fazer: No topo direito do detalhe do caso, clique no botão cinzento "Ocultar Ficha". O cabeçalho detalhado colapsará elegantemente numa faixa minimalista, duplicando a sua área de trabalho focado. Clique de novo para reexibir.
                  </p>
                </div>

                <div className="p-5 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    <h4 className="text-xs font-black text-blue-950 uppercase tracking-widest leading-none">Editar Ficha de Autuação</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Permite emendar erros de digitação cometidos no registo inicial, adicionar novos advogados provisórios que apresentaram procuração posteriormente ou reajustar o valor da ação.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed font-bold">
                    👉 Como editar: Clique em "Editar Detalhes / Ficha" no bloco do cabeçalho. Um formulário completo abrir-se-á, permitindo alterar os Autores, Réus, Juiz titular, Advogados, procuradores e valores cíveis. Clique em "Gravar Alterações" para atualizar permanentemente.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* CHAPTER: TAB TIME LINE */}
          {activeChapter === 'tab-timeline' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 4.1</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">⏱️ Linha Temporal & Histórico</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Esta aba consiste no esqueleto dinâmico do processo judicial. Mostra em forma de trilho cronológica descendente todos os atos, notificações de secretaria que foram enviadas, despachos inseridos e requerimentos recebidos de forma interligada.
              </p>

              <div className="p-4 bg-emerald-50 text-emerald-950 border border-emerald-150 rounded-xl text-xs space-y-1">
                <strong className="font-bold block">O que exibe e Como:</strong>
                <p className="leading-relaxed">
                  Mostra ícones didáticos organizados por data (as decisões judiciais a roxo, notificações a azul, petições/comprovativos a verde e diligências agendadas a cinzento no fim da linha). Cada ato lista o seu resumo, categoria jurídica, autor físico e, se existir, os ficheiros anexos a esse ato judiciário em particular.
                </p>
              </div>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 pt-2">
                Ações Possíveis para o Utilizador nesta Aba:
              </h4>

              <div className="space-y-4 text-xs text-slate-650 leading-relaxed">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <strong className="text-slate-900 block font-bold text-[12px]">✍️ Registar Novo Ato / Ocorrência</strong>
                  <p>Adiciona formalmente um novo evento à história do processo de forma manual:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-slate-600 mt-1">
                    <li>Indique o tipo de ato (Ex: *Ato Processual Ordinário*, *Recebimento de Defesa*, *Despacho Judicial*).</li>
                    <li>Preencha a descrição textual do ato, o apresentante legal e a data de hoje.</li>
                    <li>
                      Anexe opcionalmente ficheiros (.pdf ou .txt) carregando do seu computador pessoal através da caixa de drag-and-drop. Pode criar múltiplos anexos simulados indicando o seu tipo (ex: *Documento de Prova Anexo*) e o teor descritivo. Os anexos serão auto-numerados e guardados no arquivo do processo.
                    </li>
                  </ol>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <strong className="text-slate-900 block font-bold text-[12px]">📅 Agendar Diligência na Agenda e Linha Temporal</strong>
                  <p>
                    Permite definir formalmente um novo evento calendarizado para consulta do Tribunal, como uma *Audiência de Julgamento*, *Inquirição de Testemunhas* ou *Exame Pericial*:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-650">
                    <li>Insira o título do evento e a data prevista.</li>
                    <li>Escolha a hora, o juiz titular encarregue e a sala de audiências física do tribunal.</li>
                    <li>O evento irá propagar-se automaticamente para o Painel da Agenda Lateral e para a Linha de Tempo geral com alerta verde-esperança.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}


          {/* CHAPTER: TAB DOCUMENTOS */}
          {activeChapter === 'tab-documentos' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 4.2</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">📂 Documentos Digitais</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Repositório estrito onde reside toda a documentação legal e articulados em formato digital. É o acervo processual consolidado de todas as peças em papel que foram digitalizadas.
              </p>

              <div className="p-4 bg-blue-50 text-blue-905 border border-blue-150 rounded-xl text-xs space-y-1">
                <strong className="font-bold block">O que exibe e Como:</strong>
                <p className="leading-relaxed">
                  Uma grelha de ficheiros numerados por ordem de indexação e página. Mostra o título do ficheiro, a categoria oficial (Ex: *Petição Inicial*, *Certidão de Óbito*, *Auto Prisional*), data de registo, parte que o juntou e o tamanho em KB no disco rígido do dispositivo nacional.
                </p>
              </div>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 pt-2">
                Recursos e Ações Disponíveis ao Utilizador:
              </h4>

              <div className="space-y-4 text-xs text-slate-650 leading-relaxed">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <strong className="text-slate-900 block font-bold text-[11px] uppercase tracking-wide">🔍 1. Visualização Instantânea Integrada (Leitor Interno)</strong>
                  <p>
                    Evite descarregar PDFs pesados desnecessariamente. Ao clicar em qualquer documento da lista, o painel do lado direito ativa o **Modo de Consulta Digital**, carregando uma formatação profissional do teor de texto da peça legal com paginação, assinaturas e cabeçalho.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <strong className="text-slate-900 block font-bold text-[11px] uppercase tracking-wide">💾 2. Descarregar no Formato .txt / Copiar Teor</strong>
                  <p>
                    Guarde uma cópia física do documento digital. O utilitário do JurisLocal permite exportar o conteúdo do despacho ou petição no formato legível nativo <code className="bg-slate-100 px-1 rounded font-mono text-indigo-700">.txt</code> para poder colar noutras aplicações locais de escritório (como MS Word ou Notepad) do tribunal de comarca.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <strong className="text-slate-900 block font-bold text-[11px] uppercase tracking-wide">🖨️ 3. Imprimir Peça / Despacho</strong>
                  <p>
                    Emite o documento diretamente para a impressora física da secretaria do tribunal com uma folha de rosto simplificada contendo os metadados oficiais e a assinatura eletrónica certificada do funcionário.
                  </p>
                </div>

                <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-xl space-y-2">
                  <strong className="text-indigo-950 block font-bold text-[11px] uppercase tracking-wide">📦 4. Compilar Processo Completo em PDF</strong>
                  <p>
                    Ferramenta profissional essencial para envio ao Tribunal de Recurso (Tribunal da Relação). Ao acionar este botão, o JurisLocal agrupa **todos** os documentos do acervo por ordem cronológica, gera um índice remissivo numerado automático com folha de termos de abertura, e compila num único ficheiro final indexado de cariz digital.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* CHAPTER: TAB ESTADO */}
          {activeChapter === 'tab-estado' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 4.3</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">🔄 Estado, Fase e Alarmes de Prazos</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Regula o andamento oficial do processo civil ou crime no organograma de secretaria judicial. Adicionalmente, dota o JurisLocal de um **sistema inteligente de alarmes de conformidade** (segurança dupla) para garantir que nenhum processo seja esquecido ou fique inativo por períodos prolongados.
              </p>

              <div className="p-4 bg-indigo-50 text-indigo-950 border border-indigo-150 rounded-xl text-xs space-y-1.5 leading-relaxed">
                <strong className="font-bold block text-[13px] text-indigo-900">🛡️ Regulamento de Proteção Processual (Protocolo de 60 Dias)</strong>
                <p>O sistema segue regras exatas e automáticas de integridade de agenda:</p>
                <ol className="list-decimal pl-4 space-y-1.5 mt-2 text-[11.5px] text-slate-800">
                  <li><strong>Geração Automática:</strong> Se o utilizador não criar um alarme manual, o sistema gera automaticamente um alarme agendado para <strong>60 dias após a data do último ato praticado</strong> (ou data de autuação do processo).</li>
                  <li><strong>Interposição Manual:</strong> No instante em que o utilizador cria um alarme personalizado, o alarme automático do sistema é imediatamente removido, mantendo apenas a instrução humana.</li>
                  <li><strong>Averbamento de Atos:</strong> No caso de alarme automático, este é apagado sempre que for registado um novo ato processual na ficha, gerando-se de imediato um novo alarme refrescado para 60 dias após esse ato.</li>
                  <li><strong>Soberania do Utilizador:</strong> O alarme manual criado pelo utilizador <strong>não é afetado</strong> por novos atos processuais. Ele é persistente e só pode ser eliminado por ação humana direta.</li>
                  <li><strong>Eliminação Unificada:</strong> Pode eliminar um alarme a qualquer momento de duas maneiras:
                    <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-700">
                      <li>Na <strong>Página Inicial</strong>, clicando no botão "<strong>Eliminar</strong>" no card do alarme.</li>
                      <li>Na <strong>Ficha do Processo</strong> (separador <em>Estado</em>), clicando em "<strong>Eliminar Alarme</strong>".</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-xs text-slate-650 leading-relaxed">
                
                <div className="p-4 border border-slate-200 rounded-xl space-y-3">
                  <strong className="text-slate-900 block font-bold text-sm">📅 Gestão de Fase Processual Corrente</strong>
                  <p>Exibe o percurso histórico do processo com indicação de quem alterou a fase, em que dia e sob que pretexto.</p>
                  <div>
                    <h5 className="font-bold text-slate-800 font-sans">Ação do utilizador:</h5>
                    <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-600">
                      <li>Use o dropdown para selecionar uma nova fase jurídica e justificar a alteração.</li>
                      <li>Para processos cíveis, a hierarquia de fases segue a tramitação legal padrão portuguesa (Ex: *Instrução Saneadora*, *Articulados*, *Julgamento*).</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl space-y-3">
                  <strong className="text-slate-900 block font-bold text-sm">⏰ Visibilidade e Ordenação no Ecrã Inicial</strong>
                  <p>O quadro na primeira página apresenta os processos prioritários divididos de forma intuitiva:</p>
                  <div>
                    <h5 className="font-bold text-slate-800 font-sans">Características da Visualização:</h5>
                    <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-600">
                      <li><strong>Listas Separadas:</strong> Os alarmes já expirados ou com data para hoje aparecem destacados numa lista própria de extrema urgência no topo do painel.</li>
                      <li><strong>Ordenação Próxima:</strong> Os alarmes gerais são listados do mais recente (cronologicamente próximo) para o mais distante.</li>
                      <li><strong>Filtros Avançados:</strong> Permite filtrar rapidamente entre todos os alarmes ou apenas os criados expressamente por utilizador humano.</li>
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* CHAPTER: TAB APENSOS */}
          {activeChapter === 'tab-apensos' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 4.4</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">🔗 Apensos e Conexões Conexas</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Os processos judiciais de uma mesma lide ou conflito podem exigir conexões de apensação física para julgamento unificado ou tratamento de incidentes de oposição.
              </p>

              <div className="p-4 bg-purple-50 text-purple-950 border border-purple-150 rounded-xl text-xs space-y-1">
                <strong className="font-bold block">O que exibe e Como:</strong>
                <p className="leading-relaxed">
                  Lista todos os processos secundários que se encontram legalmente apensados ao processo atual, exibindo o número de registo, tipo cível/crime, data de autuação, e um link de redirecionamento imediato para as respetivas pastas virtuais.
                </p>
              </div>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-1.5 pt-2">
                Ações Possíveis nesta Aba:
              </h4>

              <div className="text-xs text-slate-650 leading-relaxed space-y-2">
                <p>O utilizador tem acesso total à dependência do expediente eletrónico:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>**Associar Novo Apenso**: Permite escolher um número de processo já registado no dispositivo e conexá-lo instantaneamente como apenso deste caso principal.</li>
                  <li>**Desapensar Processo**: Rompe permanentemente a ligação legal entre as duas pastas, mantendo ambos os processos no tribunal, mas desvinculando as suas agendas e tramitações unificadas.</li>
                </ul>
              </div>
            </div>
          )}


          {/* CHAPTER: SPLIT-VIEW AND AGENDA */}
          {activeChapter === 'splitview' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="border-b border-slate-150 pb-4">
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest block mb-1">Capítulo 5</span>
                <h3 className="text-2xl font-bold text-slate-900 font-display">O Painel da Direita (Split-View) e Agenda de Prazos</h3>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                O JurisLocal utiliza um inovador ecrã duplo dinâmico (Split-View) para otimizar o tempo e permitir que o funcionário de secretaria judicial trabalhe com duas tarefas em simultâneo com imenso rigor.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="p-5 border border-slate-200 bg-slate-50/30 rounded-xl space-y-3 text-xs leading-relaxed text-slate-650">
                  <strong className="text-slate-900 block text-sm font-bold">🖥️ Split-View Lateral Direito</strong>
                  <p>
                    Enquanto visualiza as tabs de documentos e timeline do lado esquerdo, a metade direita do ecrã no detalhe processual serve de painel multi-ficheiro onde pode alternar entre:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>**Consulta de Peça Ativa**: Visualizador de texto com cabeçalho oficial do tribunal e botões de descarregar e imprimir.</li>
                    <li>
                      **Assistente de OCR Digitalizador**: Faça upload de uma petição inicial ou certidão (.pdf, .txt, .json) para que o motor extraia automaticamente metadados cruciais para a secretaria (Nomes de autores, réus, juízes destacados e o preâmbulo do texto).
                    </li>
                    <li>
                      **Minutador de Notificações / Despachos**: Ferramenta automática que redige novos correios, despachos interlocutórios ou ofícios judiciais pré-preenchidos de acordo com o padrão institucional do tribunal local com um único clique.
                    </li>
                  </ul>
                </div>

                <div className="p-5 border border-slate-200 bg-slate-50/30 rounded-xl space-y-3 text-xs leading-relaxed text-slate-650">
                  <strong className="text-slate-900 block text-sm font-bold">📅 Agenda de Prazos e Expediente</strong>
                  <p>
                    Inserida a meio do painel do utilizador ou na barra de alarmes central da página inicial, a Agenda agrega todas as datas com prazos ativos ou diligências programados do tribunal:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>**Filtro e Destaques**: Os processos que tenham em curso o prazo para impugnar ou que possuam julgamento marcado para os próximos dias aparecem destacados com bandeira cor-de-rosa ou amarela sob a indicação <code className="bg-red-50 text-red-700 px-1 rounded font-mono">URGENTE / PRÓXIMOS 3 DIAS</code>.</li>
                    <li>**Ligação Direta**: Clique na ligação do processo na agenda para abrir instantaneamente o respetivo processo digital na aba de trabalho ativa, sem necessitar de retroceder ao menu de pesquisa.</li>
                  </ul>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

      {/* Button footer to return dynamically */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between no-print gap-4">
        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <Info className="h-4 w-4 text-indigo-500" />
          <span>Precisa de assistência técnica judicial imediata? Contacte o Administrador da Comarca através do portal.</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigateToTab && onNavigateToTab('pesquisa')}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Pesquisar Processos
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab && onNavigateToTab('registo')}
            className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-3xs"
          >
            Criar Novo Processo
          </button>
        </div>
      </div>

    </div>
  );
}
