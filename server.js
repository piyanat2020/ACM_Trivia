const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.DATABASE_URL) {
    console.error("🚨 ไม่พบ 'DATABASE_URL'");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

const initDB = async () => {
    try {
        const client = await pool.connect();
        
        // ตารางคำถาม (เพิ่มคอลัมน์ explanation ถ้ายังไม่มี)
        await client.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY, text TEXT, options TEXT, answerindex INTEGER
            );
        `);
        // ใช้คำสั่ง ALTER เพื่อเพิ่มคอลัมน์คำอธิบาย (สำหรับข้อมูลเดิม)
        await client.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;`);
        
        // ตารางข้อความพิเศษ
        await client.query(`CREATE TABLE IF NOT EXISTS settings (id SERIAL PRIMARY KEY, specialmessage TEXT);`);
        const setRes = await client.query("SELECT * FROM settings");
        if (setRes.rows.length === 0) {
            await client.query("INSERT INTO settings (specialmessage) VALUES ($1)", ['กรุณาเตรียมคำถามก่อนเข้า Meeting!']);
        }

        // 🎵 ตารางเพลงประกอบ
        await client.query(`
            CREATE TABLE IF NOT EXISTS tracks (
                id SERIAL PRIMARY KEY, name TEXT, url TEXT
            );
        `);

        console.log("✅ ฐานข้อมูลอัปเดตเรียบร้อย");
        client.release();
    } catch (err) { console.error("❌ DB Error:", err.message); }
};
if (process.env.DATABASE_URL) initDB();

// ================= API คำถาม =================
app.get('/api/questions/random', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM questions ORDER BY RANDOM() LIMIT 7"); // ดึงมา 7 ข้อให้พอดี 20 นาที
        const formatted = rows.map(r => ({
            id: r.id, text: r.text, options: JSON.parse(r.options), answerIndex: r.answerindex, explanation: r.explanation || ""
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/questions', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM questions ORDER BY id DESC");
        const formatted = rows.map(r => ({
            id: r.id, text: r.text, options: JSON.parse(r.options), answerIndex: r.answerindex, explanation: r.explanation || ""
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/questions', async (req, res) => {
    try {
        const { text, options, answerIndex, explanation } = req.body;
        await pool.query("INSERT INTO questions (text, options, answerindex, explanation) VALUES ($1, $2, $3, $4)", 
            [text, JSON.stringify(options), answerIndex, explanation]);
        res.json({ message: "เพิ่มคำถามสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/questions/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM questions WHERE id = $1", [req.params.id]);
        res.json({ message: "ลบคำถามสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= API เพลง (Tracks) =================
app.get('/api/tracks', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM tracks ORDER BY id DESC");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tracks', async (req, res) => {
    try {
        const { name, url } = req.body;
        await pool.query("INSERT INTO tracks (name, url) VALUES ($1, $2)", [name, url]);
        res.json({ message: "เพิ่มเพลงสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tracks/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM tracks WHERE id = $1", [req.params.id]);
        res.json({ message: "ลบเพลงสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= API Settings =================
app.get('/api/settings', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT specialmessage FROM settings WHERE id = 1");
        res.json({ specialMessage: rows[0]?.specialmessage });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings', async (req, res) => {
    try {
        const { specialMessage } = req.body;
        await pool.query("UPDATE settings SET specialmessage = $1 WHERE id = 1", [specialMessage]);
        res.json({ message: "อัปเดตสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));