const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// บอกให้ Express นำไฟล์ในโฟลเดอร์ public มาแสดงเป็นหน้าเว็บ
app.use(express.static(path.join(__dirname, 'public')));

// เชื่อมต่อฐานข้อมูล PostgreSQL ผ่านค่า Environment Variable
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

// สร้างตารางอัตโนมัติเมื่อเปิดเซิร์ฟเวอร์
const initDB = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                text TEXT,
                options TEXT,
                answerindex INTEGER
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                specialmessage TEXT
            );
        `);
        
        const setRes = await client.query("SELECT * FROM settings");
        if (setRes.rows.length === 0) {
            await client.query("INSERT INTO settings (specialmessage) VALUES ($1)", ['กรุณาเตรียมคำถามก่อนเข้า Meeting!']);
        }
        console.log("✅ ฐานข้อมูลพร้อมใช้งาน");
    } catch (err) {
        console.error("❌ เชื่อมต่อ DB ไม่สำเร็จ:", err);
    } finally {
        client.release();
    }
};
initDB();

// ================= API =================

// ดึงข้อความพิเศษ
app.get('/api/settings', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT specialmessage FROM settings WHERE id = 1");
        // สังเกตว่า PostgreSQL จะแปลงชื่อคอลัมน์เป็นตัวพิมพ์เล็กทั้งหมด (specialmessage)
        res.json({ specialMessage: rows[0]?.specialmessage || "เตรียมคำถามของคุณให้พร้อม!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// อัปเดตข้อความพิเศษ
app.put('/api/settings', async (req, res) => {
    try {
        const { specialMessage } = req.body;
        await pool.query("UPDATE settings SET specialmessage = $1 WHERE id = 1", [specialMessage]);
        res.json({ message: "อัปเดตสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ดึงคำถามสุ่ม 4 ข้อ
app.get('/api/questions/random', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM questions ORDER BY RANDOM() LIMIT 4");
        const formatted = rows.map(r => ({
            id: r.id, text: r.text, options: JSON.parse(r.options), answerIndex: r.answerindex
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ดึงคำถามทั้งหมด (สำหรับ Admin)
app.get('/api/questions', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM questions ORDER BY id DESC");
        const formatted = rows.map(r => ({
            id: r.id, text: r.text, options: JSON.parse(r.options), answerIndex: r.answerindex
        }));
        res.json(formatted);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// เพิ่มคำถาม
app.post('/api/questions', async (req, res) => {
    try {
        const { text, options, answerIndex } = req.body;
        await pool.query("INSERT INTO questions (text, options, answerindex) VALUES ($1, $2, $3)", 
            [text, JSON.stringify(options), answerIndex]);
        res.json({ message: "เพิ่มคำถามสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ลบคำถาม
app.delete('/api/questions/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM questions WHERE id = $1", [req.params.id]);
        res.json({ message: "ลบคำถามสำเร็จ" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));