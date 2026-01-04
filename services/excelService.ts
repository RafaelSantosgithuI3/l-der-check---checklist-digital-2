
import ExcelJS from 'exceljs';
import { ChecklistData, User, ChecklistItem, ChecklistLog, MeetingLog, LineStopData } from '../types';
import { getLogs, getLogsByWeekSyncStrict, saveBackupToServer } from './storageService';
import { getAllUsers } from './authService';

// Função para backup no servidor (Admin)
export const generateAndSaveBackup = async (
    line: string, 
    shift: string, 
    date: Date, 
    items: ChecklistItem[]
) => {
    const allLogs = await getLogs();
    const allUsers = await getAllUsers(); // Necessário para checar turnos

    // Gerar buffer
    const buffer = await createExcelBuffer(line, shift, date, items, allLogs, allUsers);
    
    // Converter para Base64
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
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Função para download no cliente (Botão Linhas)
export const downloadShiftExcel = async (
    line: string,
    shift: string,
    dateStr: string, // YYYY-WW format or date string
    items: ChecklistItem[]
) => {
    // Converter string de semana/data para objeto Date
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

// Lógica original para exportação de UM log individual (Dashboard Pessoal / Histórico)
export const exportLogToExcel = async (log: ChecklistLog, items: ChecklistItem[]) => {
    if (log.type === 'LINE_STOP') {
        return exportLineStopToExcel(log);
    }

    const user: User = {
        name: log.userName,
        matricula: log.userId,
        role: log.userRole,
        shift: '', 
        email: ''
    };
    const allLogs = await getLogs();
    const allUsers = await getAllUsers();
    
    // Tenta descobrir o turno deste usuário específico
    const fullUser = allUsers.find(u => u.matricula === log.userId);
    const shift = fullUser ? fullUser.shift : '2'; // Fallback

    exportToExcelLegacy(log, user, items, allLogs, shift || '2', allUsers);
}

// --- EXPORT PARADA DE LINHA (LAYOUT COMPLEXO) ---
export const exportLineStopToExcel = async (log: ChecklistLog) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Parada de Linha');
    const data = log.data as LineStopData;

    // Configuração de Colunas (10 colunas A-J)
    worksheet.columns = [
        { key: 'A', width: 15 }, { key: 'B', width: 12 },
        { key: 'C', width: 12 }, { key: 'D', width: 12 },
        { key: 'E', width: 12 }, { key: 'F', width: 12 },
        { key: 'G', width: 12 }, { key: 'H', width: 12 },
        { key: 'I', width: 12 }, { key: 'J', width: 12 }
    ];

    // Helper Style
    const borderAll: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const centerStyle: Partial<ExcelJS.Style> = {
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
    };
    const boldFont = { bold: true, name: 'Arial', size: 10 };

    // 1. TÍTULO (A1:J1)
    worksheet.mergeCells('A1:J1');
    const title = worksheet.getCell('A1');
    title.value = "EXPRESSO DE PARADA DE LINHA";
    title.font = { name: 'Arial', size: 16, bold: true };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.border = borderAll;

    // 2. CABEÇALHO DADOS (Linhas 2 e 3 - Blocos Mesclados)
    // MODELO (A2:B3)
    worksheet.mergeCells('A2:B3');
    const cellModelo = worksheet.getCell('A2');
    cellModelo.value = `MODELO:\n${data.model || ''}`;
    cellModelo.border = borderAll; cellModelo.alignment = centerStyle.alignment; cellModelo.font = boldFont;

    // DATA (C2:D3)
    worksheet.mergeCells('C2:D3');
    const cellData = worksheet.getCell('C2');
    cellData.value = `DATA:\n${new Date(log.date).toLocaleDateString()}`;
    cellData.border = borderAll; cellData.alignment = centerStyle.alignment; cellData.font = boldFont;

    // TURNO (E2:F3)
    worksheet.mergeCells('E2:F3');
    const cellTurno = worksheet.getCell('E2');
    // Extract Shift from role string if appended or try to guess
    let shiftDisplay = '?';
    if(log.userRole.toLowerCase().includes('turno')) {
        shiftDisplay = log.userRole.split('Turno')[1].trim();
    }
    cellTurno.value = `TURNO:\n${shiftDisplay}`; 
    cellTurno.border = borderAll; cellTurno.alignment = centerStyle.alignment; cellTurno.font = boldFont;

    // LÍDER (G2:H3)
    worksheet.mergeCells('G2:H3');
    const cellLider = worksheet.getCell('G2');
    cellLider.value = `LÍDER:\n${log.userName}`;
    cellLider.border = borderAll; cellLider.alignment = centerStyle.alignment; cellLider.font = boldFont;

    // CLIENTE (I2:J3)
    worksheet.mergeCells('I2:J3');
    const cellCliente = worksheet.getCell('I2');
    cellCliente.value = `CLIENTE:\n${data.client || ''}`;
    cellCliente.border = borderAll; cellCliente.alignment = centerStyle.alignment; cellCliente.font = boldFont;

    // 3. DADOS TÉCNICOS (Linha 4)
    worksheet.mergeCells('A4:B4');
    worksheet.getCell('A4').value = `INICIO: ${data.startTime}`;
    worksheet.getCell('A4').border = borderAll;
    
    worksheet.mergeCells('C4:D4');
    worksheet.getCell('C4').value = `TERMINO: ${data.endTime}`;
    worksheet.getCell('C4').border = borderAll;

    worksheet.mergeCells('E4:F4');
    worksheet.getCell('E4').value = `LINHA PARADA: ${data.line}`;
    worksheet.getCell('E4').border = borderAll;

    worksheet.mergeCells('G4:H4');
    worksheet.getCell('G4').value = `FASE: ${data.phase}`;
    worksheet.getCell('G4').border = borderAll;

    worksheet.mergeCells('I4:J4');
    worksheet.getCell('I4').value = `PERCA PROD: ${data.productionLoss || ''}`;
    worksheet.getCell('I4').border = borderAll;

    // 4. DADOS TÉCNICOS (Linha 5)
    worksheet.mergeCells('A5:B5');
    worksheet.getCell('A5').value = `TEMPO PADRÃO: ${data.standardTime}`;
    worksheet.getCell('A5').border = borderAll;

    worksheet.mergeCells('C5:D5');
    worksheet.getCell('C5').value = `QTDE PESSOAS: ${data.peopleStopped}`;
    worksheet.getCell('C5').border = borderAll;
    
    worksheet.mergeCells('E5:J5'); // Espaço vazio 
    worksheet.getCell('E5').value = ""; 
    worksheet.getCell('E5').border = borderAll;

    // 5. POSTO E TOTAL (Linha 6)
    worksheet.mergeCells('A6:F6');
    worksheet.getCell('A6').value = `POSTO PARADO:  ${data.stationStart}   ATÉ   ${data.stationEnd}`;
    worksheet.getCell('A6').border = borderAll;
    worksheet.getCell('A6').font = { bold: true };

    worksheet.mergeCells('G6:J6');
    worksheet.getCell('G6').value = `TOTAL HORAS PARADAS: ${data.totalTime}`;
    worksheet.getCell('G6').border = borderAll;
    worksheet.getCell('G6').font = { bold: true, color: { argb: 'FFFF0000' } }; // Red

    // 6. MOTIVO / DETALHAMENTO (Separated Row 7 Header, Row 8 Content)
    // ROW 7: HEADER
    worksheet.mergeCells('A7:J7');
    const motivoHeader = worksheet.getCell('A7');
    motivoHeader.value = "MOTIVO / OCORRÊNCIA:";
    motivoHeader.font = { bold: true };
    motivoHeader.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

    // ROW 8: CONTENT
    worksheet.mergeCells('A8:J8'); 
    const motivoContent = worksheet.getCell('A8');
    motivoContent.value = data.motivo || '';
    motivoContent.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    motivoContent.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    
    // Height for Row 8 (Same as Row 15 ~ 60px)
    worksheet.getRow(8).height = 60;

    // 7. CATEGORIAS DE MOTIVO (Linhas 9 e 10 now shifted down? No, user asked for Row 7/8 specific behavior, implying subsequent rows shift)
    // Row 9 and 10 will hold the Categories.
    
    const categories = [
        { code: 'GQ', label: 'PRODUÇÃO', col: 'A' },
        { code: 'SMD/IAC', label: 'PRÉ-FORMA', col: 'C' },
        { code: 'MANUTENÇÃO', label: 'MATERIAIS', col: 'E' },
        { code: 'PCP', label: 'ÁREA TÉCNICA', col: 'G' },
        { code: 'SAMSUNG', label: 'EXTERNO', col: 'I' }
    ];

    // Cabeçalhos dos motivos starting at Row 9
    categories.forEach((cat, idx) => {
        const cIdx = idx * 2; // 0, 2, 4... (Col A, C, E...)
        // Linha 9
        const cellTop = worksheet.getCell(9, cIdx + 1);
        worksheet.mergeCells(9, cIdx + 1, 9, cIdx + 2);
        
        // Unicode Checkbox logic (☑ / ☐)
        const isCheckedTop = data.responsibleSector === cat.code ? '☑' : '☐';
        cellTop.value = `${isCheckedTop} ${cat.code}`;
        
        cellTop.alignment = centerStyle.alignment;
        cellTop.font = boldFont;
        cellTop.border = borderAll;
        
        // Linha 10
        const cellBot = worksheet.getCell(10, cIdx + 1);
        worksheet.mergeCells(10, cIdx + 1, 10, cIdx + 2);
        
        const isCheckedBot = data.responsibleSector === cat.label ? '☑' : '☐';
        cellBot.value = `${isCheckedBot} ${cat.label}`;
        
        cellBot.alignment = centerStyle.alignment;
        cellBot.font = boldFont;
        cellBot.border = borderAll;
    });

    // 8. JUSTIFICATIVA (Rows 12-15)
    // Let's put Justification at Row 12 header, 13 content
    worksheet.mergeCells('A12:J12');
    const justTitle = worksheet.getCell('A12');
    justTitle.value = "JUSTIFICATIVAS E PRAZOS PARA SOLUÇÃO DEFINITIVA (Preenchimento exclusivo do Responsável):";
    justTitle.font = { bold: true, underline: true };
    justTitle.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

    worksheet.mergeCells('A13:J15'); // Merged block for content
    const justText = worksheet.getCell('A13');
    justText.value = data.justification || "";
    justText.alignment = { vertical: 'top', wrapText: true };
    justText.border = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    
    // 9. ASSINATURAS (Linhas 17-21)
    const signatures = [
        "SETOR RESP.", "SUPERVISOR GERAL", "COORDENADOR", "PCP", "DIRETOR GERAL"
    ];

    signatures.forEach((role, idx) => {
        const cIdx = (idx * 2) + 1; // 1, 3, 5, 7, 9 (Columns)
        
        // Mesclar bloco vertical
        worksheet.mergeCells(17, cIdx, 21, cIdx + 1);
        const cell = worksheet.getCell(17, cIdx);
        cell.value = `\n\n\n____________________\n${role}\nDATA: __/__/____`;
        cell.alignment = { horizontal: 'center', vertical: 'bottom', wrapText: true };
        cell.font = { size: 8, bold: true }; // Smaller font for signature
        cell.border = borderAll;
    });

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ParadaLinha_${log.line}_${log.date.substring(0,10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

// ATA DE REUNIÃO EXPORT
export const exportMeetingToExcel = async (meeting: MeetingLog) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ata de Reunião');

    worksheet.mergeCells('A1:E1');
    const title = worksheet.getCell('A1');
    title.value = `ATA DE REUNIÃO: ${meeting.title || 'Sem Título'}`;
    title.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };

    // Info Header
    worksheet.mergeCells('A2:E2');
    worksheet.getCell('A2').value = `DATA: ${new Date(meeting.date).toLocaleDateString()} | HORÁRIO: ${meeting.startTime}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    
    worksheet.getRow(3).height = 10;

    // Foto
    worksheet.mergeCells('A4:E15');
    const photoPlace = worksheet.getCell('A4');
    photoPlace.value = "FOTO DA REUNIÃO";
    photoPlace.alignment = { vertical: 'top', horizontal: 'center' };
    photoPlace.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

    if (meeting.photoUrl) {
         const base64Clean = meeting.photoUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
         const imageId = workbook.addImage({
            base64: base64Clean,
            extension: 'png',
         });
         worksheet.addImage(imageId, {
            tl: { col: 0, row: 3 }, // A4
            ext: { width: 400, height: 250 },
            editAs: 'oneCell'
         });
    }

    // Participantes
    worksheet.mergeCells('A16:E16');
    worksheet.getCell('A16').value = "PARTICIPANTES";
    worksheet.getCell('A16').font = { bold: true };
    worksheet.getCell('A16').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

    let currentRow = 17;
    meeting.participants.forEach(p => {
        worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `• ${p}`;
        currentRow++;
    });

    currentRow++;
    
    // Assuntos
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = "ASSUNTOS TRATADOS";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:E${currentRow+5}`);
    const topicsCell = worksheet.getCell(`A${currentRow}`);
    topicsCell.value = meeting.topics;
    topicsCell.alignment = { wrapText: true, vertical: 'top' };
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ATA_REUNIAO_${meeting.date}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

// Função CORE que gera o Excel (compartilhada)
const createExcelBuffer = async (
    lineName: string,
    shiftName: string,
    dateObj: Date,
    items: ChecklistItem[],
    allLogs: ChecklistLog[],
    allUsers: User[]
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Checklist');
  
  // Filtra logs estritamente por LINHA, TURNO e DATA(SEMANA)
  const weeklyLogs = getLogsByWeekSyncStrict(allLogs, dateObj, lineName, shiftName, allUsers);
  
  const logsByDay: {[key: number]: ChecklistLog} = {};
  weeklyLogs.forEach(l => {
      const d = new Date(l.date).getDay();
      logsByDay[d] = l;
  });

  const weekNum = getWeekNumber(dateObj);
  const monthName = dateObj.toLocaleString('pt-BR', { month: 'long' }).toUpperCase();
  const yearNum = dateObj.getFullYear();

  // --- CABEÇALHO PADRÃO ---
  
  // Título Principal
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `RELATÓRIO SEMANAL DE CHECKLIST - LIDERANÇA`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Sub-título com Infos (Adicionado ANO)
  worksheet.mergeCells('A2:J2');
  const infoCell = worksheet.getCell('A2');
  infoCell.value = `LINHA: ${lineName} | TURNO: ${shiftName} | SEMANA: ${weekNum} | MÊS: ${monthName} | ANO: ${yearNum}`;
  infoCell.font = { name: 'Arial', size: 11, bold: true };
  infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  infoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

  // Espaçamento
  worksheet.getRow(3).height = 10;

  // --- COLUNAS ---
  worksheet.columns = [
      { key: 'num', width: 6 },     // A: Nº
      { key: 'cat', width: 15 },    // B: Categoria
      { key: 'item', width: 50 },   // C: Item
      { key: 'evid', width: 25 },   // D: Evidência / Imagem
      { key: 'seg', width: 12 },    // E: Seg
      { key: 'ter', width: 12 },    // F: Ter
      { key: 'qua', width: 12 },    // G: Qua
      { key: 'qui', width: 12 },    // H: Qui
      { key: 'sex', width: 12 },    // I: Sex
      { key: 'sab', width: 12 },    // J: Sab
  ];

  // --- CABEÇALHO DA TABELA ---
  const headerRow = worksheet.getRow(4);
  headerRow.values = ['ID', 'CATEGORIA', 'ITEM DE VERIFICAÇÃO', 'EVIDÊNCIA / FOTO', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  headerRow.height = 25;
  
  headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } }; // Dark Gray
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
          top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
      };
  });

  // --- DADOS ---
  let currentRow = 5;

  const centerStyle: Partial<ExcelJS.Style> = {
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
  };
  
  const leftStyle: Partial<ExcelJS.Style> = {
    alignment: { vertical: 'middle', horizontal: 'left', wrapText: true }
  };
  
  for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const row = worksheet.getRow(currentRow);
      
      const sSeg = logsByDay[1]?.data[item.id] || '';
      const sTer = logsByDay[2]?.data[item.id] || '';
      const sQua = logsByDay[3]?.data[item.id] || '';
      const sQui = logsByDay[4]?.data[item.id] || '';
      const sSex = logsByDay[5]?.data[item.id] || '';
      const sSab = logsByDay[6]?.data[item.id] || '';

      let itemText = item.text;
      if (item.evidence && item.evidence.length > 3) {
           itemText += `\n(Ref: ${item.evidence})`;
      }

      // Check if data is LineStopData (shouldn't happen here, but type safety)
      const isString = (val: any) => typeof val === 'string' ? val : '';

      row.values = [
          index + 1,        
          item.category,    
          itemText,        
          '', // Coluna de Evidência (para imagem)
          isString(sSeg), isString(sTer), isString(sQua), isString(sQui), isString(sSex), isString(sSab)
      ];

      // Formatação Base
      row.eachCell((cell, colNum) => {
          cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          
          // Coluna A (Index 1): Fundo Cinza (#4B5563), Texto Branco
          if (colNum === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } };
              cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
              cell.style = centerStyle;
          } 
          // Restante das Colunas (B até J) - Fundo Branco
          else {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Branco
              
              // Estilo de alinhamento
              if (colNum === 2 || colNum === 3) { // Categoria e Item
                  cell.style = leftStyle;
                  cell.font = { color: { argb: 'FF000000' } }; // Preto
              } else {
                  cell.style = centerStyle;
              }

              // Coloração Condicional da LETRA (TEXTO) para colunas D a J (Evidência + Dias)
              // Índices 4 a 10
              if (colNum >= 4 && colNum <= 10) {
                  const val = cell.value?.toString();
                  
                  if (val === 'NG') {
                      cell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Vermelho
                  } else if (val === 'OK') {
                      cell.font = { color: { argb: 'FF008000' }, bold: true }; // Verde
                  } else if (val === 'N/A') {
                      cell.font = { color: { argb: 'FFD4AC0D' }, bold: true }; // Amarelo Escuro (Dourado) para ler no branco
                  } else {
                      cell.font = { color: { argb: 'FF000000' } }; // Preto Padrão
                  }
              }
          }
      });

       // --- INSERÇÃO DA IMAGEM DE REFERÊNCIA ---
      if (item.imageUrl) {
          try {
            // Ajustar altura da linha para caber a imagem
            row.height = 60; 

            // Remover prefixo base64 se existir (data:image/png;base64,...)
            const base64Clean = item.imageUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
            
            const imageId = workbook.addImage({
                base64: base64Clean,
                extension: 'png', 
            });

            // Inserir na coluna D (Evidência), indice 3 (0-based) na API addImage
            worksheet.addImage(imageId, {
                tl: { col: 3, row: currentRow - 1 }, // Coluna D é index 3. Row é 0-based.
                ext: { width: 80, height: 80 },
                editAs: 'oneCell'
            });
          } catch (err) {
              console.error("Erro ao adicionar imagem ao Excel:", err);
          }
      }

      currentRow++;
  }

  // --- RODAPÉ: RESPONSÁVEL ---
  // Listar quem fez o check em cada dia
  currentRow++;
  
  const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const responsibles = [];
  for(let i=1; i<=6; i++) {
      if(logsByDay[i]) responsibles.push(`${daysMap[i]}: ${logsByDay[i].userName}`);
  }

  if (responsibles.length > 0) {
      worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
      const respCell = worksheet.getCell(`A${currentRow}`);
      respCell.value = 'RESPONSÁVEIS: ' + responsibles.join(' | ');
      respCell.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
      respCell.alignment = { horizontal: 'left' };
      respCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Branco
  }
  
  return await workbook.xlsx.writeBuffer();
};

// Wrapper para compatibilidade com o botão "Download" do histórico individual
const exportToExcelLegacy = async (
    currentLog: ChecklistLog,
    user: User, 
    items: ChecklistItem[],
    allLogs: ChecklistLog[],
    shift: string,
    allUsers: User[]
) => {
    const dateObj = new Date(currentLog.date);
    const line = currentLog.line || 'TP_TNP_03';
    
    const buffer = await createExcelBuffer(line, shift, dateObj, items, allLogs, allUsers);

    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Checklist_${line}_Legacy.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
