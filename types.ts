
export type ResponseType = 'OK' | 'NG' | 'N/A';

export interface User {
  name: string;
  matricula: string;
  role: string; // Função
  shift?: string; // Turno (Novo)
  email?: string; // Optional
  password?: string; // Stored securely in real app, simulated here
  isAdmin?: boolean; // Novo campo para controle explícito de admin
}

export interface ConfigItem {
    id: number | string;
    name: string;
}

export interface ChecklistItem {
  id: string;
  category: string; // Maps to 'Posto'
  text: string;     // Maps to 'Item'
  evidence?: string; // Maps to 'Evidencia'
  imageUrl?: string; // URL da imagem ilustrativa (Base64)
  type?: 'LEADER' | 'MAINTENANCE'; // Novo: Tipo de item
}

export interface ChecklistData {
  [key: string]: ResponseType;
}

export interface ChecklistEvidence {
    [key: string]: {
        comment: string;
        photo?: string;
    }
}

// Interface específica para Parada de Linha
export interface LineStopData {
    model: string;
    client: string;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    totalTime: string; // Calculado
    line: string;
    phase: string;
    productionLoss: string; // Perca de produção
    standardTime: string;   // Tempo padrão
    peopleStopped: string;  // Qtde pessoas
    stationStart: string;   // Posto parado De
    stationEnd: string;     // Posto parado Até
    
    // Novo fluxo
    motivo: string; // A7:J11 (Obrigatório na criação)
    responsibleSector: string; // Setor Responsável
    
    // Segunda etapa
    justification?: string; // Preenchido depois pelo responsável
    justifiedBy?: string;   // Quem justificou
    justifiedAt?: string;   // Data da justificativa
}

export type LogStatus = 'OPEN' | 'WAITING_JUSTIFICATION' | 'WAITING_SIGNATURE' | 'COMPLETED';

// Histórico para o Admin visualizar
export interface ChecklistLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  line: string; // Linha de produção
  date: string; // ISO String
  ngCount: number;
  observation: string;
  itemsCount: number;
  data: ChecklistData | LineStopData; // Pode ser Checklist ou Parada
  evidenceData?: ChecklistEvidence; // Evidências de NG
  type?: 'PRODUCTION' | 'MAINTENANCE' | 'LINE_STOP'; // Tipo de checklist
  maintenanceTarget?: string; // Se for manutenção, qual máquina
  
  // Controle de fluxo Parada de Linha
  status?: LogStatus;
  signedDocUrl?: string; // URL da foto da folha assinada
  
  // Snapshot dos itens no momento do checklist para versionamento
  itemsSnapshot?: ChecklistItem[];
  userShift?: string; // Add optional shift property to log
}

export interface MeetingLog {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    photoUrl: string;
    participants: string[];
    topics: string;
    createdBy: string;
}

export interface Permission {
    role: string;
    module: 'CHECKLIST' | 'MEETING' | 'MAINTENANCE' | 'AUDIT' | 'ADMIN' | 'LINE_STOP' | 'MANAGEMENT' | 'SCRAP';
    allowed: boolean;
}

// --- SCRAP MODULE TYPES ---

export interface Material {
    code: string;
    description: string;
    unitPrice: number;
    modelRef?: string; // Para filtro
}

export interface ScrapLog {
    id: string;
    userId: string; // Quem registrou
    data: string; // YYYY-MM-DD
    horario: string; // HH:mm (Manaus)
    semana: number;
    turno: string;
    lider: string; // Nome do líder responsável
    pqc: string;
    modelo: string;
    qty: number;
    item: string;
    status: string;
    codigo: string;
    descricao: string;
    valorUn: number;
    valorTotal: number;
    modeloUsado: string;
    responsavel: string;
    estacao: string;
    motivo: string;
    causaRaiz: string;
    contraMedida?: string; // Pode ser nulo inicialmente
}
