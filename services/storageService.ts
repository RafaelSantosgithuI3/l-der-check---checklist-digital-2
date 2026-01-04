
import { ChecklistItem, ChecklistLog, User, MeetingLog, Permission } from '../types';
import { CHECKLIST_ITEMS } from '../constants';
import { apiFetch } from './networkConfig';

// --- TIMEZONE UTIL ---
export const getManausDate = (): Date => {
    const now = new Date();
    const manausTimeStr = now.toLocaleString("en-US", { timeZone: "America/Manaus" });
    return new Date(manausTimeStr);
};

// --- CONFIGURAÇÃO DO CHECKLIST ---

export const getChecklistItems = async (type: 'LEADER' | 'MAINTENANCE' = 'LEADER'): Promise<ChecklistItem[]> => {
    try {
        const items = await apiFetch('/config/items');
        if (!items || items.length === 0) {
            if(type === 'LEADER') return CHECKLIST_ITEMS.map(i => ({...i, type: 'LEADER'}));
            return [];
        }
        const filtered = items.filter((i: ChecklistItem) => (i.type || 'LEADER') === type);
        if(type === 'LEADER' && filtered.length === 0) return CHECKLIST_ITEMS.map(i => ({...i, type: 'LEADER'}));
        return filtered;
    } catch (e) {
        if(type === 'LEADER') return CHECKLIST_ITEMS.map(i => ({...i, type: 'LEADER'}));
        return [];
    }
};

export const getAllChecklistItemsRaw = async (): Promise<ChecklistItem[]> => {
    try { return await apiFetch('/config/items'); } catch(e) { return []; }
}

export const saveChecklistItems = async (items: ChecklistItem[]) => {
    try { await apiFetch('/config/items', { method: 'POST', body: JSON.stringify({ items }) }); } catch (e) { console.error("Erro salvar itens", e); }
};

export const resetChecklistToDefault = async () => {
    try { await apiFetch('/config/items/reset', { method: 'POST' }); } catch (e) { console.error(e); }
    return CHECKLIST_ITEMS;
};

// --- PERMISSIONS ---

export const getPermissions = async (): Promise<Permission[]> => {
    try { return await apiFetch('/config/permissions'); } catch(e) { return []; }
}

export const savePermissions = async (permissions: Permission[]) => {
    try { await apiFetch('/config/permissions', { method: 'POST', body: JSON.stringify({ permissions }) }); } catch(e) { console.error(e); }
}

// --- LINHAS ---

export const getLines = async (): Promise<string[]> => {
    try {
        const lines = await apiFetch('/config/lines');
        if (Array.isArray(lines) && lines.length > 0) return lines.map((l: any) => l.name);
        return ['TP_TNP-01', 'TP_TNP-02', 'TP_TNP-03', 'TP_SEC-01', 'TP_SEC-02'];
    } catch (e) { return ['TP_TNP-01', 'TP_TNP-02', 'TP_TNP-03', 'TP_SEC-01', 'TP_SEC-02']; }
};

export const saveLines = async (lines: string[]) => {
    try { await apiFetch('/config/lines', { method: 'POST', body: JSON.stringify({ items: lines }) }); } catch (e) { console.error(e); throw e; }
};

// --- CARGOS (ROLES) ---

export const getRoles = async (): Promise<string[]> => {
    try {
        const roles = await apiFetch('/config/roles');
        if (Array.isArray(roles) && roles.length > 0) return roles.map((r: any) => r.name);
        return ['Diretor', 'Supervisor', 'Líder', 'Técnico', 'Operador'];
    } catch (e) { return ['Diretor', 'Supervisor', 'Líder', 'Técnico', 'Operador']; }
};

export const saveRoles = async (roles: string[]) => {
    try { await apiFetch('/config/roles', { method: 'POST', body: JSON.stringify({ items: roles }) }); } catch (e) { console.error(e); throw e; }
};

// --- MODELOS (MODELS) ---

export const getModels = async (): Promise<string[]> => {
    try {
        const models = await apiFetch('/config/models');
        if (Array.isArray(models) && models.length > 0) return models.map((m: any) => m.name);
        return [];
    } catch (e) { return []; }
};

export const saveModels = async (models: string[]) => {
    try { await apiFetch('/config/models', { method: 'POST', body: JSON.stringify({ items: models }) }); } catch (e) { console.error(e); throw e; }
};

// --- POSTOS DE TRABALHO (STATIONS) ---

export const getStations = async (): Promise<string[]> => {
    try {
        const stations = await apiFetch('/config/stations');
        if (Array.isArray(stations) && stations.length > 0) return stations.map((s: any) => s.name);
        return [];
    } catch (e) { return []; }
};

export const saveStations = async (stations: string[]) => {
    try { await apiFetch('/config/stations', { method: 'POST', body: JSON.stringify({ items: stations }) }); } catch (e) { console.error(e); throw e; }
};

// --- HISTÓRICO DE AUDITORIAS (LOGS) ---

export const saveLog = async (log: ChecklistLog) => {
    try { await apiFetch('/logs', { method: 'POST', body: JSON.stringify(log) }); } catch (e) { console.error("Erro salvar log", e); throw e; }
};

export const getLogs = async (): Promise<ChecklistLog[]> => {
    try { return await apiFetch('/logs'); } catch (e) { return []; }
};

// --- PARADA DE LINHA ---

export const saveLineStop = async (log: ChecklistLog) => {
    try { await apiFetch('/line-stops', { method: 'POST', body: JSON.stringify(log) }); } catch (e) { console.error("Erro salvar parada", e); throw e; }
};

export const getLineStops = async (): Promise<ChecklistLog[]> => {
    try { return await apiFetch('/line-stops'); } catch (e) { return []; }
};

// --- UTILS ---

export const getTodayLogForUser = async (matricula: string): Promise<ChecklistLog | undefined> => {
    try {
        const logs = await getLogs(); 
        const today = getManausDate().toISOString().split('T')[0];
        return logs.find(l => l.userId === matricula && l.date.startsWith(today));
    } catch (e) { return undefined; }
};

// --- ATA DE REUNIÃO ---

export const saveMeeting = async (meeting: MeetingLog) => {
    try { await apiFetch('/meetings', { method: 'POST', body: JSON.stringify(meeting) }); } catch (e) { console.error("Erro salvar ata", e); throw e; }
}

export const getMeetings = async (): Promise<MeetingLog[]> => {
    try { return await apiFetch('/meetings'); } catch (e) { return []; }
}

// --- MAINTENANCE ITEMS ---
export const getMaintenanceItems = async (machineId: string): Promise<ChecklistItem[]> => {
    const items = await getChecklistItems('MAINTENANCE');
    return items.filter(i => i.category.toLowerCase() === machineId.toLowerCase());
}

// --- RELATÓRIOS ---

const getWeek = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

export const getLogsByWeekNumber = async (year: number, week: number, shift: string, allUsers: User[]): Promise<ChecklistLog[]> => {
    const logs = await getLogs();
    return logs.filter(log => {
        if (log.type === 'MAINTENANCE' || log.type === 'LINE_STOP') return false;
        const logDate = new Date(log.date);
        const logYear = logDate.getFullYear();
        const logWeek = getWeek(logDate);
        if (logYear !== year || logWeek !== week) return false;
        const user = allUsers.find(u => u.matricula === log.userId);
        const userShift = user ? user.shift : '';
        if (shift && shift !== 'ALL') {
             if (userShift !== shift) return false;
        }
        return true;
    });
}

export const getLogsByWeekSyncStrict = (logs: ChecklistLog[], refDate: Date, line: string, shift: string, allUsers: User[]): ChecklistLog[] => {
    const current = new Date(refDate);
    const day = current.getDay(); 
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); 
    const monday = new Date(current.setDate(diff));
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    return logs.filter(log => {
        if (log.type === 'MAINTENANCE' || log.type === 'LINE_STOP') return false;
        const logD = new Date(log.date);
        const user = allUsers.find(u => u.matricula === log.userId);
        const logShift = user ? user.shift : '??';
        if (shift && shift !== 'ALL' && logShift !== shift) return false;
        return (log.line === line) && logD >= monday && logD <= sunday;
    });
};

export const saveBackupToServer = async (fileName: string, fileData: string) => {
    try { await apiFetch('/backup/save', { method: 'POST', body: JSON.stringify({ fileName, fileData }) }); } catch (e) { console.error("Erro backup", e); throw e; }
}

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};
