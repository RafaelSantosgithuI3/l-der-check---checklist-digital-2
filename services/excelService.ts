
import ExcelJS from 'exceljs';
import { ChecklistData, User, ChecklistItem, ChecklistLog, MeetingLog, LineStopData } from '../types';
import { getLogs, getLogsByWeekSyncStrict, saveBackupToServer } from './storageService';
import { getAllUsers } from './authService';

// --- HELPERS ---

const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

const loadTemplate = async (): Promise<ExcelJS.Workbook> => {
    const workbook = new ExcelJS.Workbook();
    try {
        // Tenta carregar o arquivo da pasta public
        const response = await fetch('/template_checklist.xlsx');
        if (!response.ok) throw new Error("Template não encontrado");
        const buffer = await response.arrayBuffer();
        await workbook.xlsx.load(buffer);
    } catch (e) {
        console.warn("Template não encontrado ou erro ao carregar. Criando planilha básica em memória...", e);
        // Fallback: Cria uma planilha básica se não houver template, para não quebrar o app
        const sheet = workbook.addWorksheet('Checklist');
        // Estrutura mínima para o código abaixo funcionar sem o arquivo físico
        sheet.getCell('A5').value = "MÊS:";
        sheet.getCell('F5').value = "LINHA:";
        sheet.getCell('G5').value = "TURNO:";
        sheet.getCell('I5').value = "WEEK:";
        sheet.getRow(7).values = []; // Linha de início dos itens
    }
    return workbook;
};

// --- CORE EXPORT FUNCTION ---

export const createExcelBuffer = async (
    lineName: string,
    shiftName: string,
    dateObj: Date,
    items: ChecklistItem[],
    allLogs: ChecklistLog[],
    allUsers: User[]
) => {
    // 1. Carregar Template
    const workbook = await loadTemplate();
    
    // CORREÇÃO: Pegar a primeira worksheet existente do template, em vez de buscar por nome ou criar nova
    let worksheet = workbook.worksheets[0];
    if (!worksheet) worksheet = workbook.addWorksheet('Checklist');

    // Filtra logs estritamente por LINHA, TURNO e DATA(SEMANA)
    const weeklyLogs = getLogsByWeekSyncStrict(allLogs, dateObj, lineName, shiftName, allUsers);
    
    const logsByDay: {[key: number]: ChecklistLog} = {};
    weeklyLogs.forEach(l => {
        const d = new Date(l.date).getDay(); // 0 (Dom) a 6 (Sab)
        logsByDay[d] = l;
    });

    const weekNum = getWeekNumber(dateObj);
    const monthName = dateObj.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
    const yearNum = dateObj.getFullYear();

    // 2. Preencher Cabeçalho (Mapeamento Fixo)
    
    // A5:E5 -> MÊS/ANO
    worksheet.mergeCells('A5:E5');
    const cellMes = worksheet.getCell('A5');
    cellMes.value = `MÊS: ${monthName} / ${yearNum}`;
    cellMes.font = { bold: true, name: 'Arial', size: 12 };
    cellMes.alignment = { horizontal: 'center', vertical: 'middle' };

    // F5 -> LINHA
    const cellLinha = worksheet.getCell('F5');
    cellLinha.value = `LINHA: ${lineName}`;
    cellLinha.font = { bold: true, name: 'Arial', size: 10 };
    cellLinha.alignment = { horizontal: 'center', vertical: 'middle' };

    // G5:H5 -> TURNO
    worksheet.mergeCells('G5:H5');
    const cellTurno = worksheet.getCell('G5');
    cellTurno.value = `TURNO: ${shiftName}`;
    cellTurno.font = { bold: true, name: 'Arial', size: 10 };
    cellTurno.alignment = { horizontal: 'center', vertical: 'middle' };

    // I5:L5 -> WEEK
    worksheet.mergeCells('I5:L5');
    const cellWeek = worksheet.getCell('I5');
    cellWeek.value = `WEEK: ${weekNum}`;
    cellWeek.font = { bold: true, name: 'Arial', size: 10 };
    cellWeek.alignment = { horizontal: 'center', vertical: 'middle' };

    // 3. Preencher Itens (Começando na Linha 7)
    const startRow = 7;
    
    // Se houver mais itens do que o espaço padrão (assumindo template com ~20 linhas), 
    // precisamos inserir linhas para não sobrescrever o rodapé.
    // Vamos inserir linhas a partir da startRow para cada item.
    
    // Vamos limpar a linha 7 inicial e inserir as novas se necessário
    if (items.length > 1) {
        // spliceRows empurra o conteúdo existente para baixo, preservando o rodapé do template
        worksheet.spliceRows(startRow + 1, 0, ...new Array(items.length - 1).fill([]));
    }

    const centerStyle: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const currentRow = startRow + i;
        const row = worksheet.getRow(currentRow);
        row.height = 45; // Altura para caber imagem/texto

        // Coluna A: ID
        const cellId = worksheet.getCell(`A${currentRow}`);
        cellId.value = i + 1;
        cellId.alignment = centerStyle;
        cellId.border = borderStyle;

        // Coluna B: Categoria
        const cellCat = worksheet.getCell(`B${currentRow}`);
        cellCat.value = item.category;
        cellCat.alignment = centerStyle;
        cellCat.font = { size: 8 };
        cellCat.border = borderStyle;

        // Coluna C:E: Texto (Mesclar)
        worksheet.mergeCells(`C${currentRow}:E${currentRow}`);
        const cellText = worksheet.getCell(`C${currentRow}`);
        cellText.value = item.text + (item.evidence ? `\n(Ref: ${item.evidence})` : '');
        cellText.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cellText.border = borderStyle;
        cellText.font = { size: 9 };

        // Coluna F: Imagem (Referência)
        const cellImg = worksheet.getCell(`F${currentRow}`);
        cellImg.value = ''; // Limpar valor texto
        cellImg.border = borderStyle;
        
        if (item.imageUrl) {
            try {
                const base64Clean = item.imageUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
                const imageId = workbook.addImage({
                    base64: base64Clean,
                    extension: 'png',
                });
                // Ajuste fino da imagem dentro da célula F
                worksheet.addImage(imageId, {
                    tl: { col: 5, row: currentRow - 1 }, // Col F = index 5
                    br: { col: 6, row: currentRow },
                    editAs: 'oneCell'
                } as any);
            } catch (err) { console.error('Erro img', err); }
        }

        // Colunas G a L: Respostas (Seg a Sab)
        const daysMap = [1, 2, 3, 4, 5, 6]; // Seg=1 ... Sab=6
        const colMap = ['G', 'H', 'I', 'J', 'K', 'L'];

        daysMap.forEach((dayIdx, idx) => {
            const colLetter = colMap[idx];
            const cellResp = worksheet.getCell(`${colLetter}${currentRow}`);
            const log = logsByDay[dayIdx];
            const val = log?.data[item.id] || '';

            cellResp.value = val;
            cellResp.alignment = centerStyle;
            cellResp.border = borderStyle;
            cellResp.font = { bold: true };

            if (val === 'OK') {
                cellResp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } }; // Light Green
                cellResp.font = { color: { argb: 'FF006400' }, bold: true };
            } else if (val === 'NG') {
                cellResp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCB' } }; // Light Red
                cellResp.font = { color: { argb: 'FF8B0000' }, bold: true };
            } else if (val === 'N/A') {
                cellResp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFE0' } }; // Light Yellow
                cellResp.font = { color: { argb: 'FFDAA520' }, bold: true };
            }
        });
    }

    // 4. Rodapé (Assinaturas)
    // A linha de assinaturas deve ser imediatamente após os itens.
    const footerRow = startRow + items.length;
    
    // Altura maior para caber assinatura diagonal
    worksheet.getRow(footerRow).height = 80;

    // A:F -> "RESPONSÁVEL"
    worksheet.mergeCells(`A${footerRow}:F${footerRow}`);
    const cellRespTitle = worksheet.getCell(`A${footerRow}`);
    cellRespTitle.value = "RESPONSÁVEL DO TURNO";
    cellRespTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    cellRespTitle.font = { bold: true, size: 12 };
    cellRespTitle.border = borderStyle;
    cellRespTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } }; // Light Gray

    // G:L -> Nomes (Diagonal)
    const colMap = ['G', 'H', 'I', 'J', 'K', 'L'];
    const daysMap = [1, 2, 3, 4, 5, 6];

    daysMap.forEach((dayIdx, idx) => {
        const colLetter = colMap[idx];
        const cellSign = worksheet.getCell(`${colLetter}${footerRow}`);
        const log = logsByDay[dayIdx];

        if (log) {
            cellSign.value = `${log.userName}\n(${log.userId})`;
        } else {
            cellSign.value = "-";
        }
        
        // ESTILO DIAGONAL EXIGIDO
        cellSign.alignment = { 
            textRotation: 45, 
            vertical: 'middle', 
            horizontal: 'center',
            wrapText: true 
        };
        cellSign.font = { size: 8, bold: true };
        cellSign.border = borderStyle;
    });

    return await workbook.xlsx.writeBuffer();
};

// --- PUBLIC FUNCTIONS ---

export const generateAndSaveBackup = async (
    line: string, 
    shift: string, 
    date: Date, 
    items: ChecklistItem[]
) => {
    const allLogs = await getLogs();
    const allUsers = await getAllUsers();
    const buffer = await createExcelBuffer(line, shift, date, items, allLogs, allUsers);
    
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
            const base64data = reader.result as string;
            const week = getWeekNumber(date);
            const fileName = `BACKUP_${line}_T${shift}_W${week}_${date.getFullYear()}.xlsx`;
            try {
                const res = await saveBackupToServer(fileName, base64data);
                resolve(res);
            } catch (e) { reject(e); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const downloadShiftExcel = async (
    line: string,
    shift: string,
    dateStr: string,
    items: ChecklistItem[]
) => {
    let dateObj = new Date();
    if (dateStr.includes('-W')) {
        const parts = dateStr.split('-W');
        const year = parseInt(parts[0]);
        const week = parseInt(parts[1]);
        const simpleDate = new Date(year, 0, 1 + (week - 1) * 7);
        dateObj = simpleDate;
    } else {
        dateObj = new Date(dateStr);
    }

    const allLogs = await getLogs();
    const allUsers = await getAllUsers();

    const buffer = await createExcelBuffer(line, shift, dateObj, items, allLogs, allUsers);
    
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Checklist_${line}_Turno${shift}_W${getWeekNumber(dateObj)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

export const exportLogToExcel = async (log: ChecklistLog, items: ChecklistItem[]) => {
    if (log.type === 'LINE_STOP') {
        return exportLineStopToExcel(log);
    }

    const allLogs = await getLogs();
    const allUsers = await getAllUsers();
    
    // Tenta descobrir o turno
    const fullUser = allUsers.find(u => u.matricula === log.userId);
    const shift = fullUser ? fullUser.shift : '2'; 

    const dateObj = new Date(log.date);
    const line = log.line || 'LINHA_GERAL';
    
    const buffer = await createExcelBuffer(line, shift || '1', dateObj, items, allLogs, allUsers);

    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Checklist_${line}_Individual.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

// --- ATA DE REUNIÃO ---

export const exportMeetingToExcel = async (meeting: MeetingLog) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ata de Reunião');

    // Título Mesclado (A1:H1) - Tamanho 11
    worksheet.mergeCells('A1:H1');
    const title = worksheet.getCell('A1');
    title.value = `ATA DE REUNIÃO: ${meeting.title || 'Sem Título'}`;
    title.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };

    // Info Header (Com Horários)
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `DATA: ${new Date(meeting.date).toLocaleDateString()} | INÍCIO: ${meeting.startTime} | TÉRMINO: ${meeting.endTime}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    worksheet.getCell('A2').font = { size: 10 };
    
    worksheet.getRow(3).height = 10;

    // Foto (A4:H15)
    worksheet.mergeCells('A4:H15');
    const photoPlace = worksheet.getCell('A4');
    photoPlace.value = meeting.photoUrl ? "" : "FOTO DA REUNIÃO NÃO DISPONÍVEL";
    photoPlace.alignment = { vertical: 'middle', horizontal: 'center' };
    photoPlace.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

    if (meeting.photoUrl) {
         const base64Clean = meeting.photoUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
         const imageId = workbook.addImage({
            base64: base64Clean,
            extension: 'png',
         });
         // Inserir respeitando as células mescladas A4:H15
         worksheet.addImage(imageId, {
            tl: { col: 0, row: 3 }, // A4
            br: { col: 8, row: 15 }, // H15 (Exclusive, so it covers A-H)
            editAs: 'oneCell'
         } as any);
    }

    // Participantes
    worksheet.mergeCells('A16:H16');
    worksheet.getCell('A16').value = "PARTICIPANTES";
    worksheet.getCell('A16').font = { bold: true };
    worksheet.getCell('A16').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

    let currentRow = 17;
    meeting.participants.forEach(p => {
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `• ${p}`;
        currentRow++;
    });

    currentRow++;
    
    // Assuntos
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = "ASSUNTOS TRATADOS";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:H${currentRow+5}`);
    const topicsCell = worksheet.getCell(`A${currentRow}`);
    topicsCell.value = meeting.topics;
    topicsCell.alignment = { wrapText: true, vertical: 'top' };
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ATA_REUNIAO_${meeting.date.substring(0,10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

// --- PARADA DE LINHA (Mantido Lógica Original) ---
export const exportLineStopToExcel = async (log: ChecklistLog) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Parada de Linha');
    const data = log.data as LineStopData;

    worksheet.columns = [
        { key: 'A', width: 15 }, { key: 'B', width: 12 }, { key: 'C', width: 12 }, { key: 'D', width: 12 },
        { key: 'E', width: 12 }, { key: 'F', width: 12 }, { key: 'G', width: 12 }, { key: 'H', width: 12 },
        { key: 'I', width: 12 }, { key: 'J', width: 12 }
    ];

    const borderAll: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    const centerStyle: Partial<ExcelJS.Style> = { alignment: { vertical: 'middle', horizontal: 'center', wrapText: true } };
    const boldFont = { bold: true, name: 'Arial', size: 10 };

    worksheet.mergeCells('A1:J1');
    const title = worksheet.getCell('A1');
    title.value = "EXPRESSO DE PARADA DE LINHA";
    title.font = { name: 'Arial', size: 16, bold: true };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.border = borderAll;

    // Cabeçalho
    const addHeader = (cells: string, label: string, val: string) => {
        worksheet.mergeCells(cells);
        const c = worksheet.getCell(cells.split(':')[0]);
        c.value = `${label}:\n${val}`;
        c.border = borderAll; c.alignment = centerStyle.alignment; c.font = boldFont;
    };

    addHeader('A2:B3', 'MODELO', data.model || '');
    addHeader('C2:D3', 'DATA', new Date(log.date).toLocaleDateString());
    
    let shiftDisplay = '?';
    if(log.userRole.toLowerCase().includes('turno')) shiftDisplay = log.userRole.split('Turno')[1].trim();
    addHeader('E2:F3', 'TURNO', shiftDisplay);
    addHeader('G2:H3', 'LÍDER', log.userName);
    addHeader('I2:J3', 'CLIENTE', data.client || '');

    // Dados Técnicos
    const addSimple = (cells: string, val: string) => { worksheet.mergeCells(cells); const c = worksheet.getCell(cells.split(':')[0]); c.value = val; c.border = borderAll; };
    
    addSimple('A4:B4', `INICIO: ${data.startTime}`);
    addSimple('C4:D4', `TERMINO: ${data.endTime}`);
    addSimple('E4:F4', `LINHA PARADA: ${data.line}`);
    addSimple('G4:H4', `FASE: ${data.phase}`);
    addSimple('I4:J4', `PERCA PROD: ${data.productionLoss || ''}`);
    
    addSimple('A5:B5', `TEMPO PADRÃO: ${data.standardTime}`);
    addSimple('C5:D5', `QTDE PESSOAS: ${data.peopleStopped}`);
    addSimple('E5:J5', "");

    worksheet.mergeCells('A6:F6');
    worksheet.getCell('A6').value = `POSTO PARADO:  ${data.stationStart}   ATÉ   ${data.stationEnd}`;
    worksheet.getCell('A6').border = borderAll; worksheet.getCell('A6').font = { bold: true };

    worksheet.mergeCells('G6:J6');
    worksheet.getCell('G6').value = `TOTAL HORAS PARADAS: ${data.totalTime}`;
    worksheet.getCell('G6').border = borderAll; worksheet.getCell('G6').font = { bold: true, color: { argb: 'FFFF0000' } };

    // Motivo
    worksheet.mergeCells('A7:J7');
    const motivoHeader = worksheet.getCell('A7');
    motivoHeader.value = "MOTIVO / OCORRÊNCIA:";
    motivoHeader.font = { bold: true };
    motivoHeader.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

    worksheet.mergeCells('A8:J8'); 
    const motivoContent = worksheet.getCell('A8');
    motivoContent.value = data.motivo || '';
    motivoContent.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    motivoContent.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    worksheet.getRow(8).height = 60;

    // Categorias
    const categories = [
        { code: 'GQ', label: 'PRODUÇÃO', col: 'A' },
        { code: 'SMD/IAC', label: 'PRÉ-FORMA', col: 'C' },
        { code: 'MANUTENÇÃO', label: 'MATERIAIS', col: 'E' },
        { code: 'PCP', label: 'ÁREA TÉCNICA', col: 'G' },
        { code: 'SAMSUNG', label: 'EXTERNO', col: 'I' }
    ];

    categories.forEach((cat, idx) => {
        const cIdx = idx * 2;
        const cellTop = worksheet.getCell(9, cIdx + 1);
        worksheet.mergeCells(9, cIdx + 1, 9, cIdx + 2);
        cellTop.value = `${data.responsibleSector === cat.code ? '☑' : '☐'} ${cat.code}`;
        cellTop.alignment = centerStyle.alignment; cellTop.font = boldFont; cellTop.border = borderAll;
        
        const cellBot = worksheet.getCell(10, cIdx + 1);
        worksheet.mergeCells(10, cIdx + 1, 10, cIdx + 2);
        cellBot.value = `${data.responsibleSector === cat.label ? '☑' : '☐'} ${cat.label}`;
        cellBot.alignment = centerStyle.alignment; cellBot.font = boldFont; cellBot.border = borderAll;
    });

    // Justificativa
    worksheet.mergeCells('A12:J12');
    const justTitle = worksheet.getCell('A12');
    justTitle.value = "JUSTIFICATIVAS E PRAZOS PARA SOLUÇÃO DEFINITIVA (Preenchimento exclusivo do Responsável):";
    justTitle.font = { bold: true, underline: true };
    justTitle.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

    worksheet.mergeCells('A13:J15');
    const justText = worksheet.getCell('A13');
    justText.value = data.justification || "";
    justText.alignment = { vertical: 'top', wrapText: true };
    justText.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    
    // Assinaturas
    const signatures = ["SETOR RESP.", "SUPERVISOR GERAL", "COORDENADOR", "PCP", "DIRETOR GERAL"];
    signatures.forEach((role, idx) => {
        const cIdx = (idx * 2) + 1;
        worksheet.mergeCells(17, cIdx, 21, cIdx + 1);
        const cell = worksheet.getCell(17, cIdx);
        cell.value = `\n\n\n____________________\n${role}\nDATA: __/__/____`;
        cell.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };
        cell.font = { size: 8, bold: true };
        cell.border = borderAll;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ParadaLinha_${log.line}_${log.date.substring(0,10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}
