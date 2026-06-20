/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  HardDrive, 
  ChevronRight, 
  ChevronDown, 
  Download, 
  Eye, 
  Printer, 
  FileArchive,
  Search,
  ExternalLink
} from 'lucide-react';
import { getSimulatedDiskPathStructure, DiskFolder } from '../utils/storage';
import { Documento } from '../types';

interface FileExplorerProps {
  onOpenFile: (doc: Documento) => void;
  onPrintFile: (doc: Documento) => void;
  onDownloadFile: (doc: Documento) => void;
  onSelectProcess?: (numero: string) => void;
}

export default function FileExplorer({ 
  onOpenFile, 
  onPrintFile, 
  onDownloadFile,
  onSelectProcess 
}: FileExplorerProps) {
  const [explorerData, setExplorerData] = useState<DiskFolder[]>(() => getSimulatedDiskPathStructure());
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({
    'C:\\': true,
    'C:\\GestaoProcessos': true
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Refresh explorer data
  const refreshExplorer = () => {
    setExplorerData(getSimulatedDiskPathStructure());
  };

  React.useEffect(() => {
    refreshExplorer();
    // Set up small interval to refresh if storage updates elsewhere
    const interval = setInterval(refreshExplorer, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleDownloadFolderZip = (folderName: string, files: DiskFolder[]) => {
    if (!files || files.length === 0) {
      alert('Esta pasta está vazia.');
      return;
    }
    
    // Simulate batch download
    files.forEach((f, idx) => {
      if (f.meta) {
        setTimeout(() => {
          onDownloadFile(f.meta);
        }, idx * 250);
      }
    });
  };

  const renderNode = (node: DiskFolder, depth: number = 0) => {
    const isExpanded = expandedPaths[node.path];
    const hasChildren = node.files && node.files.length > 0;
    const isProcessFolder = node.path.startsWith('C:\\GestaoProcessos\\') && node.path.split('\\').length === 3;

    // Filter node's children if searching
    let displayedChildren = node.files || [];
    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      displayedChildren = (node.files || []).filter(c => {
        // match child name or recursively match nested contents
        if (c.name.toLowerCase().includes(lowerSearch)) return true;
        if (c.files) {
          return c.files.some(grandchild => grandchild.name.toLowerCase().includes(lowerSearch));
        }
        return false;
      });
    }

    return (
      <div key={node.path} className="select-none">
        {/* Row element */}
        <div 
          className={`group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50/80 transition-all ${
            isProcessFolder ? 'bg-slate-50/50 my-1 border border-slate-150' : ''
          }`}
          style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {node.isFolder ? (
              <button 
                onClick={() => toggleExpand(node.path)}
                className="p-0.5 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
            ) : (
              <span className="w-4.5" /> // Alignment spacer for files
            )}

            {/* Folder/File icon representation */}
            {node.isFolder ? (
              node.path === 'C:\\' ? (
                <HardDrive className="h-4 w-4 text-slate-700 shrink-0 stroke-[1.8]" />
              ) : isExpanded ? (
                <FolderOpen className="h-4 w-4 text-amber-500 shrink-0 stroke-[1.8]" />
              ) : (
                <Folder className="h-4 w-4 text-amber-500 shrink-0 stroke-[1.8]" />
              )
            ) : (
              <FileText className="h-4 w-4 text-blue-500 shrink-0 stroke-[1.8]" />
            )}

            {/* Name label */}
            <span 
              onClick={() => {
                if (node.isFolder) {
                  toggleExpand(node.path);
                } else if (node.meta) {
                  onOpenFile(node.meta);
                }
              }}
              className={`text-xs text-slate-800 truncate cursor-pointer ${
                node.isFolder ? 'font-semibold hover:text-slate-950 font-display' : 'hover:text-blue-600 hover:underline'
              }`}
            >
              {node.name}
            </span>

            {/* Sizes badge for file items */}
            {!node.isFolder && node.size && (
              <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                {node.size}
              </span>
            )}

            {/* Quick-links for Process folders */}
            {isProcessFolder && onSelectProcess && (
              <button
                onClick={() => onSelectProcess(node.name)}
                className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[9px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold uppercase tracking-wider"
                title="Abrir no Painel de Processos"
              >
                <span>Ficha do Processo</span>
                <ExternalLink className="h-2 w-2.5" />
              </button>
            )}
          </div>

          {/* Context actions for hover state */}
          <div className="flex items-center gap-1 shrink-0">
            {node.isFolder ? (
              // Folder actions: batch download
              isProcessFolder && node.files && node.files.length > 0 && (
                <button
                  onClick={() => handleDownloadFolderZip(node.name, node.files || [])}
                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                  title="Descarregar todos os documentos desta pasta (ZIP simulado)"
                >
                  <FileArchive className="h-3.5 w-3.5" />
                </button>
              )
            ) : (
              // File actions: Instant open, print, download
              <React.Fragment>
                <button
                  onClick={() => node.meta && onOpenFile(node.meta)}
                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                  title="Visualizar documento"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => node.meta && onPrintFile(node.meta)}
                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                  title="Imprimir"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => node.meta && onDownloadFile(node.meta)}
                  className="p-1 text-slate-400 hover:text-blue-605 hover:bg-blue-50 rounded transition-all cursor-pointer"
                  title="Transferir ficheiro"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </React.Fragment>
            )}
          </div>
        </div>

        {/* Render children sub-tree */}
        {node.isFolder && isExpanded && displayedChildren.length > 0 && (
          <div className="border-l border-slate-200 ml-3.5 pl-1 my-0.5 space-y-0.5">
            {displayedChildren.map(child => renderNode(child, depth + 1))}
          </div>
        )}

        {/* Empty placeholder within expanded folders */}
        {node.isFolder && isExpanded && displayedChildren.length === 0 && (
          <div 
            className="text-[10px] text-zinc-400 italic py-1"
            style={{ paddingLeft: `${(depth + 1) * 20}px` }}
          >
            (pasta vazia)
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      {/* File Explorer Header with Search and Information */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 font-display flex items-center gap-2">
            <HardDrive className="h-4.5 w-4.5 text-slate-700 stroke-[1.8]" />
            Estrutura de Ficheiros (Disco Local C:)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 outline-hidden leading-relaxed">
            A aplicação sincroniza pastas em tempo real dentro do diretório <code className="bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.5 rounded font-mono select-all">C:\GestaoProcessos</code>
          </p>
        </div>

        <div className="relative w-full md:w-60">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <input
            type="search"
            placeholder="Filtrar pastas ou ficheiros..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded lg bg-white border border-slate-200 pl-8 pr-3 py-1.8 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden transition-all font-medium font-sans"
          />
        </div>
      </div>

      {/* Explorer Tree Content Panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {explorerData.length > 0 ? (
          explorerData.map(node => renderNode(node, 0))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl m-4">
            <HardDrive className="h-8 w-8 stroke-[1] mb-2 text-slate-350" />
            <p className="text-xs font-semibold">Disco Local C: Não inicializado</p>
          </div>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium flex justify-between items-center shrink-0">
        <span>Sincronização Ativa • 100% Offline</span>
        <span className="font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Tauri FS-Sim v2.1</span>
      </div>
    </div>
  );
}
