
import React, { useState, useEffect } from 'react';
import { getAuditLogs, AuditLogEntry } from '../utils/auditLogger';
import { getUsers, getProcessos } from '../utils/storage';
import { User, Processo } from '../types';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

export const AdminAuditPanel: React.FC<{ restrictToProcesses?: string[] }> = ({ restrictToProcesses }) => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [processos, setProcessos] = useState<Processo[]>([]);
    
    const [filterUser, setFilterUser] = useState('');
    const [filterProcesso, setFilterProcesso] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const restrictKey = restrictToProcesses?.join(',') || '';

    useEffect(() => {
        setLogs(getAuditLogs());
        setUsers(getUsers());
        
        const allProcs = getProcessos();
        if (restrictToProcesses) {
            setProcessos(allProcs.filter(p => restrictToProcesses.includes(p.numero)));
        } else {
            setProcessos(allProcs);
        }
    }, [restrictKey]);

    const filteredLogs = logs.filter(log => {
        // Strict restriction for judges: only show logs from their associated processes
        if (restrictToProcesses && (!log.processoNumero || !restrictToProcesses.includes(log.processoNumero))) {
            return false;
        }

        const userMatch = filterUser === '' || log.username === filterUser;
        const procMatch = filterProcesso === '' || (log.processoNumero || '').includes(filterProcesso);
        const logDate = new Date(log.timestamp);
        const startMatch = startDate === '' || logDate >= new Date(startDate);
        const endMatch = endDate === '' || logDate <= new Date(new Date(endDate).getTime() + 86400000 - 1); // Full end day
        return userMatch && procMatch && startMatch && endMatch;
    });

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(filteredLogs);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoria");
        XLSX.writeFile(workbook, "AuditoriaGestaoProcessos.xlsx");
    };

    return (
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Controlo de Auditoria</h3>
                <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700">
                    <Download size={18} /> Exportar Excel
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm">
                    <option value="">Todos os Utilizadores</option>
                    {users.map(u => <option key={u.username} value={u.username}>{u.username}</option>)}
                </select>
                
                <input type="text" list="processos-list" placeholder="Processo (Autocompletar)..." value={filterProcesso} onChange={(e) => setFilterProcesso(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm" />
                <datalist id="processos-list">
                    {processos.map(p => <option key={p.id} value={p.numero} />)}
                </datalist>

                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm" />
            </div>

            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-slate-200">
                        <th className="p-3">Data</th>
                        <th className="p-3">Utilizador</th>
                        <th className="p-3">Ação</th>
                        <th className="p-3">Processo</th>
                        <th className="p-3">Detalhes</th>
                    </tr>
                </thead>
                <tbody>
                    {[...filteredLogs].reverse().map(log => (
                        <tr key={log.id} className="border-b hover:bg-slate-50">
                            <td className="p-3">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-3">{log.username}</td>
                            <td className="p-3">{log.action}</td>
                            <td className="p-3 font-mono">{log.processoNumero || '-'}</td>
                            <td className="p-3 text-sm text-slate-600">{log.details || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
