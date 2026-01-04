
import ExcelJS from 'exceljs';
import { ChecklistItem, ChecklistLog, MeetingLog, LineStopData, User } from '../types';
import { getLogs, getLogsByWeekSyncStrict, saveBackupToServer } from './storageService';
import { getAllUsers } from './authService';

// --- UTILITÁRIOS ---
const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

const fileToBase64Clean = (base64: string) => base64.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

// --- DOWNLOAD NO CLIENTE ---
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
        dateObj = new Date(year, 0, 1 + (week - 1) * 7);
    } else {
        dateObj = new Date(dateStr);
    }

    const allLogs = await getLogs();
    const allUsers = await getAllUsers();

    try {
        // Tenta carregar template
        const buffer = await generateChecklistFromTemplate(line, shift, dateObj, items, allLogs, allUsers);
        triggerDownload(buffer, `Checklist_${line}_T${shift}_W${getWeekNumber(dateObj)}.xlsx`);
    } catch (e) {
        console.error("Erro ao gerar via template, fallback para legado...", e);
        alert("Erro ao ler 'template_checklist.xlsx' na pasta public. Verifique se o arquivo existe.");
    }
}

// --- FUNÇÃO DE DOWNLOAD ---
const triggerDownload = (buffer: ArrayBuffer, fileName: string) => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

// --- GERADOR CORE (COM TEMPLATE) ---
const generateChecklistFromTemplate = async (
    lineName: string,
    shiftName: string,
    dateObj: Date,
    items: ChecklistItem[],
    allLogs: ChecklistLog[],
    allUsers: User[]
) => {
    // 1. Carregar Template
    const response = await fetch('/template_checklist.xlsx');
    if (!response.ok) throw new Error("Template não encontrado");
    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet(1); // Assume primeira aba
    if (!worksheet) throw new Error("Aba 1 não encontrada no template");

    // Filtra logs
    const weeklyLogs = getLogsByWeekSyncStrict(allLogs, dateObj, lineName, shiftName, allUsers);
    const logsByDay: {[key: number]: ChecklistLog} = {};
    weeklyLogs.forEach(l => {
        const d = new Date(l.date).getDay(); // 0-6 (Dom-Sab)
        logsByDay[d] = l;
    });

    const weekNum = getWeekNumber(dateObj);
    const monthName = dateObj.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
    const yearNum = dateObj.getFullYear();

    // 2. Preencher Cabeçalho
    // A5:E5 -> MÊS/ANO
    const cellMes = worksheet.getCell('A5');
    cellMes.value = `MÊS: ${monthName}/${yearNum}`;
    
    // F5 -> LINHA
    const cellLinha = worksheet.getCell('F5');
    cellLinha.value = `LINHA: ${lineName}`;

    // G5:H5 -> TURNO
    const cellTurno = worksheet.getCell('G5');
    cellTurno.value = `TURNO: ${shiftName}`;

    // I5:L5 -> WEEK
    const cellWeek = worksheet.getCell('I5');
    cellWeek.value = `WEEK: ${weekNum}`;

    // 3. Preencher Itens (Começa linha 7)
    const startRow = 7;
    // O template original tem, digamos, espaço até a linha 28 (22 itens).
    // Se tivermos mais itens, precisamos duplicar linhas para empurrar o rodapé.
    
    // Inserção/Duplicação Dinâmica
    for (let i = 0; i < items.length; i++) {
        const currentRowIdx = startRow + i;
        const item = items[i];
        
        // Se estamos além da linha 28 (exemplo) ou sobrescrevendo linhas existentes, garantimos que a linha existe
        // A estratégia segura é: Para cada item, pegamos a linha atual.
        // Se for o último item do template original (ex: linha 28) e ainda tivermos mais itens, duplicamos a linha 28.
        
        // Vamos simplificar: Se i > 0, duplicamos a linha anterior para herdar o estilo, depois escrevemos.
        // Mas o template já tem linhas vazias. Vamos escrever nas existentes e duplicar se estourar o limite.
        // Assumindo que o rodapé começa na linha 29 (originalmente).
        const footerStartRowOriginal = 29; 
        
        if (currentRowIdx >= footerStartRowOriginal) {
            // Insere nova linha copiando estilos da linha anterior
            worksheet.duplicateRow(currentRowIdx - 1, 1, true);
        }

        const row = worksheet.getRow(currentRowIdx);
        
        // Coluna A: ID
        row.getCell('A').value = i + 1;
        
        // Coluna B: Categoria
        row.getCell('B').value = item.category;
        
        // Coluna C (Mesclada C:E): Texto
        // ExcelJS mantém o valor na célula master da mesclagem (C)
        const cellText = row.getCell('C');
        cellText.value = item.text + (item.evidence ? `\n(Ref: ${item.evidence})` : '');
        cellText.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' };

        // Coluna F: Imagem
        if (item.imageUrl) {
            const imageId = workbook.addImage({
                base64: fileToBase64Clean(item.imageUrl),
                extension: 'png',
            });
            worksheet.addImage(imageId, {
                tl: { col: 5, row: currentRowIdx - 1 } as any, // Col F (index 5)
                br: { col: 6, row: currentRowIdx } as any,
                editAs: 'oneCell'
            });
        }

        // Colunas G até L (Dias da Semana: Seg(1) a Sab(6))
        // Mapeamento: G=Seg(1), H=Ter(2), ... L=Sab(6)
        for (let day = 1; day <= 6; day++) {
            const colIndex = 7 + (day - 1); // 7=G
            const cell = row.getCell(colIndex);
            
            const log = logsByDay[day];
            const val = log?.data[item.id] || '';
            
            cell.value = val;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Cores
            if (val === 'OK') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }; // Verde
            } else if (val === 'NG') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Vermelho
            } else if (val === 'N/A') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Amarelo
            }
        }
        
        // Ajuste altura se tiver muito texto
        row.height = 45; // Altura fixa confortável para imagens
    }

    // 4. Rodapé (Assinaturas)
    // O rodapé foi empurrado para baixo. Vamos localizá-lo.
    const lastItemRow = startRow + items.length - 1;
    const footerRowIdx = lastItemRow + 1; // Logo após o último item
    
    // Mesclar A até F para "RESPONSÁVEL"
    try {
        // Se houver merge antigo quebrado pela inserção, refazemos
        worksheet.mergeCells(`A${footerRowIdx}:F${footerRowIdx}`);
    } catch(e) {}
    
    const footerLabel = worksheet.getCell(`A${footerRowIdx}`);
    footerLabel.value = "RESPONSÁVEL";
    footerLabel.font = { bold: true, size: 12 };
    footerLabel.alignment = { horizontal: 'right', vertical: 'middle' };
    footerLabel.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };

    // Preencher nomes (G a L)
    for (let day = 1; day <= 6; day++) {
        const colIndex = 7 + (day - 1); // G starts at 7
        const cell = worksheet.getCell(footerRowIdx, colIndex);
        const log = logsByDay[day];
        
        if (log) {
            // Nome + Matrícula
            const firstName = log.userName.split(' ')[0];
            const lastName = log.userName.split(' ').pop();
            cell.value = `${firstName} ${lastName}\n(${log.userId})`;
        } else {
            cell.value = "";
        }

        // Estilo Diagonal
        cell.alignment = { textRotation: 45, vertical: 'bottom', horizontal: 'center', wrapText: true };
        cell.font = { size: 9 };
        cell.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
    }
    
    // Ajustar altura do rodapé para caber o texto inclinado
    worksheet.getRow(footerRowIdx).height = 60;

    return await workbook.xlsx.writeBuffer();
};

// --- EXPORT PARADA DE LINHA (Mantido igual, apenas importado para o app não quebrar) ---
export const exportLineStopToExcel = async (log: ChecklistLog) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Parada');
    const data = log.data as LineStopData;
    
    worksheet.columns = [{ header: 'Parada de Linha', key: 'id', width: 30 }];
    worksheet.addRow([`Modelo: ${data.model}`]);
    worksheet.addRow([`Motivo: ${data.motivo}`]);
    worksheet.addRow([`Linha: ${data.line}`]);
    worksheet.addRow([`Setor: ${data.responsibleSector}`]);
    worksheet.addRow([`Data: ${new Date(log.date).toLocaleString()}`]);
    if(data.justification) {
        worksheet.addRow([`Justificativa: ${data.justification}`]);
        worksheet.addRow([`Justificado por: ${data.justifiedBy}`]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='Parada.xlsx'; a.click();
}

// --- EXPORT ATA DE REUNIÃO (REFATORADO) ---
export const exportMeetingToExcel = async (meeting: MeetingLog) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ata de Reunião');

    // Título (A1:H1) - Tamanho 11
    worksheet.mergeCells('A1:H1');
    const title = worksheet.getCell('A1');
    title.value = `ATA DE REUNIÃO: ${meeting.title || 'Sem Título'}`;
    title.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Azul
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 25;

    // Info Header (Com Horários)
    worksheet.mergeCells('A2:H2');
    const startTime = meeting.startTime || '--:--';
    const endTime = meeting.endTime || '--:--';
    
    worksheet.getCell('A2').value = `DATA: ${new Date(meeting.date).toLocaleDateString()} | INÍCIO: ${startTime} | TÉRMINO: ${endTime} | CRIADO POR: ${meeting.createdBy}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A2').font = { size: 10, bold: true };
    worksheet.getRow(2).height = 20;

    worksheet.getRow(3).height = 10; // Spacer

    // Foto (A4:H15)
    worksheet.mergeCells('A4:H15');
    const photoPlace = worksheet.getCell('A4');
    photoPlace.value = "FOTO DA REUNIÃO"; // Fallback text
    photoPlace.alignment = { vertical: 'top', horizontal: 'center' };
    photoPlace.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

    if (meeting.photoUrl) {
         const base64Clean = fileToBase64Clean(meeting.photoUrl);
         const imageId = workbook.addImage({
            base64: base64Clean,
            extension: 'png',
         });
         
         // Forçar imagem dentro da célula mesclada
         worksheet.addImage(imageId, {
            tl: { col: 0, row: 3 } as any, // A4 (0-indexed: col 0, row 3)
            br: { col: 8, row: 15 } as any, // H15 (col 8 exclusive?, row 15 exclusive)
            editAs: 'oneCell' // Importante para não mover
         });
    }

    // Participantes
    worksheet.mergeCells('A16:H16');
    worksheet.getCell('A16').value = "PARTICIPANTES PRESENTES";
    worksheet.getCell('A16').font = { bold: true, size: 10 };
    worksheet.getCell('A16').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    worksheet.getCell('A16').border = { top: {style:'thin'}, bottom: {style:'thin'} };

    let currentRow = 17;
    // Lista em duas colunas se tiver muitos
    const pLen = meeting.participants.length;
    for(let i=0; i<pLen; i++) {
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `• ${meeting.participants[i]}`;
        currentRow++;
    }

    currentRow++;
    
    // Assuntos
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = "ASSUNTOS TRATADOS / PAUTA";
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 10 };
    worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    worksheet.getCell(`A${currentRow}`).border = { top: {style:'thin'}, bottom: {style:'thin'} };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:H${currentRow+10}`);
    const topicsCell = worksheet.getCell(`A${currentRow}`);
    topicsCell.value = meeting.topics;
    topicsCell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
    topicsCell.border = { bottom: {style:'thin'} };
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ATA_${meeting.title.replace(/\s+/g, '_')}_${meeting.date.substring(0,10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

// Wrapper legado
export const exportLogToExcel = async (log: ChecklistLog, items: ChecklistItem[]) => {
    if (log.type === 'LINE_STOP') {
        return exportLineStopToExcel(log);
    }
    // Fallback para download individual (apenas dados, sem template complexo, ou redireciona)
    alert("Para checklist de liderança, use o botão 'Baixar Planilha' na tela de Auditoria > Linhas para obter o relatório semanal completo com template.");
}

export const generateAndSaveBackup = async (line: string, shift: string, date: Date, items: ChecklistItem[]) => {
    // Mesma lógica do download, mas envia pro server
    const allLogs = await getLogs();
    const allUsers = await getAllUsers();
    try {
        const buffer = await generateChecklistFromTemplate(line, shift, date, items, allLogs, allUsers);
        // Converter buffer para base64 para enviar via JSON
        const blob = new Blob([buffer]);
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const week = getWeekNumber(date);
                const fileName = `BACKUP_${line}_T${shift}_W${week}_${date.getFullYear()}.xlsx`;
                await saveBackupToServer(fileName, base64data);
                resolve(true);
            };
            reader.readAsDataURL(blob);
        });
    } catch(e) { console.error(e); throw e; }
};
