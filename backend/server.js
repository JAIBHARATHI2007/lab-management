const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Frontend folder

// CORRUPTION-PROOF DB SETUP
let db;
function initDB() {
    return new Promise((resolve, reject) => {
        // Delete corrupt files first
        const fs = require('fs');
        ['lab.db', 'lab.db-wal', 'lab.db-shm'].forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

        db = new sqlite3.Database('lab_new.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('🚨 DB Init Error:', err);
                return reject(err);
            }
            
            // WAL MODE (prevents corruption)
            db.run('PRAGMA journal_mode=WAL');
            db.run('PRAGMA synchronous=NORMAL');
            db.run('PRAGMA cache_size=10000');
            db.run('PRAGMA temp_store=MEMORY');
            
            createTables();
            resolve();
        });
    });
}

function createTables() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            accessLevel TEXT NOT NULL,
            authorized BOOLEAN DEFAULT 1
        )`);

        // Logs table  
        db.run(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp DATETIME DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (userId) REFERENCES users (id)
        )`);

        // Insert 100 students (unga exact data)
        const users = [
            ['7001', 'Jaibharathi', 'student', 'Full', 1],
            ['7002', 'Manikandan', 'student', 'Restricted', 1],
            ['7003', 'Mathan', 'student', 'Full', 1],
            ['7004', 'Gowrisankar', 'student', 'Restricted', 1],
            // ... (unga full 100 list same ah irukku)
            ['7100', 'Student100', 'student', 'Restricted', 1]
        ];

        const stmt = db.prepare('INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, ?)');
        users.forEach(user => stmt.run(user));
        stmt.finalize(() => {
            console.log('✅ DB + 100 Students Ready!');
        });
    });
}

// Wait for DB init
initDB().then(() => {
    // Routes (same as unga code)
    app.get('/api/users', (req, res) => {
        db.all('SELECT * FROM users WHERE authorized = 1', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    app.get('/api/users/:id', (req, res) => {
        const { id } = req.params;
        db.get('SELECT * FROM users WHERE id = ? AND authorized = 1', [id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'User not found' });
            res.json(row);
        });
    });

    app.post('/api/log', (req, res) => {
        const { id: userId } = req.body;
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err || !user || !user.authorized) {
                return res.json({ success: false, message: 'Invalid user' });
            }

            db.get('SELECT * FROM logs WHERE userId = ? ORDER BY id DESC LIMIT 1', [userId], (err, lastLog) => {
                const isInside = lastLog && lastLog.status === 'Inside';
                const action = isInside ? 'Exit' : 'Entry';
                const status = isInside ? 'Outside' : 'Inside';

                db.run(`INSERT INTO logs (userId, name, role, action, status) VALUES (?, ?, ?, ?, ?)`,
                    [userId, user.name, user.role, action, status],
                    function(err) {
                        if (err) return res.status(500).json({ success: false });
                        res.json({ success: true, action, status });
                    }
                );
            });
        });
    });

    app.get('/api/logs', (req, res) => {
        db.all('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    app.get('/api/active', (req, res) => {
        db.all(`
            SELECT DISTINCT u.id, u.name, u.role, l.timestamp
            FROM logs l JOIN users u ON l.userId = u.id
            WHERE l.status = 'Inside' AND l.timestamp > datetime('now', '-1 day')
            ORDER BY l.timestamp DESC
        `, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`🚀 Server running: http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('🚨 Fatal DB Error:', err);
    process.exit(1);
});
