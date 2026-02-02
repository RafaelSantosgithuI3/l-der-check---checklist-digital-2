
/**
 * LÍDER CHECK - BACKEND V9.2 (Scrap Module Added)
 * Autor: Senior Software Architect
 */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const os = require('os');

const app = express();
const PORT = 3000;
const SALT_ROUNDS = 10;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Database Setup
const dbPath = './lidercheck.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro Crítico DB:", err.message);
});

// --- FUNÇÕES AUXILIARES (Promisified) ---
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// --- INICIALIZAÇÃO E MIGRAÇÃO ---
const initDatabase = async () => {
    try {
        // 1. Users
        await dbRun(`CREATE TABLE IF NOT EXISTS users (
            matricula TEXT PRIMARY KEY,
            name TEXT,
            role TEXT,
            shift TEXT,
            email TEXT,
            password TEXT,
            is_admin INTEGER DEFAULT 0
        )`);

        // 2. Logs Líder (Com Snapshot)
        await dbRun(`CREATE TABLE IF NOT EXISTS logs_lider (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            user_role TEXT,
            line TEXT,
            date TEXT,
            items_count INTEGER,
            ng_count INTEGER,
            observation TEXT,
            data TEXT,
            items_snapshot TEXT
        )`);
        
        // 3. Logs Manutenção (Com Snapshot)
        await dbRun(`CREATE TABLE IF NOT EXISTS logs_manutencao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            user_role TEXT,
            line TEXT,
            date TEXT,
            items_count INTEGER,
            ng_count INTEGER,
            observation TEXT,
            data TEXT,
            maintenance_target TEXT,
            items_snapshot TEXT
        )`);

        // 4. Config Items
        await dbRun(`CREATE TABLE IF NOT EXISTS items_lider (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            text TEXT,
            evidence TEXT,
            image_url TEXT
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS items_manutencao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            text TEXT,
            evidence TEXT,
            image_url TEXT
        )`);

        // 5. Line Stops
        await dbRun(`CREATE TABLE IF NOT EXISTS line_stops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            user_role TEXT,
            line TEXT,
            date TEXT,
            status TEXT,
            data TEXT,
            signed_doc_url TEXT
        )`);

        // 6. Configs Gerais
        await dbRun(`CREATE TABLE IF NOT EXISTS config_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, line TEXT)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS config_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT)`);
        
        await dbRun(`CREATE TABLE IF NOT EXISTS config_models (name TEXT PRIMARY KEY)`); 
        await dbRun(`CREATE TABLE IF NOT EXISTS config_stations (name TEXT PRIMARY KEY)`); 
        await dbRun(`CREATE TABLE IF NOT EXISTS config_permissions (role TEXT, module TEXT, allowed INTEGER, PRIMARY KEY (role, module))`);
        
        // 7. Meetings
        await dbRun(`CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, title TEXT, date TEXT, start_time TEXT, end_time TEXT, photo_url TEXT, participants TEXT, topics TEXT, created_by TEXT)`);

        // 8. SCRAP MODULE TABLES
        await dbRun(`CREATE TABLE IF NOT EXISTS scraps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            data TEXT,
            horario TEXT,
            semana INTEGER,
            turno TEXT,
            lider TEXT,
            pqc TEXT,
            modelo TEXT,
            qty INTEGER,
            item TEXT,
            status TEXT,
            codigo TEXT,
            descricao TEXT,
            v_un REAL,
            valor_ttl REAL,
            modelo_usado TEXT,
            responsavel TEXT,
            estacao TEXT,
            motivo TEXT,
            causa_raiz TEXT,
            contra_medida TEXT
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS materials (
            code TEXT PRIMARY KEY,
            description TEXT,
            unit_price REAL,
            model_ref TEXT
        )`);

        // --- MIGRATIONS ---
        const addColumn = async (table, col, type) => {
            try { await dbRun(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch(e) {}
        };

        await addColumn('line_stops', 'user_role', 'TEXT');
        await addColumn('line_stops', 'status', 'TEXT');
        await addColumn('line_stops', 'user_id', 'TEXT'); 
        await addColumn('line_stops', 'user_name', 'TEXT');
        await addColumn('line_stops', 'signed_doc_url', 'TEXT');
        await addColumn('logs_lider', 'items_snapshot', 'TEXT');
        await addColumn('logs_manutencao', 'items_snapshot', 'TEXT');

        // Seed Admin
        const adminExists = await dbGet("SELECT matricula FROM users WHERE matricula = 'admin'");
        if (!adminExists) {
            const hash = await bcrypt.hash('admin', SALT_ROUNDS);
            await dbRun(`INSERT INTO users (matricula, name, role, shift, email, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['admin', 'Admin Local', 'Admin', '1', 'admin@local.com', hash, 1]);
        }

        // Seed Materials (Exemplo para Autocomplete)
        const materialsExist = await dbGet("SELECT count(*) as count FROM materials");
        if (materialsExist.count === 0) {
            const seedMats = [
                ['GH98-45678A', 'BATERIA LI-ION 5000MAH', 15.50, 'GALAXY A14'],
                ['GH97-12345B', 'DISPLAY LCD TOUCH COMPLETO', 45.00, 'GALAXY A14'],
                ['GH59-99887C', 'CABO USB-C BRANCO', 2.10, 'GERAL'],
                ['GH63-11223D', 'BACK COVER AZUL', 8.75, 'GALAXY A14'],
                ['GH96-55443E', 'PCI MAINBOARD 128GB', 120.00, 'GALAXY S23'],
                ['GH98-11223F', 'CAMERA MODULE REAR 50MP', 35.00, 'GALAXY S23']
            ];
            for (const m of seedMats) {
                await dbRun("INSERT INTO materials (code, description, unit_price, model_ref) VALUES (?, ?, ?, ?)", m);
            }
        }

    } catch (error) {
        console.error("❌ Erro fatal DB:", error);
    }
};

initDatabase();

// --- ROTAS ---

app.post('/api/login', async (req, res) => {
    const { matricula, password } = req.body;
    try {
        const user = await dbGet("SELECT * FROM users WHERE matricula = ?", [matricula]);
        if (!user) return res.status(401).json({ error: "Usuário não encontrado" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Senha incorreta" });
        delete user.password; 
        user.isAdmin = !!user.is_admin;
        res.json({ user });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/register', async (req, res) => {
    const { matricula, name, role, shift, email, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await dbRun(`INSERT INTO users (matricula, name, role, shift, email, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [matricula, name, role, shift, email, hash]);
        res.json({ message: "Criado" });
    } catch (e) { res.status(400).json({ error: "Erro cadastro" }); }
});

app.post('/api/recover', async (req, res) => {
    const { matricula, email, name, newPassword } = req.body;
    try {
        const user = await dbGet(
            "SELECT * FROM users WHERE LOWER(TRIM(matricula)) = LOWER(TRIM(?)) AND LOWER(TRIM(email)) = LOWER(TRIM(?)) AND LOWER(TRIM(name)) = LOWER(TRIM(?))", 
            [matricula, email, name]
        );
        if (!user) return res.status(401).json({ error: "Dados incorretos" });
        const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await dbRun("UPDATE users SET password = ? WHERE matricula = ?", [hash, user.matricula]);
        res.json({ message: "Senha atualizada" });
    } catch (e) { res.status(500).json({ error: "Erro servidor" }); }
});

app.put('/api/users', async (req, res) => {
    const { matricula, name, role, shift, email, password, isAdmin, originalMatricula } = req.body;
    const target = originalMatricula || matricula;
    try {
        let sql = `UPDATE users SET matricula=?, name=?, role=?, shift=?, email=?, is_admin=?`;
        let params = [matricula, name, role, shift, email, isAdmin?1:0];
        if (password && password !== '******') {
            sql += `, password=?`;
            params.push(await bcrypt.hash(password, SALT_ROUNDS));
        }
        sql += ` WHERE matricula=?`;
        params.push(target);
        await dbRun(sql, params);
        res.json({ message: "Atualizado" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await dbAll("SELECT * FROM users");
        res.json(users.map(u => ({ ...u, password: '******', isAdmin: !!u.is_admin })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try { await dbRun("DELETE FROM users WHERE matricula = ?", [req.params.id]); res.json({message: "Deletado"}); } catch (e) { res.status(500).json({error: e.message}); }
});

// LOGS
app.get('/api/logs', async (req, res) => {
    try {
        const liderLogs = await dbAll("SELECT *, 'PRODUCTION' as type_marker FROM logs_lider ORDER BY date DESC LIMIT 500");
        const maintLogs = await dbAll("SELECT *, 'MAINTENANCE' as type_marker FROM logs_manutencao ORDER BY date DESC LIMIT 500");
        const allLogs = [...liderLogs, ...maintLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const response = allLogs.map(r => {
            let parsedData = {};
            let parsedSnapshot = [];
            try { parsedData = JSON.parse(r.data); } catch(e) {}
            try { parsedSnapshot = JSON.parse(r.items_snapshot || '[]'); } catch(e) {}

            return {
                id: r.id.toString(),
                userId: r.user_id,
                userName: r.user_name,
                userRole: r.user_role,
                line: r.line,
                date: r.date,
                itemsCount: r.items_count,
                ngCount: r.ng_count,
                observation: r.observation,
                data: parsedData.answers || parsedData,
                evidenceData: parsedData.evidence || {},
                type: r.type_marker,
                maintenanceTarget: r.maintenance_target || parsedData.maintenanceTarget,
                itemsSnapshot: parsedSnapshot
            };
        });
        res.json(response);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logs', async (req, res) => {
    const { userId, userName, userRole, line, date, itemsCount, ngCount, observation, data, evidenceData, type, maintenanceTarget, itemsSnapshot } = req.body;
    const storageObject = { answers: data, evidence: evidenceData, type: type || 'PRODUCTION', maintenanceTarget };
    
    // Serialização explícita
    const dataStr = JSON.stringify(storageObject);
    const snapshotStr = itemsSnapshot ? JSON.stringify(itemsSnapshot) : '[]';

    try {
        if (type === 'MAINTENANCE') {
            await dbRun(`INSERT INTO logs_manutencao (user_id, user_name, user_role, line, date, items_count, ng_count, observation, data, maintenance_target, items_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, userName, userRole, line, date, items_count, ng_count, observation, dataStr, maintenanceTarget, snapshotStr]);
        } else {
            await dbRun(`INSERT INTO logs_lider (user_id, user_name, user_role, line, date, items_count, ng_count, observation, data, items_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, userName, userRole, line, date, items_count, ng_count, observation, dataStr, snapshotStr]);
        }
        res.json({ message: "Salvo" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ITEMS
app.get('/api/config/items', async (req, res) => {
    try {
        const lider = await dbAll("SELECT *, 'LEADER' as type FROM items_lider");
        const maint = await dbAll("SELECT *, 'MAINTENANCE' as type FROM items_manutencao");
        res.json([...lider, ...maint].map(r => ({ id: r.id.toString(), category: r.category, text: r.text, evidence: r.evidence, imageUrl: r.image_url, type: r.type })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config/items', async (req, res) => {
    const { items } = req.body;
    try {
        await dbRun("BEGIN TRANSACTION");
        await dbRun("DELETE FROM items_lider");
        await dbRun("DELETE FROM items_manutencao");
        for (const i of items) {
            if (i.type === 'MAINTENANCE') await dbRun("INSERT INTO items_manutencao (category, text, evidence, image_url) VALUES (?, ?, ?, ?)", [i.category, i.text, i.evidence||'', i.imageUrl||'']);
            else await dbRun("INSERT INTO items_lider (category, text, evidence, image_url) VALUES (?, ?, ?, ?)", [i.category, i.text, i.evidence||'', i.imageUrl||'']);
        }
        await dbRun("COMMIT");
        res.json({ message: "Salvo" });
    } catch (e) { await dbRun("ROLLBACK"); res.status(500).json({ error: e.message }); }
});

// LINE STOPS
app.get('/api/line-stops', async (req, res) => {
    try {
        const stops = await dbAll("SELECT * FROM line_stops ORDER BY date DESC LIMIT 500");
        res.json(stops.map(r => {
            let parsed = {};
            try { parsed = JSON.parse(r.data); } catch(e) { parsed = {}; }
            const safeId = r.id ? r.id.toString() : `temp_${Math.random().toString(36).substr(2, 9)}`;
            return { 
                ...r, 
                id: safeId, 
                type: 'LINE_STOP', 
                data: parsed, 
                signedDocUrl: r.signed_doc_url,
                itemsCount: 0, 
                ngCount: 0, 
                observation: '' 
            };
        }));
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/line-stops', async (req, res) => {
    const { id, userId, userName, userRole, line, date, status, data, signedDocUrl } = req.body;
    const dataStr = typeof data === 'object' ? JSON.stringify(data) : data;
    const finalStatus = status || 'WAITING_JUSTIFICATION';
    const finalSignedDoc = signedDocUrl || null;

    try {
        let recordExists = false;
        if (id) {
            const existingRow = await dbGet("SELECT id FROM line_stops WHERE id = ?", [id]);
            if (existingRow) recordExists = true;
        }

        if (recordExists) {
            await dbRun(`UPDATE line_stops SET line=?, status=?, data=?, signed_doc_url=? WHERE id=?`, [line, finalStatus, dataStr, finalSignedDoc, id]);
        } else {
            const newId = id || Date.now().toString();
            await dbRun(`INSERT INTO line_stops (id, user_id, user_name, user_role, line, date, status, data, signed_doc_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [newId, userId, userName, userRole, line, date, finalStatus, dataStr, finalSignedDoc]);
        }
        res.json({ message: "Salvo com sucesso" });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- CONFIGS: ROLES & LINES (ESPECÍFICAS) ---

// Roles
app.get('/api/config/roles', async (req, res) => {
    try {
        const rows = await dbAll("SELECT id, role as name FROM config_roles");
        res.json(rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/config/roles', async (req, res) => {
    const { name } = req.body; 
    try {
        await dbRun("INSERT INTO config_roles (role) VALUES (?)", [name]);
        res.json({message: "Cargo salvo"});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/config/roles/:id', async (req, res) => {
    try {
        await dbRun("DELETE FROM config_roles WHERE id = ?", [req.params.id]);
        res.json({message: "Cargo deletado"});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// Lines
app.get('/api/config/lines', async (req, res) => {
    try {
        const rows = await dbAll("SELECT id, line as name FROM config_lines");
        res.json(rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/config/lines', async (req, res) => {
    const { name } = req.body; 
    try {
        await dbRun("INSERT INTO config_lines (line) VALUES (?)", [name]);
        res.json({message: "Linha salva"});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.delete('/api/config/lines/:id', async (req, res) => {
    try {
        await dbRun("DELETE FROM config_lines WHERE id = ?", [req.params.id]);
        res.json({message: "Linha deletada"});
    } catch(e) { res.status(500).json({error: e.message}); }
});


// --- CONFIGS GENÉRICAS (Models, Stations) ---
const createConfigRoutes = (tableName, pathName) => {
    app.get(`/api/config/${pathName}`, async (req, res) => {
        try { res.json(await dbAll(`SELECT * FROM ${tableName}`)); } catch(e) { res.status(500).json({error: e.message}); }
    });
    app.post(`/api/config/${pathName}`, async (req, res) => {
        const { items } = req.body;
        try {
            await dbRun("BEGIN TRANSACTION");
            await dbRun(`DELETE FROM ${tableName}`);
            for(const item of items) await dbRun(`INSERT INTO ${tableName} (name) VALUES (?)`, [item]);
            await dbRun("COMMIT");
            res.json({message: "Salvo"});
        } catch(e) { await dbRun("ROLLBACK"); res.status(500).json({error: e.message}); }
    });
};

createConfigRoutes('config_models', 'models');
createConfigRoutes('config_stations', 'stations');

app.get('/api/config/permissions', async (req, res) => {
    try { const rows = await dbAll("SELECT * FROM config_permissions"); res.json(rows.map(r => ({ role: r.role, module: r.module, allowed: r.allowed === 1 }))); } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/config/permissions', async (req, res) => {
    const { permissions } = req.body;
    try {
        await dbRun("BEGIN TRANSACTION");
        await dbRun("DELETE FROM config_permissions");
        for (const p of permissions) await dbRun("INSERT INTO config_permissions (role, module, allowed) VALUES (?, ?, ?)", [p.role, p.module, p.allowed ? 1 : 0]);
        await dbRun("COMMIT");
        res.json({message: "Salvo"});
    } catch(e) { await dbRun("ROLLBACK"); res.status(500).json({error: e.message}); }
});

// MEETINGS
app.get('/api/meetings', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM meetings ORDER BY date DESC");
        res.json(rows.map(r => ({
            id: r.id,
            title: r.title,
            date: r.date,
            startTime: r.start_time,
            endTime: r.end_time,
            photoUrl: r.photo_url,
            participants: JSON.parse(r.participants || '[]'),
            topics: r.topics,
            createdBy: r.created_by
        })));
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/meetings', async (req, res) => {
    const { id, title, date, startTime, endTime, photoUrl, participants, topics, createdBy } = req.body;
    try {
        await dbRun(`INSERT INTO meetings (id, title, date, start_time, end_time, photo_url, participants, topics, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title || '', date, startTime, endTime, photoUrl, JSON.stringify(participants), topics, createdBy]);
        res.json({message: "Ata Salva"});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// --- SCRAP MODULE ENDPOINTS ---

app.get('/api/scraps', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM scraps ORDER BY date DESC, id DESC LIMIT 1000");
        res.json(rows.map(r => ({
            id: r.id.toString(),
            userId: r.user_id,
            data: r.data,
            horario: r.horario,
            semana: r.semana,
            turno: r.turno,
            lider: r.lider,
            pqc: r.pqc,
            modelo: r.modelo,
            qty: r.qty,
            item: r.item,
            status: r.status,
            codigo: r.codigo,
            descricao: r.descricao,
            valorUn: r.v_un,
            valorTotal: r.valor_ttl,
            modeloUsado: r.modelo_usado,
            responsavel: r.responsavel,
            estacao: r.estacao,
            motivo: r.motivo,
            causaRaiz: r.causa_raiz,
            contraMedida: r.contra_medida
        })));
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.post('/api/scraps', async (req, res) => {
    const { userId, data, horario, semana, turno, lider, pqc, modelo, qty, item, status, codigo, descricao, valorUn, valorTotal, modeloUsado, responsavel, estacao, motivo, causaRaiz, contraMedida } = req.body;
    try {
        await dbRun(`INSERT INTO scraps (user_id, data, horario, semana, turno, lider, pqc, modelo, qty, item, status, codigo, descricao, v_un, valor_ttl, modelo_usado, responsavel, estacao, motivo, causa_raiz, contra_medida) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                     [userId, data, horario, semana, turno, lider, pqc, modelo, qty, item, status, codigo, descricao, valorUn, valorTotal, modeloUsado, responsavel, estacao, motivo, causaRaiz, contraMedida || null]);
        res.json({message: "Scrap salvo"});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.put('/api/scraps/:id/countermeasure', async (req, res) => {
    const { contraMedida } = req.body;
    try {
        await dbRun("UPDATE scraps SET contra_medida = ? WHERE id = ?", [contraMedida, req.params.id]);
        res.json({message: "Contra Medida Salva"});
    } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/materials', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM materials");
        res.json(rows.map(r => ({
            code: r.code,
            description: r.description,
            unitPrice: r.unit_price,
            modelRef: r.model_ref
        })));
    } catch(e) { res.status(500).json({error: e.message}); }
});

// FILES & BACKUP
app.post('/api/backup/save', (req, res) => {
    const { fileName, fileData } = req.body;
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);
    const filePath = path.join(backupsDir, fileName);
    const base64Data = fileData.split(';base64,').pop();
    fs.writeFile(filePath, base64Data, {encoding: 'base64'}, (err) => {
        if (err) return res.status(500).json({error: "Erro no servidor"});
        res.json({message: "Salvo", path: filePath});
    });
});

app.get('/api/admin/backup', (req, res) => {
    if (fs.existsSync(dbPath)) res.download(dbPath, 'lidercheck_backup.db');
    else res.status(404).json({ error: "DB não encontrado" });
});

// STATIC SERVER
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
    const indexFile = path.join(distPath, 'index.html');
    if (fs.existsSync(indexFile)) res.sendFile(indexFile);
    else res.send('Frontend não buildado (npm run build).');
});

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ SERVIDOR RODANDO! (Horário do Servidor: ${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus' })})`);
    console.log(`⚠️ Nota: O App usa Horário de Manaus (-4) para funcionar.`);
    console.log(`--------------------------------------------------`);
    console.log(`💻 ACESSO LOCAL:     http://localhost:${PORT}`);
    console.log(`📱 ACESSO NA REDE:   http://${getLocalIp()}:${PORT}`);
    console.log(`--------------------------------------------------`);
    console.log(`Conectado ao banco de dados SQLite local.`);
});
