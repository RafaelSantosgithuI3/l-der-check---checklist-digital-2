/**
 * LÍDER CHECK - BACKEND V2.2 (Gestão Centralizada & Melhorias)
 * Autor: Senior Full Stack Engineer
 */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt'); // Segurança
const os = require('os'); // Adicionado para exibir IP

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
    // Mensagem de conexão movida para o listen para ficar junto
});

// --- CONSTANTES DO SISTEMA ---
const MODULES = ['CHECKLIST', 'MEETING', 'MAINTENANCE', 'AUDIT', 'ADMIN', 'LINE_STOP', 'MANAGEMENT'];

// --- FUNÇÕES AUXILIARES DE BANCO (Promisified) ---
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
        // 1. Tabela de Usuários
        await dbRun(`CREATE TABLE IF NOT EXISTS users (
            matricula TEXT PRIMARY KEY,
            name TEXT,
            role TEXT,
            shift TEXT,
            email TEXT,
            password TEXT,
            is_admin INTEGER DEFAULT 0
        )`);

        // 2. Tabelas de Logs
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
            data TEXT
        )`);
        await dbRun("CREATE INDEX IF NOT EXISTS idx_logs_lider_date ON logs_lider(date)");

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
            maintenance_target TEXT
        )`);
        await dbRun("CREATE INDEX IF NOT EXISTS idx_logs_maint_date ON logs_manutencao(date)");

        // 3. Tabelas de Itens
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

        // 4. Paradas de Linha
        await dbRun(`CREATE TABLE IF NOT EXISTS line_stops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            user_name TEXT,
            user_role TEXT,
            line TEXT,
            date TEXT,
            status TEXT,
            data TEXT
        )`);

        // 5. Configurações (Gestão)
        await dbRun(`CREATE TABLE IF NOT EXISTS config_lines (name TEXT PRIMARY KEY)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS config_roles (name TEXT PRIMARY KEY)`);
        await dbRun(`CREATE TABLE IF NOT EXISTS config_models (name TEXT PRIMARY KEY)`); // Novo
        await dbRun(`CREATE TABLE IF NOT EXISTS config_stations (name TEXT PRIMARY KEY)`); // Novo
        await dbRun(`CREATE TABLE IF NOT EXISTS config_permissions (role TEXT, module TEXT, allowed INTEGER, PRIMARY KEY (role, module))`);
        
        // 6. ATA (Meetings)
        await dbRun(`CREATE TABLE IF NOT EXISTS meetings (id TEXT PRIMARY KEY, title TEXT, date TEXT, start_time TEXT, end_time TEXT, photo_url TEXT, participants TEXT, topics TEXT, created_by TEXT)`);

        // --- MIGRATIONS LINE_STOPS ---
        await dbRun("ALTER TABLE line_stops ADD COLUMN user_role TEXT").catch(() => {});
        await dbRun("ALTER TABLE line_stops ADD COLUMN status TEXT").catch(() => {});
        await dbRun("ALTER TABLE line_stops ADD COLUMN user_id TEXT").catch(() => {}); 
        await dbRun("ALTER TABLE line_stops ADD COLUMN user_name TEXT").catch(() => {});

        // --- MIGRATIONS MEETINGS ---
        await dbRun("ALTER TABLE meetings ADD COLUMN title TEXT").catch(() => {});
        await dbRun("ALTER TABLE meetings ADD COLUMN start_time TEXT").catch(() => {});
        await dbRun("ALTER TABLE meetings ADD COLUMN end_time TEXT").catch(() => {});
        await dbRun("ALTER TABLE meetings ADD COLUMN photo_url TEXT").catch(() => {});

        // --- SEED PERMISSIONS ---
        // Atualiza permissões para incluir o novo módulo MANAGEMENT
        const allRoles = await dbAll("SELECT name FROM config_roles");
        for (const roleObj of allRoles) {
            for (const mod of MODULES) {
                const exists = await dbGet("SELECT 1 FROM config_permissions WHERE role = ? AND module = ?", [roleObj.name, mod]);
                if (!exists) {
                    const initialVal = roleObj.name === 'Admin' || roleObj.name === 'Diretor' ? 1 : 0;
                    await dbRun("INSERT INTO config_permissions (role, module, allowed) VALUES (?, ?, ?)", [roleObj.name, mod, initialVal]);
                }
            }
        }
        
        // Seed Admin Padrão
        const adminExists = await dbGet("SELECT matricula FROM users WHERE matricula = 'admin'");
        if (!adminExists) {
            const hash = await bcrypt.hash('admin', SALT_ROUNDS);
            await dbRun(`INSERT INTO users (matricula, name, role, shift, email, password, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['admin', 'Admin Local', 'Admin', '1', 'admin@local.com', hash, 1]);
        }

    } catch (error) {
        console.error("❌ Erro fatal na inicialização:", error);
        await dbRun("ROLLBACK").catch(() => {});
    }
};

initDatabase();

// --- ROTAS (API) ---

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

app.put('/api/users', async (req, res) => {
    const { matricula, name, role, shift, email, password, isAdmin, originalMatricula } = req.body;
    const targetMatricula = originalMatricula || matricula;
    try {
        let sql = `UPDATE users SET matricula=?, name=?, role=?, shift=?, email=?, is_admin=?`;
        let params = [matricula, name, role, shift, email, isAdmin?1:0];
        if (password && password !== '******') {
            sql += `, password=?`;
            params.push(await bcrypt.hash(password, SALT_ROUNDS));
        }
        sql += ` WHERE matricula=?`;
        params.push(targetMatricula);
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

app.get('/api/logs', async (req, res) => {
    try {
        const liderLogs = await dbAll("SELECT *, 'PRODUCTION' as type_marker FROM logs_lider ORDER BY date DESC LIMIT 500");
        const maintLogs = await dbAll("SELECT *, 'MAINTENANCE' as type_marker FROM logs_manutencao ORDER BY date DESC LIMIT 500");
        const allLogs = [...liderLogs, ...maintLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const response = allLogs.map(r => {
            const parsedData = JSON.parse(r.data);
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
                maintenanceTarget: r.maintenance_target || parsedData.maintenanceTarget
            };
        });
        res.json(response);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/logs', async (req, res) => {
    const { userId, userName, userRole, line, date, itemsCount, ngCount, observation, data, evidenceData, type, maintenanceTarget } = req.body;
    const storageObject = { answers: data, evidence: evidenceData, type: type || 'PRODUCTION', maintenanceTarget };
    const dataStr = JSON.stringify(storageObject);
    try {
        if (type === 'MAINTENANCE') {
            await dbRun(`INSERT INTO logs_manutencao (user_id, user_name, user_role, line, date, items_count, ng_count, observation, data, maintenance_target) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, userName, userRole, line, date, itemsCount, ngCount, observation, dataStr, maintenanceTarget]);
        } else {
            await dbRun(`INSERT INTO logs_lider (user_id, user_name, user_role, line, date, items_count, ng_count, observation, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, userName, userRole, line, date, itemsCount, ngCount, observation, dataStr]);
        }
        res.json({ message: "Salvo" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

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

app.get('/api/line-stops', async (req, res) => {
    try {
        const stops = await dbAll("SELECT * FROM line_stops ORDER BY date DESC LIMIT 500");
        res.json(stops.map(r => ({ ...r, id: r.id.toString(), type: 'LINE_STOP', data: JSON.parse(r.data), itemsCount: 0, ngCount: 0, observation: '' })));
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/line-stops', async (req, res) => {
    const { id, userId, userName, userRole, line, date, status, data, signedDocUrl } = req.body;
    if (signedDocUrl) data.signedDocUrl = signedDocUrl;
    const dataStr = JSON.stringify(data);
    try {
        if (id && !isNaN(id)) await dbRun(`UPDATE line_stops SET line=?, status=?, data=? WHERE id=?`, [line, status, dataStr, id]);
        else await dbRun(`INSERT INTO line_stops (user_id, user_name, user_role, line, date, status, data) VALUES (?, ?, ?, ?, ?, ?, ?)`, [userId, userName, userRole, line, date, status, dataStr]);
        res.json({ message: "Salvo" });
    } catch (e) { res.status(500).json({error: e.message}); }
});

// --- ROTAS DE CONFIGURAÇÃO (GESTÃO) ---

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

createConfigRoutes('config_lines', 'lines');
createConfigRoutes('config_roles', 'roles');
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

// --- MEETING (ATA) ---
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

// Backup & Static Files
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
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
    const now = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Manaus' });
    console.log(`✅ SERVIDOR RODANDO! (Horário do Servidor: ${now})`);
    console.log(`⚠️ Nota: O App usa Horário de Manaus (-4) para funcionar.`);
    console.log(`--------------------------------------------------`);
    console.log(`💻 ACESSO LOCAL:     http://localhost:${PORT}`);
    console.log(`📱 ACESSO NA REDE:   http://${getLocalIp()}:${PORT}`);
    console.log(`--------------------------------------------------`);
    console.log(`Conectado ao banco de dados SQLite local.`);
});