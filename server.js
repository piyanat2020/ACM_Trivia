const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.DATABASE_URL) console.error("🚨 ไม่พบ 'DATABASE_URL'");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

const initDB = async () => {
    try {
        const client = await pool.connect();
        
        // ตารางคำถาม
        await client.query(`CREATE TABLE IF NOT EXISTS questions (id SERIAL PRIMARY KEY, text TEXT, options TEXT, answerindex INTEGER);`);
        await client.query(`ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;`);
        
        // ⚙️ ตารางการตั้งค่า (เพิ่มคอลัมน์เก็บเวลา)
        await client.query(`CREATE TABLE IF NOT EXISTS settings (id SERIAL PRIMARY KEY, specialmessage TEXT);`);
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS question_time INTEGER DEFAULT 120;`);
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS answer_time INTEGER DEFAULT 60;`);
        
        const setRes = await client.query("SELECT * FROM settings");
        if (setRes.rows.length === 0) {
            await client.query("INSERT INTO settings (specialmessage, question_time, answer_time) VALUES ($1, $2, $3)", ['กรุณาเตรียมคำถามก่อนเข้า Meeting!', 120, 60]);
        }

        // ตารางเพลง
        await client.query(`CREATE TABLE IF NOT EXISTS tracks (id SERIAL PRIMARY KEY, name TEXT, url TEXT);`);

        console.log("✅ ฐานข้อมูลอัปเดตเรียบร้อย (รองรับระบบตั้งค่าเวลาแล้ว)");
        client.release();
    } catch (err) { console.error("❌ DB Error:", err.message); }
};
if (process.env.DATABASE_URL) initDB();

// ================= API คำถาม =================
app.get('/api/questions/random', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM questions ORDER BY RANDOM() LIMIT 7");
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
        res.json({ message: "ลบสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= API เพลง =================
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
        res.json({ message: "เพิ่มสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tracks/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM tracks WHERE id = $1", [req.params.id]);
        res.json({ message: "ลบสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================= API ตั้งค่า (Settings) =================
app.get('/api/settings', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM settings WHERE id = 1");
        res.json({ 
            specialMessage: rows[0]?.specialmessage,
            questionTime: rows[0]?.question_time || 120, // ค่าเริ่มต้น 120 วิ
            answerTime: rows[0]?.answer_time || 60       // ค่าเริ่มต้น 60 วิ
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings', async (req, res) => {
    try {
        const { specialMessage, questionTime, answerTime } = req.body;
        await pool.query(
            "UPDATE settings SET specialmessage = $1, question_time = $2, answer_time = $3 WHERE id = 1", 
            [specialMessage, questionTime, answerTime]
        );
        res.json({ message: "อัปเดตการตั้งค่าสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));