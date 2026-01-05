
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
    getTodayLogForUser, saveLineStop, getLineStops,
    getModels, saveModels, getStations, saveStations
} from './services/storageService';
import { saveServerUrl, getServerUrl, clearServerUrl, isServerConfigured } from './services/networkConfig';
import { 
  CheckSquare, LogOut, UserPlus, LogIn, CheckCircle2, AlertCircle, 
  Save, ArrowLeft, History, Edit3, Trash2, Plus, Image as ImageIcon, 
  Settings, Users, List, Search, Calendar, Eye, Download, Wifi, User as UserIcon, Upload, X, UserCheck,
  Camera, FileText, QrCode, Hammer, AlertTriangle, Shield, LayoutDashboard, ChevronRight, Clock, Printer, EyeOff, Briefcase, Box, Lock
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

type ViewState = 'SETUP' | 'LOGIN' | 'REGISTER' | 'RECOVER' | 'MENU' | 'CHECKLIST_MENU' | 'AUDIT_MENU' | 'DASHBOARD' | 'ADMIN' | 'SUCCESS' | 'PERSONAL' | 'PROFILE' | 'MEETING_MENU' | 'MEETING_FORM' | 'MEETING_HISTORY' | 'MAINTENANCE_QR' | 'LINE_STOP_DASHBOARD' | 'MANAGEMENT';

interface LineStatus {
    status: 'OK' | 'NG' | 'PENDING';
    leaderName?: string;
    logIds: string[];
    details?: string; 
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
    ADMIN: 'Administração',
    MANAGEMENT: 'Gestão'
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

  // Recover Password State
  const [recoverMatricula, setRecoverMatricula] = useState('');
  const [recoverEmail, setRecoverEmail] = useState('');
  
  // Configs
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [stations, setStations] = useState<string[]>([]);
  
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
  const [maintenanceLine, setMaintenanceLine] = useState(''); 

  // Meeting States
  const [meetingParticipants, setMeetingParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [meetingTopics, setMeetingTopics] = useState('');
  const [meetingPhoto, setMeetingPhoto] = useState('');
  const [meetingTitle, setMeetingTitle] = useState(''); 
  const [meetingStartTime, setMeetingStartTime] = useState('');
  const [meetingEndTime, setMeetingEndTime] = useState('');
  const [meetingHistory, setMeetingHistory] = useState<MeetingLog[]>([]);
  const [previewMeeting, setPreviewMeeting] = useState<MeetingLog | null>(null);

  // Admin / Audit / Management
  const [adminTab, setAdminTab] = useState<'USERS' | 'PERMISSIONS'>('USERS');
  const [managementTab, setManagementTab] = useState<'LINES' | 'ROLES' | 'MODELS' | 'STATIONS'>('LINES');
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
  
  // Generic Management Input
  const [newItemName, setNewItemName] = useState('');

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
  const hasPermission = (module: 'CHECKLIST' | 'MEETING' | 'MAINTENANCE' | 'AUDIT' | 'ADMIN' | 'LINE_STOP' | 'MANAGEMENT') => {
      if(!currentUser) return false;
      if(isSuperAdmin) return true; 
      
      const perm = permissions.find(p => p.role === currentUser.role && p.module === module);
      if(perm) return perm.allowed;
      
      // Defaults
      if(module === 'CHECKLIST') return true; 
      if(module === 'MEETING') return true; 
      if(module === 'MAINTENANCE') return true; 
      if(module === 'LINE_STOP') return true; 
      if(module === 'AUDIT' || module === 'ADMIN' || module === 'MANAGEMENT') return false; 
      
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
        
        const loadModels = await getModels();
        setModels(loadModels);

        const loadStations = await getStations();
        setStations(loadStations);

        const perms = await getPermissions();
        setPermissions(perms);

        // Pre-load Users for Meeting suggestions
        const users = await getAllUsers();
        setUsersList(users);

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

  // Reload Models/Stations when entering Line Stop or Management
  useEffect(() => {
      const loadConfigs = async () => {
          if (view === 'LINE_STOP_DASHBOARD' || view === 'MANAGEMENT') {
              const m = await getModels();
              setModels(m);
              const s = await getStations();
              setStations(s);
              const l = await getLines();
              setLines(l);
              const r = await getRoles();
              setAvailableRoles(r);
          }
      };
      loadConfigs();
  }, [view]);

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

  // Handle CHECKLIST_MENU showing prompt
  useEffect(() => {
      if (view === 'CHECKLIST_MENU') {
          setIsMaintenanceMode(false);
          setShowLinePrompt(true);
          if (!currentLine && lines.length > 0) setCurrentLine(lines[0]);
      }
  }, [view, lines]);

  // FIX: Load Meetings when entering history
  useEffect(() => {
      if (view === 'MEETING_HISTORY') {
          const loadMeetings = async () => {
              setIsLoading(true);
              const m = await getMeetings();
              setMeetingHistory(m);
              setIsLoading(false);
          };
          loadMeetings();
      }
  }, [view]);

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

  // ALERTS & DASHBOARD LOGIC (Menu View) - REGRAS INTELIGENTES
  useEffect(() => {
      if (view === 'MENU' && currentUser) {
          const loadAlerts = async () => {
              // 1. Line Stops Waiting
              const stops = await getLineStops();
              const pendingStops = stops.filter(l => l.status === 'WAITING_JUSTIFICATION');
              
              // Smart Filter Logic
              const leadershipRoles = ['SUPERVISOR', 'COORDENADOR', 'DIRETOR', 'ADMIN', 'GERENTE'];
              const isLeader = leadershipRoles.some(role => currentUser.role.toUpperCase().includes(role));
              
              const filteredPending = pendingStops.filter(stop => {
                  if (isLeader) return true; // Liderança vê tudo
                  const stopData = stop.data as LineStopData;
                  if (stopData.responsibleSector && currentUser.role.toUpperCase().includes(stopData.responsibleSector.toUpperCase())) {
                      return true; // Setor responsável vê suas paradas
                  }
                  return false;
              });

              setPendingLineStopsCount(filteredPending.length);

              // 2. Missing Checklists (Delayed) - Only shows if allowed
              if (hasPermission('AUDIT') || isSuperAdmin) {
                  const allUsers = await getAllUsers();
                  const allLogs = await getLogs();
                  const now = getManausDate();
                  const todayStr = now.toISOString().split('T')[0];
                  
                  const leaders = allUsers.filter(u => 
                     u.role.toLowerCase().includes('lider') || 
                     u.role.toLowerCase().includes('líder') ||
                     u.role.toLowerCase().includes('supervisor')
                  );

                  const missing = leaders.filter(leader => {
                       const hasLog = allLogs.some(l => l.userId === leader.matricula && l.date.startsWith(todayStr) && l.type !== 'MAINTENANCE' && l.type !== 'LINE_STOP');
                       return !hasLog;
                   }).map(l => l.name);

                   setMissingLeadersNames(missing);
              }
          };
          loadAlerts();
      }
  }, [view, currentUser]);

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

  const handleRecover = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!recoverMatricula || !recoverEmail) return alert("Preencha todos os campos.");
      setIsLoading(true);
      const res = await recoverPassword(recoverEmail, recoverMatricula);
      setIsLoading(false);
      alert(res.message);
      if(res.success) setView('LOGIN');
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
      // NOTE: We don't change view here, we expect current view to handle prompt or switch
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
  
  // NEW: QR Code Robust Implementation (File Upload Scan)
  const handleMaintenanceQrPhoto = async (file: File) => {
      if (!file) return;
      
      const html5QrCode = new Html5Qrcode("reader-hidden");
      try {
          setIsLoading(true);
          // Try scanFileV2 if available (latest lib), else scanFile
          let decodedText;
          try {
              decodedText = await html5QrCode.scanFileV2(file, true);
          } catch(e) {
              decodedText = await html5QrCode.scanFile(file, true);
          }
          
          handleMaintenanceCode(decodedText);
      } catch (err) {
          alert("QR Code ilegível. Tente limpar a lente, melhorar a iluminação ou use o código manual.");
          console.error(err);
      } finally {
          setIsLoading(false);
          // Clear file input manually if needed via ref, but React key reset or replacing element handles it mostly
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

      if (log) {
          // Bug Fix: Line Stop uses signedDocUrl directly, mapping to evidenceData format for reuse
          if (log.type === 'LINE_STOP' && (log.signedDocUrl || (log.data as any)?.signedDocUrl)) {
              const url = log.signedDocUrl || (log.data as any)?.signedDocUrl;
              setPreviewLog({
                  ...log,
                  evidenceData: { 'signed_doc': { comment: 'Assinatura', photo: url } }
              });
          } else {
              setPreviewLog(log);
          }
      }
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
      if (!currentUser || meetingParticipants.length === 0 || !meetingTopics || !meetingTitle || !meetingStartTime || !meetingEndTime) {
          return alert("Preencha todos os campos obrigatórios (Título, Horários, Participantes e Assuntos).");
      }
      setIsLoading(true);
      try {
        const now = getManausDate();
        const newMeeting: MeetingLog = {
            id: Date.now().toString(),
            title: meetingTitle,
            date: now.toISOString(),
            startTime: meetingStartTime,
            endTime: meetingEndTime,
            participants: meetingParticipants,
            topics: meetingTopics,
            photoUrl: meetingPhoto,
            createdBy: currentUser.name
        };
        await saveMeeting(newMeeting);
        
        // Refresh
        const updatedHistory = await getMeetings();
        setMeetingHistory(updatedHistory);
        
        alert("Ata salva com sucesso!");
        setMeetingParticipants([]); setMeetingTopics(''); setMeetingPhoto(''); setMeetingTitle(''); setMeetingStartTime(''); setMeetingEndTime('');
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
          
          // FORÇA REFRESH DE DADOS DO SERVIDOR
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
          alert(`Erro ao salvar: ${e.message || "Verifique os campos ou conexão."}`);
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

  // --- MANAGEMENT HANDLERS (Generic) ---
  const handleAddItem = async (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, saveFn: (l: string[]) => Promise<void>) => {
      if (newItemName && !list.includes(newItemName)) {
          setIsLoading(true);
          try {
              const newList = [...list, newItemName];
              setList(newList);
              await saveFn(newList);
              setNewItemName('');
          } catch(e) { alert("Erro ao salvar."); } finally { setIsLoading(false); }
      }
  }

  const handleDeleteItem = async (item: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, saveFn: (l: string[]) => Promise<void>) => {
      if(confirm(`Excluir ${item}?`)) {
          setIsLoading(true);
          try {
              const newList = list.filter(x => x !== item);
              setList(newList);
              await saveFn(newList);
          } catch(e) { alert("Erro ao excluir."); } finally { setIsLoading(false); }
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

  const handleTogglePermission = (role: string, module: 'CHECKLIST' | 'MEETING' | 'MAINTENANCE' | 'AUDIT' | 'ADMIN' | 'LINE_STOP' | 'MANAGEMENT') => {
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
      const signedUrl = previewLog.signedDocUrl || (previewLog.data as any)?.signedDocUrl;
      const evidencePhoto = previewLog.evidenceData?.['signed_doc']?.photo || signedUrl; // Fallback mapping

      return (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <Card className="w-[95%] md:w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800">
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
                           {evidencePhoto && (
                               <div className="mt-4">
                                   <span className="block text-zinc-500 text-xs font-bold uppercase mb-2">Documento Assinado / Evidência</span>
                                   <img src={evidencePhoto} className="max-w-full rounded border border-zinc-700" />
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
  
  // NEW: Render Meeting Preview Modal
  const renderMeetingPreviewModal = () => {
      if (!previewMeeting) return null;
      return (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <Card className="w-[95%] md:w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-900 border border-zinc-800">
                   <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                      <div>
                          <h3 className="text-xl font-bold text-white">Visualizar Ata</h3>
                          <p className="text-zinc-400 text-sm">{new Date(previewMeeting.date).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => setPreviewMeeting(null)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors"><X size={24} /></button>
                  </div>
                  <div className="space-y-6">
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                          <h4 className="text-blue-400 font-bold text-lg mb-1">{previewMeeting.title}</h4>
                          <p className="text-sm text-zinc-400">Horário: {previewMeeting.startTime} - {previewMeeting.endTime}</p>
                          <p className="text-xs text-zinc-500 mt-2">Registrado por: {previewMeeting.createdBy}</p>
                      </div>
                      
                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                           <h5 className="font-bold text-zinc-300 mb-2 uppercase text-xs">Participantes</h5>
                           <div className="flex flex-wrap gap-2">
                               {previewMeeting.participants.map((p, idx) => (
                                   <span key={idx} className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs border border-zinc-700">{p}</span>
                               ))}
                           </div>
                      </div>

                      <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                           <h5 className="font-bold text-zinc-300 mb-2 uppercase text-xs">Assuntos Tratados</h5>
                           <p className="text-zinc-300 text-sm whitespace-pre-wrap">{previewMeeting.topics}</p>
                      </div>

                      {previewMeeting.photoUrl && (
                          <div>
                               <h5 className="font-bold text-zinc-300 mb-2 uppercase text-xs">Foto da Reunião</h5>
                               <img src={previewMeeting.photoUrl} className="w-full rounded-lg border border-zinc-700" alt="Reunião" />
                          </div>
                      )}
                      
                      <div className="flex justify-end pt-2">
                           <Button onClick={() => exportMeetingToExcel(previewMeeting!)}><Download size={16}/> Baixar Excel</Button>
                      </div>
                  </div>
              </Card>
          </div>
      )
  }

  // --- Components for Sidebar ---
  
  const SidebarContent = () => {
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
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/20 overflow-hidden">
                         <img src="/logo.png" className="w-full h-full object-cover" alt="LC" />
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

                {(hasPermission('AUDIT') || hasPermission('ADMIN') || hasPermission('MANAGEMENT')) && (
                    <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest mt-6 mb-2 px-4">Gestão</div>
                )}
                
                {hasPermission('AUDIT') && (
                     <button onClick={() => { setView('AUDIT_MENU'); setAuditTab('LEADER_HISTORY'); }} className={navItemClass(view === 'AUDIT_MENU')}>
                        <Search size={18} /> Auditoria
                    </button>
                )}

                {hasPermission('MANAGEMENT') && (
                     <button onClick={() => setView('MANAGEMENT')} className={navItemClass(view === 'MANAGEMENT')}>
                        <Briefcase size={18} /> Gestão
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
                  {pendingLineStopsCount > 0 && (
                      <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl flex items-center gap-4 animate-pulse">
                          <div className="p-2 bg-red-500 rounded-full text-white"><AlertTriangle size={20} /></div>
                          <div className="flex-1">
                              <h3 className="font-bold text-red-400">Paradas sem Justificativa</h3>
                              <p className="text-xs text-red-300">Existem {pendingLineStopsCount} paradas de linha que requerem sua atenção.</p>
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
                      <div onClick={() => { setView('AUDIT_MENU'); setAuditTab('LEADER_HISTORY'); }} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-yellow-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-yellow-600/20 text-yellow-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Search size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Auditoria</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Gestão e Relatórios</p>
                              </div>
                          </div>
                      </div>
                  )}

                  {hasPermission('MANAGEMENT') && (
                      <div onClick={() => setView('MANAGEMENT')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-cyan-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden h-40 flex flex-col justify-center">
                          <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-cyan-600/20 text-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Briefcase size={24} /></div>
                              <div>
                                  <h3 className="font-bold text-xl text-zinc-100">Gestão</h3>
                                  <p className="text-xs text-zinc-500 mt-1">Cadastros Gerais</p>
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
  
  // --- AUDIT MENU (Unified with Editor) ---
  if (view === 'AUDIT_MENU') {
      if (auditTab === 'MAINTENANCE_EDITOR' || auditTab === 'LEADER_EDITOR') {
        const isMaint = auditTab === 'MAINTENANCE_EDITOR';
        const targetList = isMaint ? maintenanceItems : leaderItems;
        const setTargetList = isMaint ? setMaintenanceItems : setLeaderItems;
        const filteredList = isMaint ? targetList.filter(item => item.category.startsWith(maintenanceLine)) : targetList;

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
                                    {/* Evidencia removida conforme solicitado */}
                                    <div className="flex-1">
                                        {item.imageUrl ? (
                                            <div className="flex items-center gap-2">
                                                <img src={item.imageUrl} className="h-10 w-10 object-cover rounded border border-zinc-700"/>
                                                <button onClick={() => handleEditorRemoveImage(targetList, setTargetList, item.id)} className="text-red-500 text-xs hover:underline">Remover Imagem Ref.</button>
                                            </div>
                                        ) : (
                                            <label className="cursor-pointer text-xs bg-zinc-800 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-700 border border-zinc-700 block text-center">
                                                + Imagem Referência
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
      } else {
        return (
            <Layout sidebar={<SidebarContent />}>
                <header className="flex flex-col gap-4 mb-8 pb-6 border-b border-zinc-800">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Search className="text-yellow-500" /> Auditoria e Relatórios</h1>
                        <Button variant="outline" onClick={() => setView('MENU')}><ArrowLeft size={16}/> Voltar</Button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <Button variant={auditTab === 'LEADER_HISTORY' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LEADER_HISTORY')}>Histórico Líder</Button>
                        <Button variant={auditTab === 'MAINTENANCE_HISTORY' ? 'primary' : 'secondary'} onClick={() => setAuditTab('MAINTENANCE_HISTORY')}>Histórico Manutenção</Button>
                        <div className="w-px bg-zinc-800 mx-2"></div>
                        <Button variant={auditTab === 'LEADERS' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LEADERS')}>Matriz Líderes</Button>
                        <Button variant={auditTab === 'LINES' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LINES')}>Matriz Linhas</Button>
                        <Button variant={auditTab === 'MAINTENANCE_MATRIX' ? 'primary' : 'secondary'} onClick={() => setAuditTab('MAINTENANCE_MATRIX')}>Matriz Manutenção</Button>
                        <div className="w-px bg-zinc-800 mx-2"></div>
                        <Button variant={auditTab === 'LEADER_EDITOR' ? 'primary' : 'secondary'} onClick={() => setAuditTab('LEADER_EDITOR')}><Edit3 size={14}/> Editor Checklist</Button>
                        <Button variant={auditTab === 'MAINTENANCE_EDITOR' ? 'primary' : 'secondary'} onClick={() => setAuditTab('MAINTENANCE_EDITOR')}><Edit3 size={14}/> Editor Manutenção</Button>
                    </div>
                </header>

                {/* FILTERS */}
                {(auditTab === 'LEADER_HISTORY' || auditTab === 'MAINTENANCE_HISTORY') && (
                    <Card className="mb-6">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1 min-w-[200px]"><Input type="date" label="Filtrar Data" value={historyDateFilter} onChange={e => setHistoryDateFilter(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} /></div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Filtrar Turno</label>
                                <select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={historyShiftFilter} onChange={e => setHistoryShiftFilter(e.target.value)}><option value="ALL">Todos</option><option value="1">1º Turno</option><option value="2">2º Turno</option></select>
                            </div>
                            <Button variant="secondary" onClick={() => { setHistoryDateFilter(''); setHistoryShiftFilter('ALL'); }}>Limpar</Button>
                        </div>
                    </Card>
                )}

                {(auditTab === 'LEADERS' || auditTab === 'LINES' || auditTab === 'MAINTENANCE_MATRIX') && (
                    <Card className="mb-6">
                        <div className="flex flex-wrap gap-4 items-end">
                             <div className="flex-1 min-w-[200px]"><Input type="week" label="Semana" value={linesWeekFilter} onChange={e => setLinesWeekFilter(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} /></div>
                             <div className="flex-1 min-w-[200px]">
                                <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Turno</label>
                                <select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={linesShiftFilter} onChange={e => setLinesShiftFilter(e.target.value)}><option value="ALL">Todos</option><option value="1">1º Turno</option><option value="2">2º Turno</option></select>
                            </div>
                        </div>
                    </Card>
                )}

                {/* CONTENT */}
                {(auditTab === 'LEADER_HISTORY' || auditTab === 'MAINTENANCE_HISTORY') && (
                    <div className="space-y-4">
                        {historyLogs.map(log => (
                            <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${log.ngCount > 0 ? 'bg-red-900/20 text-red-500 border border-red-900/30' : 'bg-green-900/20 text-green-500 border border-green-900/30'}`}>{log.ngCount > 0 ? '!' : '✓'}</div>
                                    <div>
                                        <p className="font-bold text-zinc-200">{log.line} {log.maintenanceTarget ? `- ${log.maintenanceTarget}` : ''} <span className="text-zinc-500 text-sm font-normal">• {log.userName}</span></p>
                                        <p className="text-sm text-zinc-400">{new Date(log.date).toLocaleString()} • {log.ngCount > 0 ? `${log.ngCount} Falhas` : '100% OK'}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" onClick={() => setPreviewLog(log)}><Eye size={16}/></Button>
                                    <Button variant="outline" onClick={() => exportLogToExcel(log, auditTab === 'MAINTENANCE_HISTORY' ? maintenanceItems : leaderItems)}><Download size={16}/> Excel</Button>
                                </div>
                            </div>
                        ))}
                        {historyLogs.length === 0 && <p className="text-center text-zinc-500 py-10">Nenhum registro encontrado.</p>}
                    </div>
                )}
                
                {/* MATRIX VIEWS */}
                {(auditTab === 'LINES' || auditTab === 'MAINTENANCE_MATRIX') && (
                     <div className="overflow-x-auto pb-4">
                        <table className="w-full min-w-[600px] text-sm border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                                    <th className="p-3 text-left min-w-[150px]">Linha</th>
                                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => <th key={d} className="p-3 text-center">{d}</th>)}
                                    {linesShiftFilter !== 'ALL' && <th className="p-3 text-center">Ações</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {(auditTab === 'LINES' ? linesMatrix : maintenanceMatrix).map((row) => (
                                    <tr key={row.line} className="hover:bg-zinc-900/50">
                                        <td className="p-3 font-bold text-white">{row.line}</td>
                                        {row.statuses.map((st, idx) => (
                                            <td key={idx} className="p-3 text-center">
                                                <div 
                                                    onClick={() => st.logIds && st.logIds.length > 0 && handleOpenPreview(st.logIds[0])}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-bold border cursor-pointer hover:scale-110 transition-transform ${st.status === 'OK' ? 'bg-green-900/20 text-green-500 border-green-900/50' : st.status === 'NG' ? 'bg-red-900/20 text-red-500 border-red-900/50' : 'bg-zinc-800 text-zinc-600 border-zinc-700'}`} 
                                                    title={st.leaderName || st.details || 'Pendente'}
                                                >
                                                    {st.status === 'OK' ? 'OK' : st.status === 'NG' ? 'NG' : '-'}
                                                </div>
                                            </td>
                                        ))}
                                        {linesShiftFilter !== 'ALL' && (
                                            <td className="p-3 text-center">
                                                <Button size="sm" variant="outline" onClick={() => handleDownloadSheet(row.line)}><Download size={14}/></Button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                )}
                
                {auditTab === 'LEADERS' && (
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full min-w-[600px] text-sm border-collapse">
                            <thead>
                                <tr className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                                    <th className="p-3 text-left min-w-[200px]">Líder / Supervisor</th>
                                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(d => <th key={d} className="p-3 text-center">{d}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {leadersMatrix.map((row) => (
                                    <tr key={row.user.matricula} className="hover:bg-zinc-900/50">
                                        <td className="p-3">
                                            <p className="font-bold text-white">{row.user.name}</p>
                                            <p className="text-xs text-zinc-500">{row.user.role} • T{row.user.shift}</p>
                                        </td>
                                        {row.statuses.map((st, idx) => (
                                            <td key={idx} className="p-3 text-center">
                                                <div 
                                                    onClick={() => st.logId && handleOpenPreview(st.logId)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-bold border cursor-pointer hover:scale-110 transition-transform ${st.status === 'OK' ? 'bg-green-900/20 text-green-500 border-green-900/50' : st.status === 'NG' ? 'bg-red-900/20 text-red-500 border-red-900/50' : 'bg-zinc-800 text-zinc-600 border-zinc-700'}`}
                                                >
                                                    {st.status === 'OK' ? '✓' : st.status === 'NG' ? 'X' : '-'}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {renderPreviewModal()}
            </Layout>
        );
      }
  }

  // --- ADMIN VIEW ---
  if (view === 'ADMIN') {
      return (
        <Layout sidebar={<SidebarContent />}>
            <header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
                <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Shield className="text-zinc-400" /> Painel Administrativo</h1>
            </header>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <Button variant={adminTab === 'USERS' ? 'primary' : 'secondary'} onClick={() => setAdminTab('USERS')}><Users size={16}/> Usuários</Button>
                <Button variant={adminTab === 'PERMISSIONS' ? 'primary' : 'secondary'} onClick={() => setAdminTab('PERMISSIONS')}><Shield size={16}/> Permissões</Button>
            </div>

            {adminTab === 'PERMISSIONS' && (
                <Card className="overflow-x-auto">
                    <h3 className="text-lg font-bold mb-4">Permissões de Acesso (Matriz Invertida)</h3>
                    <table className="w-full text-sm text-center border-collapse">
                        <thead>
                            <tr className="bg-zinc-950 text-zinc-400">
                                <th className="p-3 text-left">Cargo</th>
                                {['CHECKLIST', 'LINE_STOP', 'MEETING', 'MAINTENANCE', 'AUDIT', 'ADMIN', 'MANAGEMENT'].map(mod => (
                                    <th key={mod} className="p-3 min-w-[100px] text-xs uppercase">{MODULE_NAMES[mod] || mod}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {availableRoles.map(role => (
                                <tr key={role} className="hover:bg-zinc-900">
                                    <td className="p-3 text-left font-bold text-white">{role}</td>
                                    {['CHECKLIST', 'LINE_STOP', 'MEETING', 'MAINTENANCE', 'AUDIT', 'ADMIN', 'MANAGEMENT'].map((module: any) => {
                                        const perm = permissions.find(p => p.role === role && p.module === module);
                                        const isAllowed = perm ? perm.allowed : (['CHECKLIST','MEETING','MAINTENANCE','LINE_STOP'].includes(module));
                                        return (
                                            <td key={module} className="p-3">
                                                <input type="checkbox" checked={isAllowed} onChange={() => handleTogglePermission(role, module)} className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-600/50" />
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

  // --- MANAGEMENT MODULE (NEW) ---
  if (view === 'MANAGEMENT') {
      const renderList = (title: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, saveFn: (l: string[]) => Promise<void>) => (
          <Card>
              <h3 className="text-lg font-bold mb-4">{title}</h3>
              <div className="flex gap-2 mb-6"><Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={`Novo ${title}`} /><Button onClick={() => handleAddItem(list, setList, saveFn)}>Add</Button></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{list.map(l => <div key={l} className="bg-zinc-950 p-3 rounded flex justify-between items-center border border-zinc-800 text-sm">{l}<button onClick={() => handleDeleteItem(l, list, setList, saveFn)} className="text-red-500 hover:bg-red-900/20 p-1 rounded"><X size={14}/></button></div>)}</div>
          </Card>
      );

      return (
          <Layout sidebar={<SidebarContent />}>
              <header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
                  <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><Briefcase className="text-cyan-500" /> Gestão Centralizada</h1>
              </header>
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                  <Button variant={managementTab === 'LINES' ? 'primary' : 'secondary'} onClick={() => setManagementTab('LINES')}><List size={16}/> Linhas</Button>
                  <Button variant={managementTab === 'ROLES' ? 'primary' : 'secondary'} onClick={() => setManagementTab('ROLES')}><UserCheck size={16}/> Cargos</Button>
                  <Button variant={managementTab === 'MODELS' ? 'primary' : 'secondary'} onClick={() => setManagementTab('MODELS')}><Box size={16}/> Modelos</Button>
                  <Button variant={managementTab === 'STATIONS' ? 'primary' : 'secondary'} onClick={() => setManagementTab('STATIONS')}><Hammer size={16}/> Postos</Button>
              </div>
              {managementTab === 'LINES' && renderList('Linhas de Produção', lines, setLines, saveLines)}
              {managementTab === 'ROLES' && renderList('Cargos e Funções', availableRoles, setAvailableRoles, saveRoles)}
              {managementTab === 'MODELS' && renderList('Modelos de Produto', models, setModels, saveModels)}
              {managementTab === 'STATIONS' && renderList('Postos de Trabalho', stations, setStations, saveStations)}
          </Layout>
      );
  }

  // --- LINE STOP DASHBOARD (Updated with dropdowns) ---
  if (view === 'LINE_STOP_DASHBOARD') return <Layout sidebar={<SidebarContent />}><header className="flex flex-col gap-4 mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2"><AlertTriangle className="text-red-500" /> Parada de Linha</h1><div className="flex gap-2 overflow-x-auto pb-2"><Button variant={lineStopTab === 'NEW' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('NEW')}><Plus size={16}/> Novo Reporte</Button><Button variant={lineStopTab === 'PENDING' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('PENDING')}><Clock size={16}/> Pendentes</Button><Button variant={lineStopTab === 'UPLOAD' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('UPLOAD')}><Upload size={16}/> Upload Assinatura</Button><Button variant={lineStopTab === 'HISTORY' ? 'primary' : 'secondary'} onClick={() => setLineStopTab('HISTORY')}><History size={16}/> Histórico</Button></div></header>{lineStopTab === 'NEW' && (<div className="space-y-6 max-w-4xl mx-auto pb-20"><Card><h3 className="text-lg font-bold mb-4 border-b border-zinc-800 pb-2">Dados da Parada</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
          <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Modelo</label>
          <input list="model-list" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={lineStopData.model} onChange={e => setLineStopData({...lineStopData, model: e.target.value})} placeholder="Selecione ou digite..." />
          <datalist id="model-list">{models.map(m => <option key={m} value={m} />)}</datalist>
      </div>
      <Input label="Cliente" value={lineStopData.client} onChange={e => setLineStopData({...lineStopData, client: e.target.value})} /><div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Linha</label><select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={lineStopData.line} onChange={e => setLineStopData({...lineStopData, line: e.target.value})}>{lines.map(l => <option key={l} value={l}>{l}</option>)}</select></div><Input label="Fase" value={lineStopData.phase} onChange={e => setLineStopData({...lineStopData, phase: e.target.value})} /></div><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4"><Input type="time" label="Início" value={lineStopData.startTime} onChange={e => setLineStopData({...lineStopData, startTime: e.target.value, totalTime: calcTotalTime(e.target.value, lineStopData.endTime)})} onClick={(e) => e.currentTarget.showPicker()} /><Input type="time" label="Término" value={lineStopData.endTime} onChange={e => setLineStopData({...lineStopData, endTime: e.target.value, totalTime: calcTotalTime(lineStopData.startTime, e.target.value)})} onClick={(e) => e.currentTarget.showPicker()} /><Input label="Total" readOnly value={lineStopData.totalTime} className="text-red-400 font-bold" /><Input label="Pessoas Paradas" type="number" value={lineStopData.peopleStopped} onChange={e => setLineStopData({...lineStopData, peopleStopped: e.target.value})} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Perca de Produção" value={lineStopData.productionLoss} onChange={e => setLineStopData({...lineStopData, productionLoss: e.target.value})} /><Input label="Tempo Padrão" value={lineStopData.standardTime} onChange={e => setLineStopData({...lineStopData, standardTime: e.target.value})} /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div>
          <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Posto (De)</label>
          <input list="station-list" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={lineStopData.stationStart} onChange={e => setLineStopData({...lineStopData, stationStart: e.target.value})} placeholder="Selecione ou digite..." />
          <datalist id="station-list">{stations.map(s => <option key={s} value={s} />)}</datalist>
      </div>
      <div>
          <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Posto (Até)</label>
          <input list="station-list" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-white" value={lineStopData.stationEnd} onChange={e => setLineStopData({...lineStopData, stationEnd: e.target.value})} placeholder="Selecione ou digite..." />
      </div></div></Card><Card><h3 className="text-lg font-bold mb-4 border-b border-zinc-800 pb-2">Motivo e Responsabilidade</h3><div className="mb-4"><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Setor Responsável</label><div className="grid grid-cols-2 md:grid-cols-5 gap-2">{SECTORS_LIST.map(sec => (<button key={sec} onClick={() => setLineStopData({...lineStopData, responsibleSector: sec})} className={`p-2 rounded text-xs font-bold border ${lineStopData.responsibleSector === sec ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}`}>{sec}</button>))}</div></div><div><label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Motivo / Ocorrência Detalhada</label><textarea className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 h-32 text-white" value={lineStopData.motivo} onChange={e => setLineStopData({...lineStopData, motivo: e.target.value})} placeholder="Descreva o que aconteceu..." /></div></Card><Button fullWidth className="py-4 text-lg shadow-xl shadow-red-900/20 bg-red-600 hover:bg-red-500" onClick={handleSaveLineStop}>Salvar Reporte</Button></div>)} {lineStopTab === 'PENDING' && (<div className="space-y-4">{lineStopLogs.filter(l => l.status === 'WAITING_JUSTIFICATION').length === 0 && <p className="text-center text-zinc-500 py-10">Nenhum reporte pendente de justificativa.</p>}{lineStopLogs.filter(l => l.status === 'WAITING_JUSTIFICATION').map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden"><div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500"></div><div className="flex flex-col md:flex-row justify-between gap-4"><div><div className="flex items-center gap-2 mb-2"><span className="bg-red-900/30 text-red-400 px-2 py-1 rounded text-xs font-bold uppercase border border-red-900/50">Aguardando Justificativa</span><span className="text-zinc-500 text-xs">{new Date(log.date).toLocaleString()}</span></div><h3 className="text-xl font-bold text-white mb-1">{(log.data as LineStopData).model} - {log.line}</h3><p className="text-zinc-400 text-sm mb-4">Setor: <strong className="text-white">{(log.data as LineStopData).responsibleSector}</strong> | Tempo: <strong className="text-red-400">{(log.data as LineStopData).totalTime}</strong></p><p className="bg-zinc-950 p-3 rounded border border-zinc-800 text-zinc-300 text-sm">{(log.data as LineStopData).motivo}</p></div><div className="flex flex-col justify-center gap-2 min-w-[200px]"><Button onClick={() => { setActiveLineStopLog(log); setJustificationInput(''); }}>Justificar</Button></div></div>{activeLineStopLog?.id === log.id && (<div className="mt-6 pt-6 border-t border-zinc-800 animate-in slide-in-from-top-2"><label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Justificativa e Plano de Ação</label><textarea className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 h-32 text-white mb-4" value={justificationInput} onChange={e => setJustificationInput(e.target.value)} placeholder="Descreva a solução definitiva..." /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setActiveLineStopLog(null)}>Cancelar</Button><Button onClick={handleSaveJustification}>Salvar e Prosseguir</Button></div></div>)}</div>))}</div>)} {lineStopTab === 'UPLOAD' && (<div className="space-y-4">{lineStopLogs.filter(l => l.status === 'WAITING_SIGNATURE').length === 0 && <p className="text-center text-zinc-500 py-10">Nenhum reporte aguardando upload.</p>}{lineStopLogs.filter(l => l.status === 'WAITING_SIGNATURE').map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden"><div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div><div className="flex flex-col md:flex-row justify-between gap-4"><div><div className="flex items-center gap-2 mb-2"><span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase border border-blue-900/50">Aguardando Assinatura</span><span className="text-zinc-500 text-xs">{new Date(log.date).toLocaleString()}</span></div><h3 className="text-xl font-bold text-white mb-1">{(log.data as LineStopData).model} - {log.line}</h3><div className="mt-2 text-sm text-zinc-400"><p>1. Baixe a planilha gerada.</p><p>2. Imprima e colete as assinaturas.</p><p>3. Tire uma foto e faça o upload abaixo.</p></div></div><div className="flex flex-col justify-center gap-2 min-w-[200px]"><Button variant="outline" onClick={() => exportLineStopToExcel(log)}><Printer size={16}/> Baixar Planilha</Button><Button onClick={() => setActiveLineStopLog(log)}>Fazer Upload</Button></div></div>{activeLineStopLog?.id === log.id && (<div className="mt-6 pt-6 border-t border-zinc-800 animate-in slide-in-from-top-2"><label className="cursor-pointer flex flex-col items-center justify-center h-32 w-full border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-lg transition-colors"><Camera size={24} className="mb-2 text-zinc-500" /><span className="text-sm text-zinc-400">Tirar Foto da Folha Assinada</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleUploadSignedDoc(e.target.files[0]) }} /></label><Button variant="ghost" fullWidth className="mt-2" onClick={() => setActiveLineStopLog(null)}>Cancelar</Button></div>)}</div>))}</div>)} {lineStopTab === 'HISTORY' && (<div className="space-y-4">{lineStopLogs.filter(l => l.status === 'COMPLETED').length === 0 && <p className="text-center text-zinc-500 py-10">Histórico vazio.</p>}{lineStopLogs.filter(l => l.status === 'COMPLETED').map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-green-900/20 text-green-500 rounded-full flex items-center justify-center border border-green-900/30"><CheckCircle2 size={20}/></div><div><p className="font-bold text-zinc-200">{(log.data as LineStopData).model} • {log.line}</p><p className="text-sm text-zinc-400">{new Date(log.date).toLocaleDateString()} • {(log.data as LineStopData).totalTime} parado</p></div></div><div className="flex gap-2"><Button variant="secondary" onClick={() => setPreviewLog(log)}><Eye size={16}/></Button><Button variant="outline" onClick={() => exportLineStopToExcel(log)}><Download size={16}/></Button></div></div>))}</div>)}
  {renderPreviewModal()}
  </Layout>;

  // --- RECOVER VIEW ---
  if (view === 'RECOVER') return (
      <Layout variant="auth">
          <div className="flex flex-col items-center justify-center min-h-screen px-4">
              <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
                  <h2 className="text-xl font-bold mb-4 text-white text-center">Recuperar Senha</h2>
                  <p className="text-sm text-zinc-400 mb-6 text-center">Digite sua matrícula e email cadastrados para redefinir a senha.</p>
                  <form onSubmit={handleRecover} className="space-y-4">
                      <Input label="Matrícula" value={recoverMatricula} onChange={e => setRecoverMatricula(e.target.value)} icon={<UserIcon size={18} />} />
                      <Input label="Email" type="email" value={recoverEmail} onChange={e => setRecoverEmail(e.target.value)} icon={<Briefcase size={18} />} />
                      <Button fullWidth type="submit" disabled={isLoading}>{isLoading ? 'Enviando...' : 'Recuperar'}</Button>
                  </form>
                  <div className="mt-4 pt-4 border-t border-zinc-800/50">
                      <Button variant="ghost" fullWidth onClick={() => setView('LOGIN')}>Voltar ao Login</Button>
                  </div>
              </div>
          </div>
      </Layout>
  );

  // --- SETUP VIEW ---
  if (view === 'SETUP') return <Layout variant="auth"><div className="flex flex-col items-center justify-center min-h-screen px-4"><div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-md"><h1 className="text-2xl font-bold text-center mb-4 text-white">Configuração de Rede</h1><Input label="IP do Servidor" value={serverIp} onChange={e => setServerIp(e.target.value)} placeholder="http://192.168.X.X:3000" /><Button onClick={async () => { if(serverIp){ saveServerUrl(serverIp); await initApp(); } }} fullWidth className="mt-6">Conectar</Button></div></div></Layout>;

  if (view === 'LOGIN') {
      return (
          <Layout variant="auth">
              <div className="flex flex-col items-center justify-center min-h-screen px-4">
                  <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
                      <div className="flex justify-center mb-6">
                          <div className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden">
                             <img src="/logo.png" className="w-full h-full object-contain" alt="LC" />
                          </div>
                      </div>
                      <h1 className="text-2xl font-bold text-center mb-1 text-white">TECPLAM</h1>
                      <p className="text-center text-zinc-400 mb-8 text-sm">Controle Automático de Relatório</p>
                      <form onSubmit={handleLogin} className="space-y-4">
                          <Input label="Matrícula" value={loginMatricula} onChange={e => setLoginMatricula(e.target.value)} icon={<UserIcon size={18} />} autoFocus />
                          <div>
                              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Senha</label>
                              <div className="relative">
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"><Lock size={18} /></div>
                                  <input 
                                      type={showLoginPassword ? "text" : "password"} 
                                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 outline-none text-zinc-100 placeholder-zinc-600 transition-all shadow-inner text-sm"
                                      value={loginPassword}
                                      onChange={e => setLoginPassword(e.target.value)}
                                  />
                                  <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </button>
                              </div>
                          </div>
                          {loginError && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900/50 flex items-center gap-2"><AlertCircle size={16}/> {loginError}</div>}
                          <Button fullWidth type="submit" disabled={isLoading}>{isLoading ? 'Entrando...' : 'Entrar'}</Button>
                      </form>
                      <div className="mt-6 flex flex-col gap-3">
                          <button onClick={() => setView('REGISTER')} className="text-sm text-zinc-500 hover:text-blue-400 transition-colors">Não tem conta? Cadastre-se</button>
                          <button onClick={() => setView('RECOVER')} className="text-xs text-zinc-600 hover:text-zinc-400">Esqueci minha senha</button>
                          <div className="pt-4 border-t border-zinc-800/50">
                              <button onClick={() => setView('SETUP')} className="text-xs text-zinc-700 hover:text-zinc-500 flex items-center justify-center gap-1 w-full"><Wifi size={12}/> Configurar Servidor</button>
                          </div>
                      </div>
                  </div>
              </div>
          </Layout>
      );
  }

  if (view === 'REGISTER') {
      return (
          <Layout variant="auth">
              <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
                  <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
                      <h1 className="text-2xl font-bold text-center mb-1 text-white">Criar Conta</h1>
                      <p className="text-center text-zinc-400 mb-6 text-sm">Preencha seus dados</p>
                      <form onSubmit={handleRegister} className="space-y-4">
                          <Input label="Nome Completo" value={regName} onChange={e => setRegName(e.target.value)} />
                          <Input label="Matrícula" value={regMatricula} onChange={e => setRegMatricula(e.target.value)} />
                          <div>
                              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Função</label>
                              <select className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-600/50 outline-none" value={regRole} onChange={e => setRegRole(e.target.value)}>
                                  {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Turno</label>
                              <select className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-600/50 outline-none" value={regShift} onChange={e => setRegShift(e.target.value)}>
                                  <option value="1">1º Turno</option>
                                  <option value="2">2º Turno</option>
                                  <option value="3">3º Turno</option>
                                  <option value="ADM">Administrativo</option>
                              </select>
                          </div>
                          <Input label="Email (Opcional)" value={regEmail} onChange={e => setRegEmail(e.target.value)} type="email" />
                          <Input label="Senha" value={regPassword} onChange={e => setRegPassword(e.target.value)} type="password" />
                          <Input label="Confirmar Senha" value={regConfirmPassword} onChange={e => setRegConfirmPassword(e.target.value)} type="password" />
                          
                          {regError && <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900/50 flex items-center gap-2"><AlertCircle size={16}/> {regError}</div>}
                          
                          <Button fullWidth type="submit" disabled={isLoading}>{isLoading ? 'Cadastrando...' : 'Criar Conta'}</Button>
                      </form>
                      <button onClick={() => setView('LOGIN')} className="mt-4 w-full text-sm text-zinc-500 hover:text-blue-400 transition-colors">Já tem conta? Faça Login</button>
                  </div>
              </div>
          </Layout>
      );
  }

  // General block for remaining authenticated views
  if (view === 'DASHBOARD' || view === 'CHECKLIST_MENU' || view === 'SUCCESS' || view === 'PERSONAL' || view === 'PROFILE' || view === 'MEETING_MENU' || view === 'MEETING_HISTORY' || view === 'MAINTENANCE_QR' || view === 'MEETING_FORM') {
      
      // Default Dashboard Rendering if not intercepted
      if (view === 'DASHBOARD' || view === 'CHECKLIST_MENU') {
          return (
            <Layout sidebar={<SidebarContent />}>
                {isLoading && <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center text-white backdrop-blur-sm">Salvando...</div>}
                
                {showLinePrompt && (
                   <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                       <Card className="w-full max-w-sm bg-zinc-900 border-zinc-700 shadow-2xl">
                           <h3 className="text-xl font-bold text-white mb-2">Iniciar Checklist</h3>
                           <p className="text-sm text-zinc-400 mb-6">Selecione a linha de produção para iniciar a verificação.</p>
                           <div className="space-y-4">
                               <div>
                                   <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Selecione a Linha</label>
                                   <select 
                                       className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-600 outline-none"
                                       value={currentLine}
                                       onChange={e => setCurrentLine(e.target.value)}
                                   >
                                       {lines.map(l => <option key={l} value={l}>{l}</option>)}
                                   </select>
                               </div>
                               <div className="flex gap-2">
                                   <Button variant="secondary" fullWidth onClick={() => { setShowLinePrompt(false); setView('MENU'); }}>Cancelar</Button>
                                   <Button fullWidth onClick={handleConfirmLine}>Confirmar</Button>
                               </div>
                           </div>
                       </Card>
                   </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div><h1 className="text-2xl font-bold text-white flex items-center gap-2">{isMaintenanceMode ? <Hammer className="text-purple-500"/> : <CheckSquare className="text-blue-500"/>} {isMaintenanceMode ? 'Manutenção' : 'Checklist Digital'}</h1><div className="flex items-center gap-2 mt-2 text-sm text-zinc-400"><span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300 border border-zinc-700">{currentLine}</span><span>•</span><span>{getManausDate().toLocaleDateString()}</span></div></div>
                    <div className="flex items-center gap-3"><Button variant="outline" onClick={() => setView(isMaintenanceMode ? 'MAINTENANCE_QR' : 'MENU')}><ArrowLeft size={16} /> Voltar</Button></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="hidden md:block md:col-span-1"><div className="sticky top-8 space-y-1 max-h-[80vh] overflow-y-auto custom-scrollbar pr-2"><p className="text-xs font-bold text-zinc-500 uppercase px-2 mb-3 tracking-wider">Navegação Rápida</p>{categories.map(cat => (<button key={cat} onClick={() => categoryRefs.current[cat]?.scrollIntoView({behavior:'smooth'})} className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-blue-400 transition-colors truncate border-l-2 border-transparent hover:border-blue-500">{cat}</button>))}</div></div>
                    <div className="md:col-span-3 space-y-10 pb-24">
                        {categories.map(cat => (
                            <div key={cat} ref={el => { categoryRefs.current[cat] = el; }} className="scroll-mt-8">
                                <h2 className="text-lg font-bold text-white mb-4 pl-3 border-l-4 border-blue-600 flex items-center gap-2">{cat}</h2>
                                <div className="space-y-4">{items.filter(i => i.category === cat).map(item => { const currentStatus = checklistData[item.id]; return (<div key={item.id} className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800 hover:border-zinc-700 transition-all shadow-sm"><div className="flex flex-col gap-4">{item.imageUrl && (<div className="w-full h-48 bg-black/20 rounded-lg border border-zinc-800 overflow-hidden flex items-center justify-center"><img src={item.imageUrl} alt="Ref" className="max-h-full max-w-full object-contain" /></div>)}<div className="flex-1"><p className="text-zinc-200 font-medium mb-1.5 text-base">{item.text}</p>{item.evidence && (<p className="text-zinc-500 text-xs italic mb-4 flex items-center gap-1"><AlertCircle size={12}/> Ref: {item.evidence}</p>)}<div className="flex gap-3 mb-2"><button onClick={() => setChecklistData({...checklistData, [item.id]: 'OK'})} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2 ${currentStatus === 'OK' ? 'bg-green-500/10 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900'}`}>OK</button><button onClick={() => setChecklistData({...checklistData, [item.id]: 'NG'})} className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center gap-2 ${currentStatus === 'NG' ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900'}`}>NG</button><button onClick={() => setChecklistData({...checklistData, [item.id]: 'N/A'})} className={`w-20 py-3 rounded-lg font-bold text-sm transition-all border flex items-center justify-center ${currentStatus === 'N/A' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-900'}`}>N/A</button></div>{currentStatus === 'NG' && (<div className="bg-red-900/10 border border-red-900/30 rounded-lg p-4 mt-3 animate-in fade-in slide-in-from-top-2"><p className="text-xs text-red-400 font-bold mb-3 flex items-center gap-1 uppercase tracking-wide"><AlertTriangle size={12}/> Evidência Obrigatória</p><Input placeholder="Descreva o motivo da falha..." value={checklistEvidence[item.id]?.comment || ''} onChange={e => handleNgComment(item.id, e.target.value)} className="bg-black/20 border-red-900/30 focus:border-red-500 mb-3" /><div>{checklistEvidence[item.id]?.photo ? (<div className="relative inline-block group"><img src={checklistEvidence[item.id]?.photo} className="h-24 w-auto rounded-lg border border-red-900/30 shadow-lg" /><button onClick={() => setChecklistEvidence(prev => { const n = {...prev}; delete n[item.id].photo; return n; })} className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 shadow-md transition-transform hover:scale-110"><X size={12}/></button></div>) : (<label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 hover:text-white text-xs text-zinc-400 px-4 py-2.5 rounded-lg inline-flex items-center gap-2 border border-zinc-700 transition-colors"><Camera size={16} /> Tirar Foto<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleNgPhoto(item.id, e.target.files[0]) }} /></label>)}</div></div>)}</div></div></div>); })}</div>
                            </div>
                        ))}
                        <Card className="bg-zinc-900 border-zinc-800"><label className="block text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wide">Observações Gerais</label><textarea className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 h-32 resize-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 outline-none transition-all placeholder-zinc-600" placeholder="Anotações adicionais sobre o turno..." value={observation} onChange={e => setObservation(e.target.value)} /></Card>
                    </div>
                </div>
                <div className="fixed bottom-0 right-0 left-0 md:left-72 p-4 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800 flex justify-between items-center z-40"><div className="hidden md:block text-xs text-zinc-500">{Object.keys(checklistData).length} / {items.length} itens verificados</div><Button onClick={async () => { if(!currentUser) return; setIsLoading(true); const log: ChecklistLog = { id: currentLogId || Date.now().toString(), userId: currentUser.matricula, userName: currentUser.name, userRole: currentUser.role, line: currentLine, date: getManausDate().toISOString(), itemsCount: items.length, ngCount: Object.values(checklistData).filter(v=>v==='NG').length, observation, data: checklistData, evidenceData: checklistEvidence, type: isMaintenanceMode ? 'MAINTENANCE' : 'PRODUCTION', maintenanceTarget: maintenanceTarget }; await saveLog(log); setIsLoading(false); setView('SUCCESS'); }} className="w-full md:w-auto shadow-xl shadow-blue-900/30 px-8 py-3"><Save size={18} /> Finalizar Relatório</Button></div>
            </Layout>
          );
      }

      if (view === 'SUCCESS') return <Layout variant="auth"><div className="flex flex-col items-center justify-center min-h-screen text-center"><div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-6 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.2)] animate-in zoom-in duration-300"><CheckCircle2 size={48} /></div><h2 className="text-3xl font-bold text-white mb-2">Salvo com Sucesso!</h2><p className="text-zinc-400 mb-8 max-w-md">Os dados foram registrados no sistema.</p><Button onClick={() => setView('MENU')} className="min-w-[200px]">Voltar ao Início</Button></div></Layout>;
      if (view === 'PERSONAL') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold text-white">Meus Registros</h1></header><div className="space-y-4">{personalLogs.length === 0 && <p className="text-zinc-500 text-center py-12 bg-zinc-900/50 rounded-xl border border-zinc-800">Nenhum registro encontrado.</p>}{personalLogs.map(log => (<div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${log.ngCount > 0 ? 'bg-red-900/20 text-red-500 border border-red-900/30' : 'bg-green-900/20 text-green-500 border border-green-900/30'}`}>{log.ngCount > 0 ? '!' : '✓'}</div><div><p className="font-bold text-zinc-200">{new Date(log.date).toLocaleString()}</p><p className="text-sm text-zinc-400">{log.line} <span className="mx-2">•</span> {log.ngCount > 0 ? `${log.ngCount} Falhas` : '100% OK'} {log.type === 'LINE_STOP' && '(Parada)'}</p></div></div><div className="flex gap-2 w-full md:w-auto"><Button variant="secondary" onClick={() => setPreviewLog(log)} className="flex-1 md:flex-none"><Eye size={16}/></Button><Button variant="outline" onClick={() => exportLogToExcel(log, items)} className="flex-1 md:flex-none"><Download size={16}/> Excel</Button></div></div>))}</div>{renderPreviewModal()}</Layout>;
      if (view === 'PROFILE') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8"><h1 className="text-2xl font-bold text-white">Meu Perfil</h1></header><Card className="max-w-xl mx-auto"><div className="flex flex-col items-center mb-8"><div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-3xl font-bold mb-4 text-zinc-300 border-2 border-zinc-700 shadow-xl">{profileData?.name.charAt(0)}</div><p className="text-xl font-bold text-white">{profileData?.name}</p><p className="text-zinc-500 bg-zinc-950 px-3 py-1 rounded-full text-xs mt-2 border border-zinc-800">{profileData?.role}</p></div><div className="space-y-5"><Input label="Nome" value={profileData?.name} onChange={e => setProfileData({...profileData!, name: e.target.value})} /><Input label="Email" value={profileData?.email} onChange={e => setProfileData({...profileData!, email: e.target.value})} /><Input label="Alterar Senha" type="password" placeholder="Nova senha (opcional)" value={profileData?.password || ''} onChange={e => setProfileData({...profileData!, password: e.target.value})} /><div className="pt-4"><Button fullWidth onClick={handleSaveProfile}>Salvar Alterações</Button></div></div></Card></Layout>;
      if (view === 'MEETING_MENU') return <Layout sidebar={<SidebarContent />}><header className="mb-8"><h1 className="text-2xl font-bold mb-2 text-white">Atas de Reunião</h1><p className="text-zinc-400">Gerencie registros de reuniões operacionais.</p></header><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div onClick={() => setView('MEETING_FORM')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-emerald-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden"><div className="w-12 h-12 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Plus size={24} /></div><h3 className="font-bold text-xl text-zinc-100">Nova Ata</h3><p className="text-sm text-zinc-500 mt-2">Registrar reunião online com foto.</p></div><div onClick={() => setView('MEETING_HISTORY')} className="group bg-zinc-900 p-6 rounded-2xl border border-zinc-800 hover:border-blue-600/50 hover:bg-zinc-800 transition-all cursor-pointer relative overflow-hidden"><div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><History size={24} /></div><h3 className="font-bold text-xl text-zinc-100">Histórico</h3><p className="text-sm text-zinc-500 mt-2">Acessar e imprimir atas anteriores.</p></div></div></Layout>;
      if (view === 'MEETING_FORM') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100">Nova Ata de Reunião</h1><Button variant="outline" onClick={() => setView('MEETING_MENU')}>Cancelar</Button></header><div className="space-y-6 max-w-3xl mx-auto"><Card><Input label="Título da Reunião" placeholder="Ex: Alinhamento de Turno, Qualidade, etc." value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} icon={<FileText size={18}/>} /><div className="flex gap-4 mt-4"><Input type="time" label="Início" value={meetingStartTime} onChange={e => setMeetingStartTime(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} /><Input type="time" label="Fim" value={meetingEndTime} onChange={e => setMeetingEndTime(e.target.value)} onClick={(e) => e.currentTarget.showPicker()} /></div></Card><Card><h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Foto da Reunião (Obrigatório)</h3>{meetingPhoto ? (<div className="relative group"><img src={meetingPhoto} alt="Reunião" className="w-full h-64 object-cover rounded-lg border border-zinc-700" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"><Button variant="danger" onClick={() => setMeetingPhoto('')}><Trash2 size={16}/> Remover</Button></div></div>) : (<div className="h-64 bg-zinc-950 border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-500 transition-colors"><label className="cursor-pointer flex flex-col items-center p-8 w-full h-full justify-center"><Camera size={40} className="mb-4 text-zinc-600" /><span className="font-medium">Tirar Foto ou Upload</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if(e.target.files?.[0]) handleMeetingPhoto(e.target.files[0]) }} /></label></div>)}</Card><Card><h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Participantes</h3><div className="flex gap-2 mb-4"><Input placeholder="Nome do participante" value={newParticipant} onChange={e => setNewParticipant(e.target.value)} list="users-list" className="bg-zinc-950" /><datalist id="users-list">{usersList.map(u => <option key={u.matricula} value={u.name} />)}</datalist><Button onClick={handleAddParticipant}><Plus size={18}/></Button></div><div className="flex flex-wrap gap-2">{meetingParticipants.map((p, idx) => (<div key={idx} className="bg-zinc-800 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm">{p}<button onClick={() => handleRemoveParticipant(idx)} className="hover:text-red-400"><X size={14}/></button></div>))}</div></Card><Card><h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Assuntos Tratados</h3><textarea className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 h-40 focus:ring-2 focus:ring-blue-600/50 outline-none placeholder-zinc-600" placeholder="Descreva os tópicos discutidos..." value={meetingTopics} onChange={e => setMeetingTopics(e.target.value)} /></Card><Button fullWidth onClick={handleSaveMeeting} disabled={isLoading} className="py-3">{isLoading ? 'Salvando...' : 'Salvar Ata'}</Button></div></Layout>;
      if (view === 'MEETING_HISTORY') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100">Histórico de Atas</h1><Button variant="outline" onClick={() => setView('MEETING_MENU')}><ArrowLeft size={16} /> Voltar</Button></header><div className="space-y-4">{meetingHistory.map(m => (<div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-zinc-700 transition-colors"><div><p className="font-bold text-white text-lg">{m.title || 'Sem Título'}</p><p className="font-medium text-zinc-400 text-sm flex items-center gap-2"><Calendar size={14}/> {new Date(m.date).toLocaleDateString()} • {m.startTime} - {m.endTime}</p><div className="flex gap-4 mt-2"><span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded">Criado por: {m.createdBy}</span><span className="text-xs text-zinc-500 bg-zinc-950 px-2 py-1 rounded">{m.participants.length} participantes</span></div></div><div className="flex gap-2"><Button variant="secondary" onClick={() => setPreviewMeeting(m)}><Eye size={16}/></Button><Button variant="outline" onClick={() => exportMeetingToExcel(m)}><Download size={16}/> Excel</Button></div></div>))}</div>{renderMeetingPreviewModal()}</Layout>;
      if (view === 'MAINTENANCE_QR') return <Layout sidebar={<SidebarContent />}><header className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800"><h1 className="text-2xl font-bold text-zinc-100">Ler QR Code Máquina</h1></header><div className="max-w-md mx-auto"><div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center"><div id="reader-hidden" className="hidden"></div><label className="cursor-pointer flex flex-col items-center justify-center h-48 w-full border-2 border-dashed border-zinc-700 hover:border-blue-500 rounded-xl transition-all mb-6 bg-zinc-950"><Camera size={48} className="mb-4 text-zinc-500" /><span className="text-lg font-bold text-zinc-300">Tirar Foto do QR Code</span><span className="text-sm text-zinc-500 mt-2">Clique aqui para abrir a câmera</span><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { if(e.target.files?.[0]) { handleMaintenanceQrPhoto(e.target.files[0]); e.target.value = ''; } }} /></label><div className="border-t border-zinc-800 pt-6 mt-6"><p className="text-xs font-bold text-zinc-500 mb-3 uppercase">Inserção Manual</p><div className="flex gap-2"><Input placeholder="Código (Ex: PRENSA_01)" value={qrCodeManual} onChange={e => setQrCodeManual(e.target.value)} /><Button onClick={() => handleMaintenanceCode(qrCodeManual)}>Ir</Button></div></div></div></div></Layout>;
  }

  return null;
};

export default App;
