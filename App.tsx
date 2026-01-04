import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Card } from './components/Card';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { User, ChecklistData, ResponseType, ChecklistItem, ChecklistLog, MeetingLog, ChecklistEvidence, Permission, LineStopData, LogStatus } from './types';
import { 
    loginUser, logoutUser, getSessionUser, seedAdmin, isAdmin, 
    getAllUsers, deleteUser, updateUser, registerUser, updateSessionUser, recoverPassword
} from './services/authService';
import { exportLogToExcel, downloadShiftExcel, exportMeetingToExcel, exportLineStopToExcel } from './services/excelService';
import { 
    getChecklistItems, saveChecklistItems, saveLog, getLogs, 
    getLines, saveLines, getLogsByWeekNumber,
    getRoles, saveRoles, fileToBase64, getManausDate,
    saveMeeting, getMeetings, getMaintenanceItems,
    getAllChecklistItemsRaw, getPermissions, savePermissions,
    getTodayLogForUser, saveLineStop, getLineStops
} from './services/storageService';
import { saveServerUrl, getServerUrl, clearServerUrl, isServerConfigured } from './services/networkConfig';
import { 
  CheckSquare, LogOut, UserPlus, LogIn, CheckCircle2, AlertCircle, 
  Save, ArrowLeft, History, Edit3, Trash2, Plus, Image as ImageIcon, 
  Settings, Users, List, Search, Calendar, Eye, Download, Wifi, User as UserIcon, Upload, X, UserCheck,
  Camera, FileText, QrCode, Hammer, AlertTriangle, Shield, LayoutDashboard, ChevronRight, Clock, Printer, EyeOff
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

type ViewState = 'SETUP' | 'LOGIN' | 'REGISTER' | 'RECOVER' | 'MENU' | 'CHECKLIST_MENU' | 'AUDIT_MENU' | 'DASHBOARD' | 'ADMIN' | 'SUCCESS' | 'PERSONAL' | 'PROFILE' | 'MEETING_MENU' | 'MEETING_FORM' | 'MEETING_HISTORY' | 'MAINTENANCE_QR' | 'LINE_STOP_DASHBOARD';

interface LineStatus {
    status: 'OK' | 'NG' | 'PENDING';
    leaderName?: string;
    logIds: string[];
    details?: string; // Para mostrar qual máquina falhou na manutenção
}

interface LeaderStatus {
    user: User;
    statuses: { date: string, status: 'OK' | 'NG' | 'PENDING', logId?: string }[];
}

const SECTORS_LIST = [
    'GQ', 'PRODUÇÃO', 'SMD/IAC', 'PRÉ-FORMA', 
    'MANUTENÇÃO', 'MATERIAIS', 'PCP', 
    'ÁREA TÉCNICA', 'SAMSUNG', 'EXTERNO'
];

const MODULE_NAMES: Record<string, string> = {
    CHECKLIST: 'Checklist (Líder)',
    LINE_STOP: 'Parada de Linha',
    MEETING: 'Reuniões',
    MAINTENANCE: 'Manutenção',
    AUDIT: 'Auditoria',
    ADMIN: 'Administração'
};

const App = () => {
  // --- State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('SETUP');
  const [isLoading, setIsLoading] = useState(false);
  
  // Network Setup
  const [serverIp, setServerIp] = useState('');

  // Auth States
  const [loginMatricula, setLoginMatricula] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Register States
  const [regName, setRegName] = useState('');
  const [regMatricula, setRegMatricula] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regShift, setRegShift] = useState('1');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  
  // Permissions State
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Checklist
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [lines, setLines] = useState<string[]>([]); 
  const [checklistData, setChecklistData] = useState<ChecklistData>({});
  const [checklistEvidence, setChecklistEvidence] = useState<ChecklistEvidence>({}); 
  const [observation, setObservation] = useState('');
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [currentLine, setCurrentLine] = useState(''); 
  const [showLinePrompt, setShowLinePrompt] = useState(false);
  
  // Line Stop
  const [lineStopData, setLineStopData] = useState<LineStopData>({
      model: '', client: '', startTime: '', endTime: '', totalTime: '',
      line: '', phase: '', productionLoss: '', standardTime: '',
      peopleStopped: '', stationStart: '', stationEnd: '',
      justification: '', motivo: '', responsibleSector: ''
  });
  const [lineStopTab, setLineStopTab] = useState<'NEW' | 'PENDING' | 'UPLOAD' | 'HISTORY'>('NEW');
  const [lineStopLogs, setLineStopLogs] = useState<ChecklistLog[]>([]);
  const [activeLineStopLog, setActiveLineStopLog] = useState<ChecklistLog | null>(null);
  const [justificationInput, setJustificationInput] = useState('');

  // Maintenance Mode
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceTarget, setMaintenanceTarget] = useState('');
  const [maintenanceLine, setMaintenanceLine] = useState(''); // New: Selected Line in Editor

  // Meeting States
  const [meetingParticipants, setMeetingParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [meetingTopics, setMeetingTopics] = useState('');
  const [meetingPhoto, setMeetingPhoto] = useState('');
  const [meetingTitle, setMeetingTitle] = useState(''); 
  const [meetingHistory, setMeetingHistory] = useState<MeetingLog[]>([]);

  // Admin / Audit
  const [adminTab, setAdminTab] = useState<'USERS' | 'LINES' | 'ROLES' | 'PERMISSIONS'>('USERS');
  const [auditTab, setAuditTab] = useState<'LEADER_HISTORY' | 'MAINTENANCE_HISTORY' | 'LEADER_EDITOR' | 'MAINTENANCE_EDITOR' | 'LEADERS' | 'LINES' | 'MAINTENANCE_MATRIX'>('LEADER_HISTORY');
  const [historyLogs, setHistoryLogs] = useState<ChecklistLog[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  
  // Filters Audit
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyShiftFilter, setHistoryShiftFilter] = useState('ALL');

  // Audit Editors
  const [leaderItems, setLeaderItems] = useState<ChecklistItem[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<ChecklistItem[]>([]);

  // Admin User Edit
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [originalMatriculaEdit, setOriginalMatriculaEdit] = useState('');
  
  // Audit Lines Dashboard
  const [linesWeekFilter, setLinesWeekFilter] = useState<string>(''); 
  const [linesShiftFilter, setLinesShiftFilter] = useState('1'); 
  const [linesMatrix, setLinesMatrix] = useState<{line: string, statuses: LineStatus[]}[]>([]);
  const [maintenanceMatrix, setMaintenanceMatrix] = useState<{line: string, statuses: LineStatus[]}[]>([]);
  const [newLineName, setNewLineName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');

  // Audit Leaders Dashboard
  const [leadersMatrix, setLeadersMatrix] = useState<LeaderStatus[]>([]);
  const [missingLeadersNames, setMissingLeadersNames] = useState<string[]>([]);

  // Alerts State
  const [pendingLineStopsCount, setPendingLineStopsCount] = useState(0);

  // Preview / Personal
  const [personalLogs, setPersonalLogs] = useState<ChecklistLog[]>([]);
  const [previewLog, setPreviewLog] = useState<ChecklistLog | null>(null);

  // Profile Edit
  const [profileData, setProfileData] = useState<User | null>(null);

  // QR Logic
  const [qrCodeManual, setQrCodeManual] = useState('');

  // Refs
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const isSuperAdmin = currentUser ? (currentUser.matricula === 'admin' || currentUser.role === 'Admin' || currentUser.isAdmin === true) : false;

  // --- PERMISSION HELPERS ---
  const hasPermission = (module: 'CHECKLIST' | 'MEETING' | 'MAINTENANCE' | 'AUDIT' | 'ADMIN' | 'LINE_STOP') => {
      if(!currentUser) return false;
      if(isSuperAdmin) return true; 
      
      const perm = permissions.find(p => p.role === currentUser.role && p.module === module);
      if(perm) return perm.allowed;
      
      if(module === 'CHECKLIST') return true; 
      if(module === 'MEETING') return true; 
      if(module === 'MAINTENANCE') return true; 
      if(module === 'LINE_STOP') return true; 
      if(module === 'AUDIT' || module === 'ADMIN') return false; 
      
      return false;
  }

  // --- Effects ---
  useEffect(() => {
    if (isServerConfigured()) {
        const storedIp = getServerUrl();
        if (storedIp) setServerIp(storedIp);
        initApp();
    } else {
        setServerIp('http://localhost:3000');
        setView('SETUP');
    }
  }, []);

  const initApp = async () => {
      setIsLoading(true);
      try {
        await seedAdmin(); 
        const user = getSessionUser();
        
        // Initial load of config
        const loadLines = await getLines();
        setLines(loadLines);
        if(loadLines.length > 0) setMaintenanceLine(loadLines[0]); 

        const loadRoles = await getRoles();
        setAvailableRoles(loadRoles);
        if (loadRoles.length > 0 && !user) setRegRole(loadRoles[0]);
        
        const perms = await getPermissions();
        setPermissions(perms);

        const now = getManausDate();
        setLinesWeekFilter(`${now.getFullYear()}-W${getWeekNumber(now).toString().padStart(2, '0')}`);

        if (user) {
            setCurrentUser(user);
            setView('MENU');
        } else {
            setLoginMatricula('');
            setLoginPassword('');
            setView('LOGIN');
        }
      } catch (e) {
          console.error("Erro ao inicializar:", e);
          alert("Não foi possível conectar ao servidor. Verifique o IP.");
          setView('SETUP');
      } finally {
          setIsLoading(false);
      }
  }

  // Initialize Items based on Mode
  useEffect(() => {
      const loadItems = async () => {
          if (view === 'DASHBOARD') {
            setIsLoading(true);
            let loadedItems: ChecklistItem[] = [];
            if (isMaintenanceMode) {
                loadedItems = await getMaintenanceItems(maintenanceTarget);
            } else {
                loadedItems = await getChecklistItems('LEADER');
            }
            setItems(loadedItems);
            const cats = Array.from(new Set(loadedItems.map(i => i.category)));
            setCategories(cats);
            setIsLoading(false);
          }
      };
      loadItems();
  }, [view, isMaintenanceMode, maintenanceTarget]);

  // Load Admin Data explicitly
  useEffect(() => {
      if (view === 'ADMIN') {
          const loadAdmin = async () => {
              setIsLoading(true);
              const u = await getAllUsers();
              setUsersList(u);
              setIsLoading(false);
          }
          loadAdmin();
      }
  }, [view]);

  // Load Profile Data
  useEffect(() => {
      if (view === 'PROFILE' && currentUser) {
          setProfileData({...currentUser, password: ''});
      }
  }, [view, currentUser]);

  // Line Stop Dashboard Data
  useEffect(() => {
      if (view === 'LINE_STOP_DASHBOARD') {
          const loadLineStops = async () => {
              setIsLoading(true);
              const stops = await getLineStops();
              setLineStopLogs(stops);
              setIsLoading(false);
          }
          loadLineStops();
      }
  }, [view, lineStopTab]);

  // ALERTS & DASHBOARD LOGIC (Menu View)
  useEffect(() => {
      if (view === 'MENU') {
          const loadAlerts = async () => {
              // 1. Line Stops Waiting
              const stops = await getLineStops();
              const pending = stops.filter(l => l.status === 'WAITING_JUSTIFICATION').length;
              setPendingLineStopsCount(pending);

              // 2. Missing Checklists (Delayed)
              // Logic: Shift 1 ends at 23:59 (per prompt), Shift 2 ends at 02:29 (next day)
              const allUsers = await getAllUsers();
              const allLogs = await getLogs();
              const now = getManausDate();
              
              const currentHour = now.getHours();
              const currentMin = now.getMinutes();
              const currentTimeVal = currentHour * 60 + currentMin; // minutes from midnight

              // Define deadlines in minutes from midnight
              const DEADLINE_SHIFT_1 = 23 * 60 + 59; // 23:59
              const DEADLINE_SHIFT_2 = 2 * 60 + 29;  // 02:29 (of next day effectively)

              // Only calculate missing if we are past the deadline? Or show real-time pending?
              // Prompt implies alerts for "Late". Let's show "Pending" if it's currently the shift time.
              
              const todayStr = now.toISOString().split('T')[0];
              
              const leaders = allUsers.filter(u => 
                 u.role.toLowerCase().includes('lider') || 
                 u.role.toLowerCase().includes('líder') ||
                 u.role.toLowerCase().includes('supervisor')
              );

              const missing = leaders.filter(leader => {
                   const hasLog = allLogs.some(l => l.userId === leader.matricula && l.date.startsWith(todayStr) && l.type !== 'MAINTENANCE' && l.type !== 'LINE_STOP');
                   if (hasLog) return false;
                   
                   // Filter logic could be more complex based on specific time of day, but listing all pending for today is safer for "Alert"
                   return true;
               }).map(l => l.name);

               setMissingLeadersNames(missing);
          };
          loadAlerts();
      }
  }, [view]);

  // History & Editors Filter Effect
  useEffect(() => {
      const fetchAuditData = async () => {
          if (view === 'AUDIT_MENU') {
              setIsLoading(true);
              
              if (auditTab === 'LEADER_HISTORY' || auditTab === 'MAINTENANCE_HISTORY') {
                  const allLogs = await getLogs();
                  const allUsers = await getAllUsers();

                  let filteredLogs = allLogs;
                  
                  if (auditTab === 'MAINTENANCE_HISTORY') {
                      filteredLogs = allLogs.filter(l => l.type === 'MAINTENANCE');
                  } else {
                      filteredLogs = allLogs.filter(l => l.type !== 'MAINTENANCE' && l.type !== 'LINE_STOP');
                  }

                  if (historyDateFilter) {
                      filteredLogs = filteredLogs.filter(l => l.date.substring(0, 10) === historyDateFilter);
                  }

                  if (historyShiftFilter !== 'ALL') {
                      filteredLogs = filteredLogs.filter(l => {
                          const u = allUsers.find(user => user.matricula === l.userId);
                          return u ? u.shift === historyShiftFilter : false;
                      });
                  }

                  setHistoryLogs(filteredLogs);
              }
              
              if (auditTab === 'LEADER_EDITOR') {
                  const items = await getChecklistItems('LEADER');
                  setLeaderItems(items);
              }
              
              if (auditTab === 'MAINTENANCE_EDITOR') {
                  const items = await getChecklistItems('MAINTENANCE');
                  setMaintenanceItems(items);
              }

              setIsLoading(false);
          }
      }
      fetchAuditData();
  }, [view, auditTab, historyDateFilter, historyShiftFilter]);

  // Leaders Dashboard Matrix Logic
  useEffect(() => {
      const fetchLeadersMatrix = async () => {
          if (view === 'AUDIT_MENU' && auditTab === 'LEADERS') {
               const allLogs = await getLogs();
               const allUsers = await getAllUsers();
               
               const leaders = allUsers.filter(u => 
                   u.role.toLowerCase().includes('lider') || 
                   u.role.toLowerCase().includes('líder') ||
                   u.role.toLowerCase().includes('supervisor') ||
                   u.role.toLowerCase().includes('coordenador')
               );

               if (linesWeekFilter) {
                   const parts = linesWeekFilter.split('-W');
                   if (parts.length !== 2) return;
                   const year = parseInt(parts[0]);
                   const week = parseInt(parts[1]);

                   const simpleDate = new Date(year, 0, 1 + (week - 1) * 7);
                   const day = simpleDate.getDay();
                   const diff = simpleDate.getDate() - day + (day === 0 ? -6 : 1);
                   const monday = new Date(simpleDate);
                   monday.setDate(diff);

                   const weekDates: string[] = [];
                   for(let i=0; i<6; i++) {
                       const d = new Date(monday);
                       d.setDate(monday.getDate() + i);
                       weekDates.push(d.toISOString().split('T')[0]);
                   }
                   
                   const weekLogs = await getLogsByWeekNumber(year, week, linesShiftFilter, allUsers);
                   const cleanLogs = weekLogs.filter(l => l.type !== 'LINE_STOP');
                   const todayManaus = getManausDate().toISOString().split('T')[0];

                   const matrix = leaders.map(leader => {
                       if (linesShiftFilter !== 'ALL' && leader.shift !== linesShiftFilter) return null;

                       const statuses = weekDates.map(dateStr => {
                           const log = cleanLogs.find(l => l.userId === leader.matricula && l.date.startsWith(dateStr));
                           if (log) return { date: dateStr, status: 'OK', logId: log.id } as const;
                           
                           if (dateStr < todayManaus) return { date: dateStr, status: 'NG' } as const;
                           return { date: dateStr, status: 'PENDING' } as const;
                       });
                       return { user: leader, statuses };
                   }).filter(x => x !== null) as LeaderStatus[];
                   setLeadersMatrix(matrix);
               }
          }
      };
      fetchLeadersMatrix();
  }, [view, auditTab, linesWeekFilter, linesShiftFilter]);

  // Matrix Logic (Lines & Maintenance)
  useEffect(() => {
      const fetchMatrix = async () => {
        if (view === 'AUDIT_MENU' && (auditTab === 'LINES' || auditTab === 'MAINTENANCE_MATRIX')) {
            if (!linesWeekFilter) return;

            const parts = linesWeekFilter.split('-W');
            if (parts.length !== 2) return;
            const year = parseInt(parts[0]);
            const week = parseInt(parts[1]);

            const simpleDate = new Date(year, 0, 1 + (week - 1) * 7);
            const day = simpleDate.getDay();
            const diff = simpleDate.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(simpleDate);
            monday.setDate(diff);

            const weekDates: string[] = [];
            for(let i=0; i<6; i++) {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                weekDates.push(d.toISOString().split('T')[0]);
            }

            setIsLoading(true);
            const allUsers = await getAllUsers();
            
            // Fix: ensure correct shift parameter is passed to getLogsByWeekNumber
            const weekLogs = await getLogsByWeekNumber(year, week, linesShiftFilter, allUsers);

            if (auditTab === 'LINES') {
                const cleanLogs = weekLogs.filter(l => l.type !== 'LINE_STOP' && l.type !== 'MAINTENANCE');
                
                const matrix = lines.map(line => {
                    const lineStatuses = weekDates.map(dateStr => {
                        const logsForDay = cleanLogs.filter(l => (l.line === line) && l.date.startsWith(dateStr));
                        if (logsForDay.length === 0) return { status: 'PENDING', logIds: [] } as LineStatus;
                        const anyNg = logsForDay.some(l => l.ngCount > 0);
                        const status: 'OK' | 'NG' = anyNg ? 'NG' : 'OK';
                        const uniqueNames = Array.from(new Set(logsForDay.map(l => l.userName.split(' ')[0])));
                        const leaderName = uniqueNames.join(' / ');
                        const logIds = logsForDay.map(l => l.id);
                        return { status, leaderName, logIds } as LineStatus;
                    });
                    return { line, statuses: lineStatuses };
                });
                setLinesMatrix(matrix);
            } else if (auditTab === 'MAINTENANCE_MATRIX') {
                const maintLogs = weekLogs.filter(l => l.type === 'MAINTENANCE');
                
                const matrix = lines.map(lineName => {
                    const lineStatuses = weekDates.map(dateStr => {
                        const logsForDay = maintLogs.filter(l => l.line === lineName && l.date.startsWith(dateStr));

                        if (logsForDay.length === 0) return { status: 'PENDING', logIds: [] } as LineStatus;
                        
                        const anyNgLog = logsForDay.find(l => l.ngCount > 0);
                        
                        if (anyNgLog) {
                            return { 
                                status: 'NG', 
                                logIds: [anyNgLog.id], 
                                details: anyNgLog.maintenanceTarget 
                            } as LineStatus;
                        }
                        
                        return { 
                            status: 'OK', 
                            logIds: logsForDay.map(l=>l.id) 
                        } as LineStatus;
                    });
                    
                    return { line: lineName, statuses: lineStatuses };
                });
                setMaintenanceMatrix(matrix);
            }

            setIsLoading(false);
        }
      }
      fetchMatrix();
  }, [view, auditTab, linesWeekFilter, linesShiftFilter, lines]);

  function getWeekNumber(d: Date) {
      d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return weekNo;
  }

  const showPicker = (e: React.MouseEvent<HTMLInputElement>) => {
      try {
          if ('showPicker' in HTMLInputElement.prototype) {
              e.currentTarget.showPicker();
          }
      } catch (error) {
      }
  };

  // --- Handlers ---
  
  const handleLogout = () => {
      logoutUser();
      setLoginMatricula('');
      setLoginPassword('');
      setView('LOGIN');
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true); 
    const r = await loginUser(loginMatricula, loginPassword); 
    setIsLoading(false); 
    if(r.success && r.user) { 
        setCurrentUser(r.user); 
        setView('MENU'); 
    } else { 
        setLoginError(r.message); 
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regMatricula || !regRole || !regPassword || !regShift) {
      setRegError('Preencha os campos obrigatórios.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
        setRegError('As senhas não coincidem.');
        return;
    }
    const newUser: User = {
      name: regName, matricula: regMatricula, role: regRole, shift: regShift, email: regEmail, password: regPassword, isAdmin: false
    };
    setIsLoading(true);
    const result = await registerUser(newUser);
    setIsLoading(false);
    if (result.success) {
      alert('Cadastro realizado com sucesso!');
      setView('LOGIN');
      setRegName(''); setRegMatricula(''); setRegShift('1'); setRegEmail(''); setRegPassword(''); setRegConfirmPassword(''); setRegError('');
    } else {
      setRegError(result.message);
    }
  };

  const handleStartChecklist = () => {
      setIsMaintenanceMode(false);
      setMaintenanceTarget('');
      setCurrentLine(lines.length > 0 ? lines[0] : '');
      setShowLinePrompt(true);
  }

  const handleConfirmLine = async () => {
      if(!currentLine) {
          alert("Por favor, selecione uma linha.");
          return;
      }
      setShowLinePrompt(false);
      setChecklistData({});
      setChecklistEvidence({});
      setObservation('');
      setCurrentLogId(null);
      setView('DASHBOARD');
  }

  const handleMaintenanceCode = (code: string) => {
      if (!code) {
          alert("Código inválido.");
          return;
      }
      setIsMaintenanceMode(true);
      setMaintenanceTarget(code);
      setCurrentLine(code); 
      setChecklistData({});
      setChecklistEvidence({});
      setObservation('');
      setCurrentLogId(null);
      setView('DASHBOARD');
  }
  
  // NEW: QR Code via Photo File
  const handleMaintenanceQrPhoto = async (file: File) => {
      if (!file) return;
      
      const html5QrCode = new Html5Qrcode("reader-hidden");
      try {
          setIsLoading(true);
          const decodedText = await html5QrCode.scanFile(file, true);
          handleMaintenanceCode(decodedText);
      } catch (err) {
          alert("QR Code não reconhecido na imagem. Tente novamente ou use o código manual.");
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  }

  const handleDownloadSheet = async (line: string) => {
      if (linesShiftFilter === 'ALL') {
          return alert("Selecione um turno específico (1 ou 2) para baixar a planilha.");
      }
      setIsLoading(true);
      try {
          await downloadShiftExcel(line, linesShiftFilter, linesWeekFilter, items);
      } catch (e) {
          alert("Erro ao gerar planilha.");
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  }

  const handleOpenPersonalHistory = async () => {
      if (!currentUser) return;
      setIsLoading(true);
      const allLogs = await getLogs();
      const myLogs = allLogs.filter(l => l.userId === currentUser.matricula);
      setPersonalLogs(myLogs);
      setIsLoading(false);
      setView('PERSONAL');
  }

  const handleOpenPreview = async (logId: string) => {
      const allLogs = await getLogs();
      let log = allLogs.find(l => l.id === logId);
      
      if (!log) {
          const stops = await getLineStops();
          log = stops.find(l => l.id === logId);
      }

      if (log) setPreviewLog(log);
  }

  const handleNgComment = (itemId: string, text: string) => {
      setChecklistEvidence(prev => ({ ...prev, [itemId]: { ...prev[itemId], comment: text } }));
  }

  const handleNgPhoto = async (itemId: string, file: File) => {
      try {
          const base64 = await fileToBase64(file);
          setChecklistEvidence(prev => ({ ...prev, [itemId]: { ...prev[itemId], photo: base64 } }));
      } catch (e) { alert("Erro ao carregar foto"); }
  }

  const handleAddParticipant = () => {
      if (newParticipant) {
          setMeetingParticipants(prev => [...prev, newParticipant]);
          setNewParticipant('');
      }
  }
  
  const handleRemoveParticipant = (idx: number) => {
      setMeetingParticipants(prev => prev.filter((_, i) => i !== idx));
  }

  const handleMeetingPhoto = async (file: File) => {
      try {
          const base64 = await fileToBase64(file);
          setMeetingPhoto(base64);
      } catch (e) { alert("Erro na foto"); }
  }

  const handleSaveMeeting = async () => {
      if (!currentUser || meetingParticipants.length === 0 || !meetingTopics || !meetingTitle) {
          return alert("Preencha o título, participantes e assuntos.");
      }
      setIsLoading(true);
      try {
        const now = getManausDate();
        const newMeeting: MeetingLog = {
            id: Date.now().toString(),
            title: meetingTitle,
            date: now.toISOString(),
            startTime: now.toLocaleTimeString(),
            participants: meetingParticipants,
            topics: meetingTopics,
            photoUrl: meetingPhoto,
            createdBy: currentUser.name
        };
        await saveMeeting(newMeeting);
        alert("Ata salva com sucesso!");
        setMeetingParticipants([]); setMeetingTopics(''); setMeetingPhoto(''); setMeetingTitle('');
        setView('MEETING_HISTORY');
      } catch (error) {
          console.error("Erro ao salvar ata:", error);
          alert("Erro ao salvar Ata. Tente novamente.");
      } finally {
          setIsLoading(false);
      }
  }

  // --- Line Stop Handlers ---
  const calcTotalTime = (start: string, end: string) => {
      if (!start || !end) return '';
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60; 
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const handleSaveLineStop = async () => {
      if(!currentUser) return;
      if(!lineStopData.model || !lineStopData.startTime || !lineStopData.motivo || !lineStopData.responsibleSector) {
          return alert("Preencha Modelo, Início, Motivo e Setor Responsável.");
      }
      setIsLoading(true);
      try {
          const log: ChecklistLog = {
              id: Date.now().toString(),
              userId: currentUser.matricula,
              userName: currentUser.name,
              // FIX: Append shift explicitly
              userRole: `${currentUser.role} - Turno ${currentUser.shift}`, 
              line: lineStopData.line || lines[0], 
              date: getManausDate().toISOString(),
              itemsCount: 0,
              ngCount: 0,
              observation: '',
              data: {
                  ...lineStopData,
                  line: lineStopData.line || lines[0]
              }, 
              type: 'LINE_STOP',
              status: 'WAITING_JUSTIFICATION'
          };
          
          await saveLineStop(log);
          
          const stops = await getLineStops();
          setLineStopLogs(stops);
          
          alert("Parada de Linha registrada! Aguardando justificativa.");
          setLineStopData({
              model: '', client: '', startTime: '', endTime: '', totalTime: '',
              line: lines[0], phase: '', productionLoss: '', standardTime: '',
              peopleStopped: '', stationStart: '', stationEnd: '',
              justification: '', motivo: '', responsibleSector: ''
          });
          setLineStopTab('PENDING');
      } catch(e: any) {
          // CRITICAL FIX: Show real error message from backend
          alert(`Erro ao salvar: ${e.message || "Verifique os campos ou conexão."}`);
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  }

  const handleSaveJustification = async () => {
      if (!activeLineStopLog || !justificationInput) return alert("Digite a justificativa.");
      if (!currentUser) return;

      const allowedRoles = ['SUPERVISOR', 'DIRETOR', 'COORDENADOR', 'GERENTE', 'ADMIN'];
      const sectorMatch = activeLineStopLog.data.responsibleSector && currentUser.role.toUpperCase().includes(activeLineStopLog.data.responsibleSector.toUpperCase());
      
      if (!allowedRoles.includes(currentUser.role.toUpperCase()) && !sectorMatch && !isSuperAdmin) {
          return alert("Apenas Supervisores, Diretores ou o Setor Responsável podem justificar.");
      }

      setIsLoading(true);
      try {
          const updatedData: LineStopData = {
              ...(activeLineStopLog.data as LineStopData),
              justification: justificationInput,
              justifiedBy: currentUser.name,
              justifiedAt: new Date().toISOString()
          };
          
          const updatedLog: ChecklistLog = {
              ...activeLineStopLog,
              data: updatedData,
              status: 'WAITING_SIGNATURE'
          };
          
          await saveLineStop(updatedLog); 
          
          const stops = await getLineStops();
          setLineStopLogs(stops);

          alert("Justificativa salva! Faça o download e upload da assinatura.");
          setJustificationInput('');
          setActiveLineStopLog(null);
          setLineStopTab('UPLOAD');
      } catch(e: any) {
          alert(`Erro ao salvar justificativa: ${e.message}`);
      } finally {
          setIsLoading(false);
      }
  }

  const handleUploadSignedDoc = async (file: File) => {
      if(!activeLineStopLog) return;
      try {
          const base64 = await fileToBase64(file);
          const updatedLog: ChecklistLog = {
              ...activeLineStopLog,
              status: 'COMPLETED',
              signedDocUrl: base64
          };
          await saveLineStop(updatedLog); 
          
          const stops = await getLineStops();
          setLineStopLogs(stops);

          alert("Processo finalizado!");
          setActiveLineStopLog(null);
          setLineStopTab('HISTORY');
      } catch(e: any) {
          alert(`Erro no upload: ${e.message}`);
      }
  }

  const openEditModal = (user: User) => {
      setEditingUser({...user, password: ''}); 
      setOriginalMatriculaEdit(user.matricula);
      setShowUserEditModal(true);
  }

  const saveUserChanges = async () => {
      if(!editingUser) return;
      setIsLoading(true);
      try {
        await updateUser(editingUser, originalMatriculaEdit);
        setUsersList(await getAllUsers());
        setShowUserEditModal(false);
      } catch(e) {
          alert("Erro ao salvar.");
      } finally {
        setIsLoading(false);
      }
  }

  const handleSaveProfile = async () => {
      if (!profileData) return;
      if (!profileData.name || !profileData.email) return alert("Nome e Email obrigatórios.");
      
      setIsLoading(true);
      try {
          await updateUser(profileData, profileData.matricula);
          updateSessionUser(profileData);
          setCurrentUser(profileData);
          alert("Perfil atualizado!");
          setView('MENU');
      } catch (e) {
          alert("Erro ao atualizar perfil.");
      } finally {
          setIsLoading(false);
      }
  }

  const handleAddRole = async () => {
      if (newRoleName && !availableRoles.includes(newRoleName)) {
          setIsLoading(true);
          try {
              const newRoles = [...availableRoles, newRoleName];
              setAvailableRoles(newRoles);
              await saveRoles(newRoles);
              setNewRoleName('');
          } catch(e) {
              alert("Erro ao salvar cargo.");
          } finally {
              setIsLoading(false);
          }
      }
  }

  const handleDeleteRole = async (roleToDelete: string) => {
      if(confirm(`Excluir cargo ${roleToDelete}?`)) {
          setIsLoading(true);
          try {
              const newRoles = availableRoles.filter(r => r !== roleToDelete);
              setAvailableRoles(newRoles);
              await saveRoles(newRoles);
          } catch(e) {
              alert("Erro ao excluir cargo.");
          } finally {
              setIsLoading(false);
          }
      }
  }

  const handleTogglePermission = (role: string, module: 'CHECKLIST' | 'MEETING' | 'MAINTENANCE' | 'AUDIT' | 'ADMIN' | 'LINE_STOP') => {
      const existing = permissions.find(p => p.role === role && p.module === module);
      const newVal = existing ? !existing.allowed : true;
      const newPerm: Permission = { role, module, allowed: newVal };
      const otherPerms = permissions.filter(p => !(p.role === role && p.module === module));
      const updatedList = [...otherPerms, newPerm];
      setPermissions(updatedList);
      savePermissions(updatedList).catch(err => console.error("Failed to save permission", err));
  }

  const handleEditorChange = (list: ChecklistItem[], setList: React.Dispatch<React.SetStateAction<ChecklistItem[]>>, id: string, field: keyof ChecklistItem, value: string) => {
      setList(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  const handleEditorImage = async (list: ChecklistItem[], setList: React.Dispatch<React.SetStateAction<ChecklistItem[]>>, id: string, file: File) => {
      try {
          const base64 = await fileToBase64(file);
          setList(prev => prev.map(i => i.id === id ? { ...i, imageUrl: base64 } : i));
      } catch(e) { alert("Erro na imagem"); }
  }

  const handleEditorRemoveImage = (list: ChecklistItem[], setList: React.Dispatch<React.SetStateAction<ChecklistItem[]>>, id: string) => {
      setList(prev => prev.map(i => i.id === id ? { ...i, imageUrl: '' } : i));
  }

  const handleEditorAdd = async (list: ChecklistItem[], setList: React.Dispatch<React.SetStateAction<ChecklistItem[]>>, type: 'LEADER' | 'MAINTENANCE') => {
      const newId = Date.now().toString();
      const category = type === 'MAINTENANCE' 
          ? `${maintenanceLine} - Nova Máquina` 
          : 'GERAL';
          
      const newItem: ChecklistItem = {
          id: newId, 
          category: category, 
          text: 'Novo Item...', 
          evidence: '', 
          type: type
      };
      setList(prev => [...prev, newItem]);
  }

  const handleEditorDelete = (list: ChecklistItem[], setList: React.Dispatch<React.SetStateAction<ChecklistItem[]>>, id: string) => {
      if(confirm("Excluir item?")) {
          setList(prev => prev.filter(i => i.id !== id));
      }
  }

  const handleSaveEditor = async (targetList: ChecklistItem[], type: 'LEADER' | 'MAINTENANCE') => {
      if(confirm("Salvar alterações?")) {
          setIsLoading(true);
          try {
            const allItems = await getAllChecklistItemsRaw();
            const otherItems = allItems.filter(i => (i.type || 'LEADER') !== type);
            const merged = [...otherItems, ...targetList];
            await saveChecklistItems(merged);
            alert("Salvo com sucesso!");
          } catch(e) {
              alert("Erro ao salvar.");
          } finally {
            setIsLoading(false);
          }
      }
  }

  const printQrCode = (text: string) => {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
      const win = window.open('', '_blank');
      if(win) {
          win.document.write(`<html><head><title>QR Code - ${text}</title></head><body style="text-align:center; font-family:sans-serif;"><h1>${text}</h1><img src="${url}" style="width:300px;height:300px;"/><br/><br/><button onclick="window.print()">Imprimir</button></body></html>`);
          win.document.close();
      }
  }

  const renderPreviewModal = () => {
      if (!previewLog) return null;
      // Safety check for null data in Line Stops
      const lineStopDataRaw = previewLog.type === 'LINE_STOP' ? (previewLog.data as LineStopData) : null;
      
      return (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800">
                  <div className="flex justify-between items-center mb-6 sticky top-0 bg-zinc-900 pt-2 pb-4 z-10 border-b border-zinc-800">
                      <div>
                          <h3 className="text-xl font-bold text-white">Detalhes do Checklist</h3>
                          <p className="text-zinc-400 text-sm">{new Date(previewLog.date).toLocaleString()} • {previewLog.userName}</p>
                      </div>
                      <button onClick={() => setPreviewLog(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors"><X size={24} /></button>
                  </div>
                  
                  {previewLog.type === 'LINE_STOP' && lineStopDataRaw ? (
                      <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-4 text-sm">
                               <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                                   <span className="block text-zinc-500 text-xs font-bold uppercase">Linha</span>
                                   <span className="text-white font-medium">{previewLog.line}</span>
                               </div>
                               <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                                   <span className="block text-zinc-500 text-xs font-bold uppercase">Modelo</span>
                                   <span className="text-white font-medium">{lineStopDataRaw.model}</span>
                               </div>
                               <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                                   <span className="block text-zinc-500 text-xs font-bold uppercase">Tempo Parado</span>
                                   <span className="text-red-400 font-bold">{lineStopDataRaw.totalTime}</span>
                               </div>
                               <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                                   <span className="block text-zinc-500 text-xs font-bold uppercase">Setor</span>
                                   <span className="text-white font-medium">{lineStopDataRaw.responsibleSector}</span>
                               </div>
                           </div>
                           <div className="bg-zinc-950 p-4 rounded border border-zinc-800">
                                <span className="block text-zinc-500 text-xs font-bold uppercase mb-2">Motivo</span>
                                <p className="text-zinc-300">{lineStopDataRaw.motivo}</p>
                           </div>
                           {lineStopDataRaw.justification && (
                               <div className="bg-zinc-950 p-4 rounded border border-zinc-800">
                                    <span className="block text-zinc-500 text-xs font-bold uppercase mb-2">Justificativa</span>
                                    <p className="text-zinc-300">{lineStopDataRaw.justification}</p>
                                    <p className="text-zinc-500 text-xs mt-2 italic">Por {lineStopDataRaw.justifiedBy} em {new Date(lineStopDataRaw.justifiedAt || '').toLocaleString()}</p>
                               </div>
                           )}
                           {previewLog.signedDocUrl && (
                               <div className="mt-4">
                                   <span className="block text-zinc-500 text-xs font-bold uppercase mb-2">Documento Assinado</span>
                                   <img src={previewLog.signedDocUrl} className="max-w-full rounded border border-zinc-700" />
                               </div>
                           )}
                      </div>
                  ) : (
                      <div className="space-y-6">
                          <div className="flex gap-4">
                              <div className="flex-1 bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                                  <div className="text-2xl font-bold text-white">{previewLog.itemsCount}</div>
                                  <div className="text-xs text-zinc-500 uppercase">Itens</div>
                              </div>
                              <div className="flex-1 bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                                  <div className={`text-2xl font-bold ${previewLog.ngCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{previewLog.ngCount}</div>
                                  <div className="text-xs text-zinc-500 uppercase">Não Conforme</div>
                              </div>
                          </div>

                          {previewLog.ngCount > 0 && (
                              <div>
                                  <h4 className="text-red-400 font-bold mb-3 flex items-center gap-2"><AlertTriangle size={16}/> Itens Reprovados</h4>
                                  <div className="space-y-3">
                                      {Object.entries(previewLog.data as ChecklistData).map(([itemId, status]) => {
                                          if (status !== 'NG') return null;
                                          const itemDef = items.find(i => i.id === itemId) || { text: 'Item ID: ' + itemId };
                                          const evidence = previewLog.evidenceData?.[itemId];
                                          return (
                                              <div key={itemId} className="bg-red-900/10 border border-red-900/30 p-4 rounded-lg">
                                                  <p className="font-medium text-zinc-200 mb-2">{itemDef.text}</p>
                                                  {evidence?.comment && <p className="text-sm text-red-300 mb-2">Obs: {evidence.comment}</p>}
                                                  {evidence?.photo && (
                                                      <img src={evidence.photo} className="h-32 rounded border border-red-900/50" />
                                                  )}
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          )}
                          
                          {previewLog.observation && (
                              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                  <h4 className="text-zinc-400 font-bold text-sm uppercase mb-2">Observações</h4>
                                  <p className="text-zinc-300">{previewLog.observation}</p>
                              </div>
                          )}

                          <div className="flex justify-end pt-4">
                              <Button variant="outline" onClick={() => exportLogToExcel(previewLog!, items)}><Download size={16}/> Baixar Excel</Button>
                          </div>
                      </div>
                  )}
              </Card>
          </div>
      );
  }

  // --- Components for Sidebar ---
  
  const SidebarContent = () => {
      // Sidebar implementation
      const navItemClass = (active: boolean) => 
        `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            active 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
        }`;

      return (
          <>
            <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                         <LayoutDashboard size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-zinc-100 leading-tight tracking-tight">TECPLAM</h1>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Enterprise</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                <button onClick={() => setView('MENU')} className={navItemClass(view === 'MENU')}>
                    <LayoutDashboard size={18} /> Dashboard
                </button>
                
                {hasPermission('CHECKLIST') && (
                    <>
                        <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest mt-6 mb-2 px-4">Operação</div>
                        <button onClick={() => setView('CHECKLIST_MENU')} className={navItemClass(view === 'CHECKLIST_MENU' || view === 'DASHBOARD' || view === 'PERSONAL')}>
                            <CheckSquare size={18} /> Checklist
                        </button>
                    </>
                )}
                
                {hasPermission('LINE_STOP') && (
                    <button onClick={() => setView('LINE_STOP_DASHBOARD')} className={navItemClass(view === 'LINE_STOP_DASHBOARD')}>
                        <AlertTriangle size={18} /> Parada de Linha
                    </button>
                )}
                
                {hasPermission('MAINTENANCE') && (
                     <button onClick={() => setView('MAINTENANCE_QR')} className={navItemClass(view === 'MAINTENANCE_QR')}>
                        <Hammer size={18} /> Manutenção
                    </button>
                )}

                {hasPermission('MEETING') && (
                     <button onClick={() => setView('MEETING_MENU')} className={navItemClass(view === 'MEETING_MENU' || view === 'MEETING_FORM' || view === 'MEETING_HISTORY')}>
                        <FileText size={18} /> Reuniões
                    </button>
                )}

                {(hasPermission('AUDIT') || hasPermission('ADMIN')) && (
                    <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest mt-6 mb-2 px-4">Gestão</div>
                )}
                
                {hasPermission('AUDIT') && (
                     <button onClick={() => setView('AUDIT_MENU')} className={navItemClass(view === 'AUDIT_MENU')}>
                        <Search size={18} /> Auditoria
                    </button>
                )}
                
                {hasPermission('ADMIN') && (
                     <button onClick={() => setView('ADMIN')} className={navItemClass(view === 'ADMIN')}>
                        <Shield size={18} /> Admin
                    </button>
                )}
            </nav>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                 <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer" onClick={() => setView('PROFILE')}>
                     <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 font-bold border border-zinc-600">
                         {currentUser?.name.charAt(0)}
                     </div>
                     <div className="flex-1 min-w-0">
                         <p className="text-sm font-medium text-zinc-200 truncate">{currentUser?.name}</p>
                         <p className="text-xs text-zinc-500 truncate">{currentUser?.role}</p>
                     </div>
                     <Settings size={14} className="text-zinc-500" />
                 </div>
                 <button onClick={handleLogout} className="mt-2 w-full flex items-center justify-center gap-2 text-xs text-red-400 hover:text-red-300 py-2 rounded hover:bg-red-900/10 transition-colors">
                     <LogOut size={14} /> Sair do Sistema
                 </button>
            </div>
          </>
      )
  }

  // --- MENU DASHBOARD ---
  if (view === 'MENU') {
      return (
          <Layout sidebar={<SidebarContent />}>
              <header className="mb-8">
                  <h1 className="text-2xl font-bold mb-2 text-white">Bem-vindo, {currentUser?.name.split(' ')[0]}</h1>
                  <p className="text-zinc-400">Selecione um módulo para iniciar.</p>
              </header>

              {/* ALERTS SECTION */}
              <div className="mb-8 space-y-4">
                  {pendingLineStopsCount > 0 && (hasPermission('AUDIT') || hasPermission('LINE_STOP') || isSuperAdmin) && (
                      <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-center gap-4 animate-pulse">
                          <div className="p-2 bg-red-500 rounded-full text-white"><AlertTriangle size={20} /></div>
                          <div className="flex-1">
                              <h3 className="font-bold text-red-400">Paradas sem Justificativa</h3>
                              <p className="text-xs text-red-300">Existem {pendingLineStopsCount} paradas de linha aguardando justificativa do líder.</p>
                          </div>
                          <Button size="sm" onClick={() => setView('LINE_STOP_DASHBOARD')}>Ver</Button>
                      </div>
                  )}

                  {missingLeadersNames.length > 0 && (hasPermission('AUDIT') || isSuperAdmin) && (
                      <div className="bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-xl flex flex-col gap-3">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-yellow-500 rounded-full text-zinc-900"><Clock size={20} /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-yellow-400">Checklists Pendentes Hoje</h3>
                                <p className="text-xs text-yellow-300">Líderes que ainda não enviaram o relatório do turno.</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pl-12">
                                {missingLeadersNames.map(name => (
                                    <span key={name} className="px-2 py-1 bg-yellow-500/10 text-yellow-200 rounded text-xs border border-yellow-500/20">{name}</span>
                                ))}
                          </div>
                      </div>
                  )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hasPermission('CHECKLIST') && (
                      <div onClick={() => setView('CHECKLIST_MENU')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-blue-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><CheckSquare size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Checklist</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Liderança & Operação</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {hasPermission('LINE_STOP') && (
                      <div onClick={() => setView('LINE_STOP_DASHBOARD')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-red-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><AlertTriangle size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Parada de Linha</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Reporte de interrupções</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {hasPermission('MAINTENANCE') && (
                      <div onClick={() => setView('MAINTENANCE_QR')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-orange-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-orange-600/20 text-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Hammer size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Manutenção</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Inspeção de Máquinas</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {hasPermission('MEETING') && (
                      <div onClick={() => setView('MEETING_MENU')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-emerald-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><FileText size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Reuniões</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Atas e Registros</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {hasPermission('AUDIT') && (
                      <div onClick={() => setView('AUDIT_MENU')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-yellow-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-yellow-600/20 text-yellow-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Search size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Auditoria</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Gestão e Relatórios</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {hasPermission('ADMIN') && (
                      <div onClick={() => setView('ADMIN')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-zinc-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-zinc-700/50 text-zinc-300 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Shield size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Admin</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Configurações do Sistema</p>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </Layout>
      );
  }

  // --- LOGIN ---
  if (view === 'LOGIN') {
      return (
        <Layout variant="auth">
          {isLoading && <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center text-white backdrop-blur-sm">Carregando...</div>}
          <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-zinc-900 text-blue-500 mb-6 border border-zinc-800 shadow-2xl shadow-blue-900/20">
                        <LayoutDashboard size={48} />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">TECPLAM</h1>
                    <p className="text-zinc-400 text-sm uppercase tracking-widest font-medium">Controle Automático de Relatório</p>
                </div>
                
                <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white"><LogIn className="text-blue-500" size={20} /> Login</h2>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <Input 
                            icon={<UserIcon size={18}/>} 
                            label="Matrícula" 
                            placeholder="Digite sua matrícula" 
                            value={loginMatricula} 
                            onChange={(e) => setLoginMatricula(e.target.value)} 
                            onKeyDown={(e) => { if(e.key === 'Enter') passwordInputRef.current?.focus(); }}
                            autoComplete="off" 
                        />
                        <div className="relative">
                            <Input 
                                ref={passwordInputRef}
                                icon={<Shield size={18}/>} 
                                label="Senha" 
                                type={showLoginPassword ? "text" : "password"}
                                placeholder="••••••••" 
                                value={loginPassword} 
                                onChange={(e) => setLoginPassword(e.target.value)} 
                                onKeyDown={(e) => { if(e.key === 'Enter') handleLogin(); }}
                                autoComplete="off" 
                            />
                            <button 
                                type="button" 
                                className="absolute right-3 top-9 text-zinc-500 hover:text-white"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                            >
                                {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2">
                             <button type="button" onClick={() => setView('RECOVER')} className="text-xs text-zinc-500 hover:text-blue-400 transition-colors">Esqueci a senha</button>
                        </div>

                        {loginError && (<div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-300 text-xs flex items-center gap-2 font-medium"><AlertCircle size={16} /> {loginError}</div>)}
                        
                        <Button type="submit" fullWidth disabled={isLoading} className="mt-4 py-3">{isLoading ? 'Entrando...' : 'Acessar Sistema'}</Button>
                    </form>
                    
                    <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
                        <Button variant="ghost" fullWidth onClick={() => setView('REGISTER')} className="text-sm">Criar nova conta</Button>
                    </div>
                </div>
                
                <div className="mt-8 text-center text-xs text-zinc-600 flex justify-center gap-4">
                     <span className="flex items-center gap-1"><Wifi size={10} className="text-emerald-500" /> Servidor Local</span>
                     <button onClick={() => { clearServerUrl(); setView('SETUP'); }} className="hover:text-zinc-400">Alterar IP</button>
                </div>
            </div>
          </div>
        </Layout>
      );
  }

  // --- REGISTER VIEW ---
  if (view === 'REGISTER') return (
    <Layout variant="auth">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white"><UserPlus className="text-blue-500" size={20} /> Criar Conta</h2>
                <form onSubmit={handleRegister} className="space-y-4">
                    <Input label="Nome Completo" value={regName} onChange={e => setRegName(e.target.value)} />
                    <Input label="Matrícula" value={regMatricula} onChange={e => setRegMatricula(e.target.value)} />
                    <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide block">Função</label>
                        <select className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-600/50" value={regRole} onChange={e => setRegRole(e.target.value)}>
                            {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide block">Turno</label>
                        <select className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-600/50" value={regShift} onChange={e => setRegShift(e.target.value)}>
                            <option value="1">1º Turno</option>
                            <option value="2">2º Turno</option>
                        </select>
                    </div>
                    <Input label="Email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                    
                    <div className="relative">
                        <Input label="Senha" type={showRegPassword ? "text" : "password"} value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                        <button type="button" className="absolute right-3 top-9 text-zinc-500 hover:text-white" onClick={() => setShowRegPassword(!showRegPassword)}>
                            {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <Input label="Confirmar Senha" type="password" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} className={regConfirmPassword && regPassword !== regConfirmPassword ? "border-red-500 focus:border-red-500" : ""} />

                    {regError && <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{regError}</div>}
                    
                    <div className="pt-4 flex flex-col gap-3">
                        <Button type="submit" fullWidth disabled={isLoading}>{isLoading ? 'Salvando...' : 'Cadastrar'}</Button>
                        <Button type="button" variant="outline" fullWidth onClick={() => setView('LOGIN')}>Voltar ao Login</Button>
                    </div>
                </form>
            </div>
        </div>
    </Layout>
  );

  // ... (Recover, Setup Omitted for brevity - No changes)

  // --- CHECKLIST SUB-MENU (Updated: Removed Maintenance button) ---
  if (view === 'CHECKLIST_MENU') {
      return (
        <Layout sidebar={<SidebarContent />}>
            <header className="mb-8">
                <h1 className="text-2xl font-bold mb-2 text-white">Central de Checklists</h1>
                <p className="text-zinc-400">Selecione uma ação abaixo.</p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {hasPermission('CHECKLIST') && (
                     <div onClick={handleStartChecklist} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-blue-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><CheckSquare size={80}/></div>
                         <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Plus size={24} /></div>
                         <h3 className="font-bold text-xl text-zinc-100">Novo Checklist (Líder)</h3>
                         <p className="text-sm text-zinc-500 mt-2">Iniciar verificação padrão de turno.</p>
                     </div>
                 )}

                 <div onClick={handleOpenPersonalHistory} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-purple-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><History size={80}/></div>
                     <div className="w-12 h-12 bg-purple-600/20 text-purple-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><History size={24} /></div>
                     <h3 className="font-bold text-xl text-zinc-100">Meus Registros</h3>
                     <p className="text-sm text-zinc-500 mt-2">Ver histórico dos meus envios anteriores.</p>
                 </div>
            </div>

            {/* Modal Logic ... */}
            {showLinePrompt && (
              <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                  <Card className="w-full max-w-sm bg-zinc-900 border border-zinc-800">
                      <h3 className="text-xl font-bold mb-4 text-white text-center">Selecione a Linha</h3>
                      <div className="space-y-4">
                          <select 
                              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white outline-none focus:ring-2 focus:ring-blue-600/50"
                              value={currentLine} 
                              onChange={e => setCurrentLine(e.target.value)}
                          >
                              {lines.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <div className="flex gap-2">
                              <Button variant="secondary" fullWidth onClick={() => setShowLinePrompt(false)}>Cancelar</Button>
                              <Button fullWidth onClick={handleConfirmLine}>Confirmar</Button>
                          </div>
                      </div>
                  </Card>
              </div>
            )}
        </Layout>
      );
  }

  // --- MAINTENANCE EDITOR (Updated: Filter by Line) ---
  if (view === 'AUDIT_MENU' && (auditTab === 'MAINTENANCE_EDITOR' || auditTab === 'LEADER_EDITOR')) {
        const isMaint = auditTab === 'MAINTENANCE_EDITOR';
        const targetList = isMaint ? maintenanceItems : leaderItems;
        const setTargetList = isMaint ? setMaintenanceItems : setLeaderItems;
        
        // Filter logic for Maintenance mode
        const filteredList = isMaint 
            ? targetList.filter(item => item.category.startsWith(maintenanceLine)) 
            : targetList;

        return (
            <Layout sidebar={<SidebarContent />}>
                <header className="flex flex-col gap-4 mb-8 pb-6 border-b border-zinc-800">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Search className="text-yellow-500" /> Auditoria</h1>
                        <Button variant="outline" onClick={() => { setView('AUDIT_MENU'); setAuditTab('LEADER_HISTORY'); }}><ArrowLeft size={16}/> Voltar</Button>
                    </div>
                </header>

                <Card>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold">{isMaint ? 'Configurar Máquinas (QR Code)' : 'Editor de Checklist (Líder)'}</h3>
                            {isMaint && <p className="text-xs text-zinc-400">Adicione postos de manutenção para cada linha.</p>}
                        </div>
                        <Button onClick={() => handleSaveEditor(targetList, isMaint ? 'MAINTENANCE' : 'LEADER')}><Save size={16}/> Salvar Tudo</Button>
                    </div>

                    {isMaint && (
                        <div className="mb-6 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Selecione a Linha para Editar/Criar</label>
                            <select className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-white" value={maintenanceLine} onChange={e => setMaintenanceLine(e.target.value)}>
                                {lines.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="space-y-4">
                        {filteredList.map((item, idx) => (
                            <div key={item.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Categoria / Máquina</label>
                                        <input className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-sm text-white" value={item.category} onChange={e => handleEditorChange(targetList, setTargetList, item.id, 'category', e.target.value)} />
                                    </div>
                                    <div className="flex-[3]">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Item de Verificação</label>
                                        <input className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-sm text-white" value={item.text} onChange={e => handleEditorChange(targetList, setTargetList, item.id, 'text', e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex gap-3 items-end">
                                    <div className="flex-[3]">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Referência / Evidência</label>
                                        <input className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-sm text-white" value={item.evidence || ''} onChange={e => handleEditorChange(targetList, setTargetList, item.id, 'evidence', e.target.value)} />
                                    </div>
                                    <div>
                                        {item.imageUrl ? (
                                            <div className="flex items-center gap-2">
                                                <img src={item.imageUrl} className="h-10 w-10 object-cover rounded border border-zinc-700"/>
                                                <button onClick={() => handleEditorRemoveImage(targetList, setTargetList, item.id)} className="text-red-500 text-xs hover:underline">Remover</button>
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer text-xs bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 border border-zinc-700 block">
                                                Add Imagem
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleEditorImage(targetList, setTargetList, item.id, e.target.files[0]) }} />
                                            </label>
                                        )}
                                    </div>
                                    <button onClick={() => handleEditorDelete(targetList, setTargetList, item.id)} className="p-2 bg-red-900/20 text-red-500 rounded hover:bg-red-900/40"><Trash2 size={16}/></button>
                                </div>
                                {isMaint && (
                                    <div className="mt-2 pt-2 border-t border-zinc-800">
                                        <button onClick={() => printQrCode(item.category)} className="text-xs text-blue-400 hover:underline flex items-center gap-1"><QrCode size={12}/> Imprimir QR Code da Máquina ({item.category})</button>
                                    </div>
                                )}
                            </div>
                        ))}
                        <Button variant="outline" fullWidth onClick={() => handleEditorAdd(targetList, setTargetList, isMaint ? 'MAINTENANCE' : 'LEADER')}><Plus size={16}/> Adicionar Novo Item em {isMaint ? maintenanceLine : 'Geral'}</Button>
                    </div>
                </Card>
            </Layout>
        )
  }

  // --- RECOVER VIEW ---
  if (view === 'RECOVER') return <Layout variant="auth"><div className="flex flex-col items-center justify-center min-h-screen px-4"><div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-md text-center"><h2 className="text-xl font-bold mb-4 text-white">Recuperar Senha</h2><p className="text-sm text-zinc-400 mb-6">Entre em contato com o Admin ou digite seus dados abaixo se houver sistema de email configurado.</p><Button fullWidth onClick={() => setView('LOGIN')}>Voltar ao Login</Button></div></div></Layout>;

  // --- SETUP VIEW ---
  if (view === 'SETUP') return <Layout variant="auth"><div className="flex flex-col items-center justify-center min-h-screen px-4"><div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-md"><h1 className="text-2xl font-bold text-center mb-4 text-white">Configuração de Rede</h1><Input label="IP do Servidor" value={serverIp} onChange={e => setServerIp(e.target.value)} placeholder="http://192.168.X.X:3000" /><Button onClick={async () => { if(serverIp){ saveServerUrl(serverIp); await initApp(); } }} fullWidth className="mt-6">Conectar</Button></div></div></Layout>;

  if (view === 'DASHBOARD' || view === 'SUCCESS' || view === 'PERSONAL' || view === 'PROFILE' || view === 'MEETING_MENU' || view === 'MEETING_FORM' || view === 'MEETING_HISTORY' || view === 'MAINTENANCE_QR' || view === 'LINE_STOP_DASHBOARD' || view === 'AUDIT_MENU' || view === 'ADMIN') {
      
      if (view === 'AUDIT_MENU') {
          // If it was Editor, it was handled above. If not, handle here.
          return (
            <Layout sidebar={<SidebarContent />}>
                {renderPreviewModal()}
                <header className="flex flex-col gap-4 mb-8 pb-6 border-b border-zinc-800">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Search className="text-yellow-500" /> Auditoria</h1>
                    </div>
                </header>

                <div className="mb-6 space-y-6">
                    <div>
                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-3">Produção & Líderes</h3>
                        <div className="flex flex-wrap gap-2">
                            <Button variant={auditTab === 'LEADER_HISTORY' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LEADER_HISTORY')}><History size={16} /> Histórico</Button>
                            <Button variant={auditTab === 'LEADERS' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LEADERS')}><UserCheck size={16} /> Monitoramento</Button>
                            <Button variant={auditTab === 'LINES' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LINES')}><List size={16} /> Monitoramento Linhas</Button>
                            <Button variant={auditTab === 'LEADER_EDITOR' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LEADER_EDITOR')}><Edit3 size={16} /> Editor</Button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-3">Manutenção</h3>
                        <div className="flex flex-wrap gap-2">
                            <Button variant={auditTab === 'MAINTENANCE_HISTORY' ? 'primary' : 'secondary'} onClick={() => setAuditTab('MAINTENANCE_HISTORY')}><History size={16} /> Histórico</Button>
                            <Button variant={auditTab === 'MAINTENANCE_MATRIX' ? 'primary' : 'secondary'} onClick={() => setAuditTab('MAINTENANCE_MATRIX')}><List size={16} /> Monitoramento Manutenção</Button>
                            <Button variant={auditTab === 'MAINTENANCE_EDITOR' ? 'primary' : 'secondary'} onClick={() => setAuditTab('MAINTENANCE_EDITOR')}><Edit3 size={16} /> Configurar Máquinas</Button>
                        </div>
                    </div>
                </div>

                {auditTab === 'LEADER_HISTORY' && (
                    <Card>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"><h3 className="text-lg font-bold">Histórico Geral</h3><div className="flex flex-wrap gap-2 relative z-50"><input type="date" className="bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)}/><select className="bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={historyShiftFilter} onChange={e => setHistoryShiftFilter(e.target.value)}><option value="ALL">Todos</option><option value="1">Turno 1</option><option value="2">Turno 2</option></select></div></div>
                        <div className="overflow-x-auto rounded-lg border border-zinc-800"><table className="w-full text-sm text-left text-zinc-300"><thead className="text-xs text-zinc-400 uppercase bg-zinc-950 font-semibold"><tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Líder</th><th className="px-6 py-4">Linha</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4">Obs</th><th className="px-6 py-4 text-right">Ação</th></tr></thead><tbody className="divide-y divide-zinc-800 bg-zinc-900">{historyLogs.map(log => (<tr key={log.id} className="hover:bg-zinc-800/50 transition-colors"><td className="px-6 py-4">{new Date(log.date).toLocaleString()}</td><td className="px-6 py-4 font-medium text-white">{log.userName}</td><td className="px-6 py-4"><span className="bg-zinc-800 px-2 py-1 rounded text-xs">{log.line || '-'}</span></td><td className="px-6 py-4 text-center">{log.ngCount > 0 ? <span className="bg-red-900/20 text-red-400 px-2 py-1 rounded-full text-xs font-bold border border-red-900/30">{log.ngCount} NG</span> : <span className="bg-green-900/20 text-green-400 px-2 py-1 rounded-full text-xs font-bold border border-green-900/30">OK</span>}</td><td className="px-6 py-4 truncate max-w-[150px] text-zinc-500">{log.observation}</td><td className="px-6 py-4 text-right flex justify-end gap-2"><button onClick={() => setPreviewLog(log)} className="p-2 bg-blue-600/10 text-blue-500 rounded hover:bg-blue-600/20"><Eye size={16}/></button><button className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700" onClick={(e) => {e.stopPropagation(); exportLogToExcel(log, items)}}><Download size={16}/></button></td></tr>))}</tbody></table></div>
                    </Card>
                )}
                
                {auditTab === 'MAINTENANCE_HISTORY' && (
                    <Card><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold">Histórico Manutenção</h3></div>
                    <div className="overflow-x-auto rounded-lg border border-zinc-800"><table className="w-full text-sm text-left text-zinc-300"><thead className="text-xs text-zinc-400 uppercase bg-zinc-950 font-semibold"><tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Técnico</th><th className="px-6 py-4">Máquina</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-right">Ação</th></tr></thead><tbody className="divide-y divide-zinc-800 bg-zinc-900">{historyLogs.map(log => (<tr key={log.id} className="hover:bg-zinc-800/50 transition-colors"><td className="px-6 py-4">{new Date(log.date).toLocaleString()}</td><td className="px-6 py-4 font-medium text-white">{log.userName}</td><td className="px-6 py-4 font-bold text-purple-400">{log.maintenanceTarget || log.line}</td><td className="px-6 py-4 text-center">{log.ngCount > 0 ? <span className="bg-red-900/20 text-red-400 px-2 py-1 rounded-full text-xs font-bold border border-red-900/30">NG</span> : <span className="bg-green-900/20 text-green-400 px-2 py-1 rounded-full text-xs font-bold border border-green-900/30">OK</span>}</td><td className="px-6 py-4 text-right flex justify-end gap-2"><button onClick={() => setPreviewLog(log)} className="p-2 bg-blue-600/10 text-blue-500 rounded hover:bg-blue-600/20"><Eye size={16}/></button><button className="p-2 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700" onClick={(e) => {e.stopPropagation(); exportLogToExcel(log, items)}}><Download size={16}/></button></td></tr>))}</tbody></table></div></Card>
                )}

                {(auditTab === 'LINES' || auditTab === 'LEADERS' || auditTab === 'MAINTENANCE_MATRIX') && (
                    <Card>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <h3 className="text-lg font-bold">
                                {auditTab === 'LINES' ? 'Monitoramento de Linhas' : auditTab === 'MAINTENANCE_MATRIX' ? 'Monitoramento de Manutenção' : 'Matrix de Líderes'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 relative z-50">
                                <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800"><span className="text-xs text-zinc-500 px-1 font-bold">SEMANA</span><input type="week" onClick={showPicker} className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none cursor-pointer" value={linesWeekFilter} onChange={e => setLinesWeekFilter(e.target.value)} /></div>
                                <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-lg border border-zinc-800"><span className="text-xs text-zinc-500 px-1 font-bold">TURNO</span><select className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none" value={linesShiftFilter} onChange={e => setLinesShiftFilter(e.target.value)}><option value="1">1º Turno</option><option value="2">2º Turno</option><option value="ALL">Todos</option></select></div>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-zinc-800">
                            {auditTab === 'LINES' ? (
                                <table className="w-full text-sm text-center border-collapse">
                                    <thead><tr className="text-zinc-400 bg-zinc-950"><th className="p-3 text-left w-56 font-semibold uppercase text-xs">Linha</th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sab</th><th></th></tr></thead>
                                    <tbody className="bg-zinc-900 divide-y divide-zinc-800">{linesMatrix.map((row, i) => (
                                        <tr key={i} className="hover:bg-zinc-800/50">
                                            <td className="p-4 text-left font-bold text-blue-400">{row.line}</td>
                                            {row.statuses.map((st, j) => <td key={j} className="p-3"><div onClick={() => st.logIds.length && handleOpenPreview(st.logIds[0])} className={`w-full h-8 rounded flex items-center justify-center font-bold text-xs border ${st.status === 'OK' ? 'bg-green-900/20 text-green-500 border-green-900/30' : st.status === 'NG' ? 'bg-red-900/20 text-red-500 border-red-900/30' : 'bg-zinc-950 text-zinc-700 border-zinc-800'}`}>{st.status === 'PENDING' ? '-' : st.status}</div></td>)}
                                            <td className="p-3">{linesShiftFilter !== 'ALL' && <button onClick={() => handleDownloadSheet(row.line)} className="bg-blue-600/20 text-blue-400 p-2 rounded hover:bg-blue-600/30"><Download size={16}/></button>}</td>
                                        </tr>))}
                                    </tbody>
                                </table>
                            ) : auditTab === 'MAINTENANCE_MATRIX' ? (
                                <table className="w-full text-sm text-center border-collapse">
                                    <thead><tr className="text-zinc-400 bg-zinc-950"><th className="p-3 text-left w-56 font-semibold uppercase text-xs">Linha</th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sab</th><th></th></tr></thead>
                                    <tbody className="bg-zinc-900 divide-y divide-zinc-800">{maintenanceMatrix.map((row, i) => (
                                        <tr key={i} className="hover:bg-zinc-800/50">
                                            <td className="p-4 text-left font-bold text-orange-400">{row.line}</td>
                                            {row.statuses.map((st, j) => <td key={j} className="p-3"><div onClick={() => st.logIds.length && handleOpenPreview(st.logIds[0])} className={`w-full h-8 rounded flex flex-col items-center justify-center font-bold text-[10px] border ${st.status === 'OK' ? 'bg-green-900/20 text-green-500 border-green-900/30' : st.status === 'NG' ? 'bg-red-900/20 text-red-500 border-red-900/30' : 'bg-zinc-950 text-zinc-700 border-zinc-800'}`}>{st.status === 'PENDING' ? '-' : st.status === 'NG' ? <><span className="text-xs">NG</span><span className="truncate max-w-[60px] text-[8px] leading-tight">{st.details}</span></> : 'OK'}</div></td>)}
                                            <td className="p-3">{linesShiftFilter !== 'ALL' && <button onClick={() => handleDownloadSheet(row.line)} className="bg-blue-600/20 text-blue-400 p-2 rounded hover:bg-blue-600/30"><Download size={16}/></button>}</td>
                                        </tr>))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-sm text-center border-collapse"><thead><tr className="text-zinc-400 bg-zinc-950"><th className="p-3 text-left w-56 font-semibold uppercase text-xs">Líder</th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sab</th></tr></thead><tbody className="bg-zinc-900 divide-y divide-zinc-800">{leadersMatrix.map((row, i) => (<tr key={i} className="hover:bg-zinc-800/50"><td className="p-4 text-left font-bold text-white">{row.user.name}</td>{row.statuses.map((st, j) => <td key={j} className="p-3"><div onClick={() => st.logId && handleOpenPreview(st.logId)} className={`w-full h-8 rounded flex items-center justify-center font-bold text-xs border ${st.status === 'OK' ? 'bg-green-900/20 text-green-500 border-green-900/30' : st.status === 'NG' ? 'bg-red-900/20 text-red-500 border-red-900/30' : 'bg-zinc-950 text-zinc-700 border-zinc-800'}`}>{st.status === 'PENDING' ? '-' : st.status}</div></td>)}</tr>))}</tbody></table>
                            )}
                        </div>
                    </Card>
                )}
            </Layout>
          );
      } else if (view === 'ADMIN') {
          return (
            <Layout sidebar={<SidebarContent />}>
                <header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
                    <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Shield className="text-zinc-400" /> Painel Administrativo</h1>
                </header>
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    <Button variant={adminTab === 'USERS' ? 'primary' : 'secondary'} onClick={() => setAdminTab('USERS')}><Users size={16}/> Usuários</Button>
                    <Button variant={adminTab === 'LINES' ? 'primary' : 'secondary'} onClick={() => setAdminTab('LINES')}><List size={16}/> Linhas</Button>
                    <Button variant={adminTab === 'ROLES' ? 'primary' : 'secondary'} onClick={() => setAdminTab('ROLES')}><UserCheck size={16}/> Cargos</Button>
                    <Button variant={adminTab === 'PERMISSIONS' ? 'primary' : 'secondary'} onClick={() => setAdminTab('PERMISSIONS')}><Shield size={16}/> Permissões</Button>
                </div>

                {adminTab === 'PERMISSIONS' && (
                    <Card className="overflow-x-auto">
                        <h3 className="text-lg font-bold mb-4">Permissões de Acesso (Matriz Invertida)</h3>
                        <table className="w-full text-sm text-center border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 text-zinc-400">
                                    <th className="p-3 text-left">Cargo</th>
                                    {['CHECKLIST', 'LINE_STOP', 'MEETING', 'MAINTENANCE', 'AUDIT', 'ADMIN'].map(mod => (
                                        <th key={mod} className="p-3 min-w-[100px] text-xs uppercase">{MODULE_NAMES[mod] || mod}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {availableRoles.map(role => (
                                    <tr key={role} className="hover:bg-zinc-900">
                                        <td className="p-3 text-left font-bold text-white">{role}</td>
                                        {['CHECKLIST', 'LINE_STOP', 'MEETING', 'MAINTENANCE', 'AUDIT', 'ADMIN'].map((module: any) => {
                                            const perm = permissions.find(p => p.role === role && p.module === module);
                                            // Default logic
                                            const isAllowed = perm ? perm.allowed : (['CHECKLIST','MEETING','MAINTENANCE','LINE_STOP'].includes(module));
                                            
                                            return (
                                                <td key={module} className="p-3">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isAllowed} 
                                                        onChange={() => handleTogglePermission(role, module)} 
                                                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-600/50" 
                                                    />
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}

                {adminTab === 'USERS' && (
                    <Card>
                        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Usuários</h3><Button onClick={() => setView('REGISTER')} variant="outline" size="sm"><UserPlus size={16}/> Novo</Button></div>
                        <div className="overflow-x-auto"><table className="w-full text-sm text-left text-zinc-300"><thead className="text-xs text-zinc-400 uppercase bg-zinc-950"><tr><th>Nome</th><th>Matrícula</th><th>Função</th><th>Admin</th><th>Ações</th></tr></thead><tbody className="divide-y divide-zinc-800">{usersList.map(u => (<tr key={u.matricula}><td className="px-4 py-3">{u.name}</td><td className="px-4 py-3">{u.matricula}</td><td className="px-4 py-3">{u.role}</td><td className="px-4 py-3">{u.isAdmin ? <span className="text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded text-xs border border-green-900/50">ADMIN</span> : <span className="text-zinc-600">-</span>}</td><td className="px-4 py-3"><button onClick={() => openEditModal(u)} className="mr-2 text-blue-400"><Edit3 size={16}/></button><button onClick={async () => { if(confirm('Excluir?')) { await deleteUser(u.matricula); setUsersList(await getAllUsers()); }}} className="text-red-400"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
                    </Card>
                )}
                {/* ... other admin tabs ... */}
                {adminTab === 'LINES' && (
                    <Card><h3 className="text-lg font-bold mb-4">Linhas</h3><div className="flex gap-2 mb-6"><Input value={newLineName} onChange={e => setNewLineName(e.target.value)} placeholder="Nova Linha"/><Button onClick={async () => { if(newLineName){ const u = [...lines, newLineName]; await saveLines(u); setLines(u); setNewLineName(''); } }}>Add</Button></div><div className="grid grid-cols-2 gap-3">{lines.map(l => <div key={l} className="bg-zinc-950 p-2 rounded flex justify-between">{l}<button onClick={async () => { if(confirm('Excluir?')) { const u = lines.filter(x => x!==l); await saveLines(u); setLines(u); } }} className="text-red-500"><X size={16}/></button></div>)}</div></Card>
                )}
                {adminTab === 'ROLES' && (
                    <Card><h3 className="text-lg font-bold mb-4">Cargos</h3><div className="flex gap-2 mb-6"><Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Novo Cargo"/><Button onClick={handleAddRole}>Add</Button></div><div className="grid grid-cols-2 gap-3">{availableRoles.map(r => <div key={r} className="bg-zinc-950 p-2 rounded flex justify-between">{r}<button onClick={() => handleDeleteRole(r)} className="text-red-500"><X size={16}/></button></div>)}</div></Card>
                )}
                {/* Modal Edit User */}
                {showUserEditModal && editingUser && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
                            <h3 className="text-xl font-bold mb-4">Editar Usuário</h3>
                            <div className="space-y-3">
                                <Input label="Nome" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                                <Input label="Matrícula" value={editingUser.matricula} onChange={e => setEditingUser({...editingUser, matricula: e.target.value})} />
                                <div><label className="text-xs font-medium text-zinc-400 mb-1">Função</label><select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>{availableRoles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                                <div><label className="text-xs font-medium text-zinc-400 mb-1">Turno</label><select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={editingUser.shift} onChange={e => setEditingUser({...editingUser, shift: e.target.value})}><option value="1">1º Turno</option><option value="2">2º Turno</option></select></div>
                                <Input label="Nova Senha (Opcional)" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
                                <div className="flex items-center gap-2 mt-2"><input type="checkbox" id="isAdminCheck" checked={editingUser.isAdmin || false} onChange={e => setEditingUser({...editingUser, isAdmin: e.target.checked})} /><label htmlFor="isAdminCheck" className="text-sm text-zinc-300">Acesso Admin Global</label></div>
                                <div className="flex gap-2 mt-4"><Button variant="secondary" fullWidth onClick={() => setShowUserEditModal(false)}>Cancelar</Button><Button fullWidth onClick={saveUserChanges}>Salvar</Button></div>
                            </div>
                        </Card>
                    </div>
                )}
            </Layout>
          );
      }

      // Default Dashboard Rendering if not intercepted
      if (view === 'DASHBOARD') {
          return (
            <Layout sidebar={<SidebarContent />}>
                {isLoading && <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center text-white backdrop-blur-sm">Salvando...</div>}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div><h1 className="text-2xl font-bold text-white flex items-center gap-2">{isMaintenanceMode ? <Hammer className="text-purple-500"/> : <CheckSquare className="text-blue-500"/>} {isMaintenanceMode ? 'Manutenção' : 'Checklist Digital'}</h1><div className="flex items-center gap-2 mt-2 text-sm text-zinc-400"><span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 border border-zinc-700">{currentLine}</span><span>•</span><span>{getManausDate().toLocaleDateString()}</span></div></div>
                    <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setView(isMaintenanceMode ? 'MAINTENANCE_QR' : 'CHECKLIST_MENU')}><ArrowLeft size={16} /> Voltar</Button></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="hidden md:block md:col-span-1"><div className="sticky top-8 space-y-1 max-h-[80vh] overflow-y-auto custom-scrollbar pr-2"><p className="text-xs font-bold text-zinc-500 uppercase px-2 mb-3 tracking-wider">Navegação Rápida</p>{categories.map(cat => (<button key={cat} onClick={() => categoryRefs.current[cat]?.scrollIntoView({behavior:'smooth'})} className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 transition-colors truncate border-l-2 border-transparent hover:border-blue-500">{cat}</button>))}</div></div>
                    <div className="md:col-span-3 space-y-10 pb-24">
                        {categories.map(cat => (
                            <div key={cat} ref={el => { categoryRefs.current[cat] = el; }} className="scroll-mt-8">
                                <h2 className="text-lg font-bold text-white mb-4 pl-3 border-l-4 border-blue-600 flex items-center gap-2">{cat}</h2>
                                <div className="space-y-4">{items.filter(i => i.category === cat).map(item => { const currentStatus = checklistData[item.id]; return (<div key={item.id} className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm"><div className="flex flex-col gap-4">{item.imageUrl && (<div className="w-full h-48 bg-black/20 rounded-lg border border-zinc-800 overflow-hidden flex items-center justify-center"><img src={item.imageUrl} alt="Ref" className="max-h-full max-w-full object-contain" /></div>)}<div className="flex-1"><p className="text-zinc-200 font-medium mb-1.5 text-base">{item.text}</p>{item.evidence && (<p className="text-zinc-500 text-xs italic mb-4 flex items-center gap-1"><AlertCircle size={12}/> Ref: {item.evidence}</p>)}<div className="flex gap-3 mb-2"><button onClick={() => setChecklistData({...checklistData, [item.id]: 'OK'})} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2 ${currentStatus === 'OK' ? 'bg-green-500/10 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900'}`}>OK</button><button onClick={() => setChecklistData({...checklistData, [item.id]: 'NG'})} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2 ${currentStatus === 'NG' ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900'}`}>NG</button><button onClick={() => setChecklistData({...checklistData, [item.id]: 'N/A'})} className={`w-20 py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center ${currentStatus === 'N/A' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900'}`}>N/A</button></div>{currentStatus === 'NG' && (<div className="bg-red-900/10 border border-red-900/30 rounded-lg p-4 mt-3 animate-in fade-in slide-in-from-top-2"><p className="text-xs text-red-400 font-bold mb-3 flex items-center gap-1 uppercase tracking-wide"><AlertTriangle size={12}/> Evidência Obrigatória</p><Input placeholder="Descreva o motivo da falha..." value={checklistEvidence[item.id]?.comment || ''} onChange={e => handleNgComment(item.id, e.target.value)} className="bg-black/20 border-red-900/30 focus:border-red-500 mb-3" /><div>{checklistEvidence[item.id]?.photo ? (<div className="relative inline-block group"><img src={checklistEvidence[item.id]?.photo} className="h-24 w-auto rounded-lg border border-red-900/30 shadow-lg" /><button onClick={() => setChecklistEvidence(prev => { const n = {...prev}; delete n[item.id].photo; return n; })} className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 shadow-md transition-transform hover:scale-110"><X size={12}/></button></div>) : (<label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 hover:text-white text-xs text-zinc-400 px-4 py-2.5 rounded-lg inline-flex items-center gap-2 border border-zinc-700 transition-colors"><Camera size={16} /> Adicionar Foto<input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleNgPhoto(item.id, e.target.files[0]) }} /></label>)}</div></div>)}</div></div></div>); })}</div>
                            </div>
                        ))}
                        <Card className="bg-zinc-900 border-zinc-800"><label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wide">Observações Gerais</label><textarea className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 h-32 resize-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 outline-none transition-all placeholder-zinc-600" placeholder="Anotações adicionais sobre o turno..." value={observation} onChange={e => setObservation(e.target.value)} /></Card>
                    </div>
                </div>
                <div className="fixed bottom-0 right-0 left-0 md:left-72 p-4 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800 flex justify-between items-center z-40"><div className="hidden md:block text-xs text-zinc-500">{Object.keys(checklistData).length} / {items.length} itens verificados</div><Button onClick={async () => { if(!currentUser) return; setIsLoading(true); const log: ChecklistLog = { id: currentLogId || Date.now().toString(), userId: currentUser.matricula, userName: currentUser.name, userRole: currentUser.role, line: currentLine, date: getManausDate().toISOString(), itemsCount: items.length, ngCount: Object.values(checklistData).filter(v=>v==='NG').length, observation, data: checklistData, evidenceData: checklistEvidence, type: isMaintenanceMode ? 'MAINTENANCE' : 'PRODUCTION', maintenanceTarget: maintenanceTarget }; await saveLog(log); setIsLoading(false); setView('SUCCESS'); }} className="w-full md:w-auto shadow-xl shadow-blue-900/30 px-8 py-3"><Save size={18} /> Finalizar Relatório</Button></div>
            </Layout>
          );
      }

      // Reuse SUCCESS, PERSONAL, PROFILE, MEETING... views (Assuming they are rendered here if view state matches)
      if (view === 'SUCCESS') return <Layout variant="auth"><div className="flex flex-col items-center justify-center min-h-screen text-center"><div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)] animate-in zoom-in duration-300"><CheckCircle2 size={48} /></div><h2 className="text-3xl font-bold text-white mb-2">Salvo com Sucesso!</h2><p className="text-zinc-400 mb-8 max-w-md">Os dados foram registrados no sistema.</p><Button onClick={() => setView('MENU')} className="min-w-[200px]">Voltar ao Início</Button></div></Layout>;
      if (view === 'PERSONAL') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold text-white">Meus Registros</h1></header><div className="space-y-4">{personalLogs.length === 0 && <p className="text-zinc-500 text-center py-12 bg-zinc-900/50 rounded-xl border border-zinc-800">Nenhum registro encontrado.</p>}{personalLogs.map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${log.ngCount > 0 ? 'bg-red-900/20 text-red-500 border border-red-900/30' : 'bg-green-900/20 text-green-500 border border-green-900/30'}`}>{log.ngCount > 0 ? '!' : '✓'}</div><div><p className="font-bold text-zinc-200">{new Date(log.date).toLocaleString()}</p><p className="text-sm text-zinc-400">{log.line} <span className="mx-2">•</span> {log.ngCount > 0 ? `${log.ngCount} Falhas` : '100% OK'} {log.type === 'LINE_STOP' && '(Parada)'}</p></div></div><div className="flex gap-2 w-full md:w-auto"><Button variant="secondary" onClick={() => setPreviewLog(log)} className="flex-1 md:flex-none"><Eye size={16}/></Button><Button variant="outline" onClick={() => exportLogToExcel(log, items)} className="flex-1 md:flex-none"><Download size={16}/> Excel</Button></div></div>))}</div>{renderPreviewModal()}</Layout>;
      if (view === 'PROFILE') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold text-white">Meu Perfil</h1></header><Card className="max-w-xl mx-auto"><div className="flex flex-col items-center mb-8"><div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-3xl font-bold mb-4 text-zinc-300 border-2 border-zinc-700 shadow-xl">{profileData?.name.charAt(0)}</div><p className="text-xl font-bold text-white">{profileData?.name}</p><p className="text-zinc-500 bg-zinc-950 px-3 py-1 rounded-full text-xs mt-2 border border-zinc-800">{profileData?.role}</p></div><div className="space-y-5"><Input label="Nome" value={profileData?.name} onChange={e => setProfileData({...profileData!, name: e.target.value})} /><Input label="Email" value={profileData?.email} onChange={e => setProfileData({...profileData!, email: e.target.value})} /><Input label="Alterar Senha" type="password" placeholder="Nova senha (opcional)" value={profileData?.password || ''} onChange={e => setProfileData({...profileData!, password: e.target.value})} /><div className="pt-4"><Button fullWidth onClick={handleSaveProfile}>Salvar Alterações</Button></div></div></Card></Layout>;
      if (view === 'MEETING_MENU') return <Layout sidebar={<SidebarContent />}><header className="mb-8"><h1 className="text-2xl font-bold mb-2 text-white">Atas de Reunião</h1><p className="text-zinc-400">Gerencie registros de reuniões operacionais.</p></header><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div onClick={() => setView('MEETING_FORM')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-emerald-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden"><div className="w-12 h-12 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Plus size={24} /></div><h3 className="font-bold text-xl text-zinc-100">Nova Ata</h3><p className="text-sm text-zinc-500 mt-2">Registrar reunião online com foto.</p></div><div onClick={() => setView('MEETING_HISTORY')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-blue-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden"><div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><History size={24} /></div><h3 className="font-bold text-xl text-zinc-100">Histórico</h3><p className="text-sm text-zinc-500 mt-2">Acessar e imprimir atas anteriores.</p></div></div></Layout>;
      if (view === 'MEETING_FORM') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100">Nova Ata de Reunião</h1><Button variant="outline" onClick={() => setView('MEETING_MENU')}>Cancelar</Button></header><div className="space-y-6 max-w-3xl mx-auto"><Card><Input label="Título da Reunião" placeholder="Ex: Alinhamento de Turno, Qualidade, etc." value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} icon={<FileText size={18}/>} /></Card><Card><h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Foto da Reunião (Obrigatório)</h3>{meetingPhoto ? (<div className="relative group"><img src={meetingPhoto} alt="Reunião" className="w-full h-64 object-cover rounded-lg border border-zinc-700" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"><Button variant="danger" onClick={() => setMeetingPhoto('')}><Trash2 size={16}/> Remover</Button></div></div>) : (<div className="h-64 bg-zinc-950 border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 transition-colors"><label className="cursor-pointer flex flex-col items-center p-8 w-full h-full justify-center"><Camera size={40} className="mb-4 text-zinc-600" /><span className="font-medium">Clique para tirar foto ou upload</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleMeetingPhoto(e.target.files[0]) }} /></label></div>)}</Card><Card><h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Participantes</h3><div className="flex gap-2 mb-4"><Input placeholder="Nome do participante" value={newParticipant} onChange={e => setNewParticipant(e.target.value)} className="bg-zinc-950" /><Button onClick={handleAddParticipant}><Plus size={18}/></Button></div><div className="flex flex-wrap gap-2">{meetingParticipants.map((p, idx) => (<div key={idx} className="bg-zinc-800 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">{p}<button onClick={() => handleRemoveParticipant(idx)} className="hover:text-red-400"><X size={14}/></button></div>))}</div></Card><Card><h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Assuntos Tratados</h3><textarea className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 h-40 focus:ring-2 focus:ring-blue-600/50 outline-none placeholder-zinc-600" placeholder="Descreva os tópicos discutidos..." value={meetingTopics} onChange={e => setMeetingTopics(e.target.value)} /></Card><Button fullWidth onClick={handleSaveMeeting} disabled={isLoading} className="py-3">{isLoading ? 'Salvando...' : 'Salvar Ata'}</Button></div></Layout>;
      if (view === 'MEETING_HISTORY') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100">Histórico de Atas</h1><Button variant="outline" onClick={() => setView('MEETING_MENU')}><ArrowLeft size={16} /> Voltar</Button></header><div className="space-y-4">{meetingHistory.map(m => (<div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors"><div><p className="font-bold text-white text-lg">{m.title || 'Sem Título'}</p><p className="font-medium text-zinc-400 text-sm flex items-center gap-2"><Calendar size={14}/> {new Date(m.date).toLocaleDateString()} • {m.startTime}</p><div className="flex gap-4 mt-2"><span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded">Criado por: {m.createdBy}</span><span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded">{m.participants.length} participantes</span></div></div><Button onClick={() => exportMeetingToExcel(m)} variant="secondary"><Download size={16}/> Excel</Button></div>))}</div></Layout>;
      if (view === 'MAINTENANCE_QR') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100">Ler QR Code Máquina</h1></header><div className="max-w-md mx-auto"><div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center"><div id="reader-hidden" className="hidden"></div><label className="cursor-pointer flex flex-col items-center justify-center h-48 w-full border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-xl transition-all mb-6 bg-zinc-950"><Camera size={48} className="mb-4 text-zinc-500" /><span className="text-lg font-bold text-zinc-300">Tirar Foto do QR Code</span><span className="text-sm text-zinc-500 mt-2">Clique aqui para abrir a câmera</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleMaintenanceQrPhoto(e.target.files[0]) }} /></label><div className="border-t border-zinc-800 pt-6 mt-6"><p className="text-xs font-bold text-zinc-500 mb-3 uppercase">Inserção Manual</p><div className="flex gap-2"><Input placeholder="Código (Ex: PRENSA_01)" value={qrCodeManual} onChange={e => setQrCodeManual(e.target.value)} /><Button onClick={() => handleMaintenanceCode(qrCodeManual)}>Ir</Button></div></div></div></div></Layout>;
      
      // Line Stop Dashboard Fallback if needed (was intercepted above usually but for safety)
      if (view === 'LINE_STOP_DASHBOARD') return <Layout sidebar={<SidebarContent />}><header className="flex flex-col gap-4 mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><AlertTriangle className="text-red-500" /> Parada de Linha</h1><div className="flex gap-2 overflow-x-auto pb-2"><Button variant={lineStopTab === 'NEW' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('NEW')}><Plus size={16}/> Novo Reporte</Button><Button variant={lineStopTab === 'PENDING' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('PENDING')}><Clock size={16}/> Pendentes</Button><Button variant={lineStopTab === 'UPLOAD' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('UPLOAD')}><Upload size={16}/> Upload Assinatura</Button><Button variant={lineStopTab === 'HISTORY' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('HISTORY')}><History size={16}/> Histórico</Button></div></header>{lineStopTab === 'NEW' && (<div className="space-y-6 max-w-4xl mx-auto pb-20"><Card><h3 className="text-lg font-bold mb-4 border-b border-zinc-800 pb-2">Dados da Parada</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><Input label="Modelo" value={lineStopData.model} onChange={e => setLineStopData({...lineStopData, model: e.target.value})} /><Input label="Cliente" value={lineStopData.client} onChange={e => setLineStopData({...lineStopData, client: e.target.value})} /><div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Linha</label><select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={lineStopData.line} onChange={e => setLineStopData({...lineStopData, line: e.target.value})}>{lines.map(l => <option key={l} value={l}>{l}</option>)}</select></div><Input label="Fase" value={lineStopData.phase} onChange={e => setLineStopData({...lineStopData, phase: e.target.value})} /></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4"><Input type="time" label="Início" value={lineStopData.startTime} onChange={e => setLineStopData({...lineStopData, startTime: e.target.value, totalTime: calcTotalTime(e.target.value, lineStopData.endTime)})} /><Input type="time" label="Término" value={lineStopData.endTime} onChange={e => setLineStopData({...lineStopData, endTime: e.target.value, totalTime: calcTotalTime(lineStopData.startTime, e.target.value)})} /><Input label="Total" readOnly value={lineStopData.totalTime} className="text-red-400 font-bold" /><Input label="Pessoas Paradas" type="number" value={lineStopData.peopleStopped} onChange={e => setLineStopData({...lineStopData, peopleStopped: e.target.value})} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Perca de Produção" value={lineStopData.productionLoss} onChange={e => setLineStopData({...lineStopData, productionLoss: e.target.value})} /><Input label="Tempo Padrão" value={lineStopData.standardTime} onChange={e => setLineStopData({...lineStopData, standardTime: e.target.value})} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"><Input label="Posto (De)" value={lineStopData.stationStart} onChange={e => setLineStopData({...lineStopData, stationStart: e.target.value})} /><Input label="Posto (Até)" value={lineStopData.stationEnd} onChange={e => setLineStopData({...lineStopData, stationEnd: e.target.value})} /></div></Card><Card><h3 className="text-lg font-bold mb-4 border-b border-zinc-800 pb-2">Motivo e Responsabilidade</h3><div className="mb-4"><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Setor Responsável</label><div className="grid grid-cols-2 md:grid-cols-5 gap-2">{SECTORS_LIST.map(sec => (<button key={sec} onClick={() => setLineStopData({...lineStopData, responsibleSector: sec})} className={`p-2 rounded text-xs font-bold border ${lineStopData.responsibleSector === sec ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>{sec}</button>))}</div></div><div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Motivo / Ocorrência Detalhada</label><textarea className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 h-32 text-white" value={lineStopData.motivo} onChange={e => setLineStopData({...lineStopData, motivo: e.target.value})} placeholder="Descreva o que aconteceu..." /></div></Card><Button fullWidth className="py-4 text-lg shadow-xl shadow-red-900/20 bg-red-600 hover:bg-red-500" onClick={handleSaveLineStop}>Salvar Reporte</Button></div>)} {lineStopTab === 'PENDING' && (<div className="space-y-4">{lineStopLogs.filter(l => l.status === 'WAITING_JUSTIFICATION').length === 0 && <p className="text-center text-zinc-500 py-10">Nenhum reporte pendente de justificativa.</p>}{lineStopLogs.filter(l => l.status === 'WAITING_JUSTIFICATION').map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden"><div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500"></div><div className="flex flex-col md:flex-row justify-between gap-4"><div><div className="flex items-center gap-2 mb-2"><span className="bg-red-900/30 text-red-400 px-2 py-1 rounded text-xs font-bold uppercase border border-red-900/50">Aguardando Justificativa</span><span className="text-zinc-500 text-xs">{new Date(log.date).toLocaleString()}</span></div><h3 className="text-xl font-bold text-white mb-1">{(log.data as LineStopData).model} - {log.line}</h3><p className="text-zinc-400 text-sm mb-4">Setor: <strong className="text-white">{(log.data as LineStopData).responsibleSector}</strong> | Tempo: <strong className="text-red-400">{(log.data as LineStopData).totalTime}</strong></p><p className="bg-zinc-950 p-3 rounded border border-zinc-800 text-zinc-300 text-sm">{(log.data as LineStopData).motivo}</p></div><div className="flex flex-col justify-center gap-2 min-w-[200px]"><Button onClick={() => { setActiveLineStopLog(log); setJustificationInput(''); }}>Justificar</Button></div></div>{activeLineStopLog?.id === log.id && (<div className="mt-6 pt-6 border-t border-zinc-800 animate-in slide-in-from-top-2"><label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Justificativa e Plano de Ação</label><textarea className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 h-32 text-white mb-4" value={justificationInput} onChange={e => setJustificationInput(e.target.value)} placeholder="Descreva a solução definitiva..." /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setActiveLineStopLog(null)}>Cancelar</Button><Button onClick={handleSaveJustification}>Salvar e Prosseguir</Button></div></div>)}</div>))}</div>)} {lineStopTab === 'UPLOAD' && (<div className="space-y-4">{lineStopLogs.filter(l => l.status === 'WAITING_SIGNATURE').length === 0 && <p className="text-center text-zinc-500 py-10">Nenhum reporte aguardando upload.</p>}{lineStopLogs.filter(l => l.status === 'WAITING_SIGNATURE').map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden"><div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div><div className="flex flex-col md:flex-row justify-between gap-4"><div><div className="flex items-center gap-2 mb-2"><span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase border border-blue-900/50">Aguardando Assinatura</span><span className="text-zinc-500 text-xs">{new Date(log.date).toLocaleString()}</span></div><h3 className="text-xl font-bold text-white mb-1">{(log.data as LineStopData).model} - {log.line}</h3><div className="mt-2 text-sm text-zinc-400"><p>1. Baixe a planilha gerada.</p><p>2. Imprima e colete as assinaturas.</p><p>3. Tire uma foto e faça o upload abaixo.</p></div></div><div className="flex flex-col justify-center gap-2 min-w-[200px]"><Button variant="outline" onClick={() => exportLineStopToExcel(log)}><Printer size={16}/> Baixar Planilha</Button><Button onClick={() => setActiveLineStopLog(log)}>Fazer Upload</Button></div></div>{activeLineStopLog?.id === log.id && (<div className="mt-6 pt-6 border-t border-zinc-800 animate-in slide-in-from-top-2"><label className="cursor-pointer flex flex-col items-center justify-center h-32 w-full border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-lg transition-colors"><Camera size={24} className="mb-2 text-zinc-500" /><span className="text-sm text-zinc-400">Clique para enviar foto da folha assinada</span><input type="file" accept="image/*" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleUploadSignedDoc(e.target.files[0]) }} /></label><Button variant="ghost" fullWidth className="mt-2" onClick={() => setActiveLineStopLog(null)}>Cancelar</Button></div>)}</div>))}</div>)} {lineStopTab === 'HISTORY' && (<div className="space-y-4">{lineStopLogs.filter(l => l.status === 'COMPLETED').length === 0 && <p className="text-center text-zinc-500 py-10">Histórico vazio.</p>}{lineStopLogs.filter(l => l.status === 'COMPLETED').map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-green-900/20 text-green-500 rounded-full flex items-center justify-center border border-green-900/30"><CheckCircle2 size={20}/></div><div><p className="font-bold text-zinc-200">{(log.data as LineStopData).model} • {log.line}</p><p className="text-sm text-zinc-400">{new Date(log.date).toLocaleDateString()} • {(log.data as LineStopData).totalTime} parado</p></div></div><div className="flex gap-2"><Button variant="secondary" onClick={() => setPreviewLog(log)}><Eye size={16}/></Button><Button variant="outline" onClick={() => exportLineStopToExcel(log)}><Download size={16}/></Button></div></div>))}</div>)}</Layout>;
  }

  return null;
};

export default App;