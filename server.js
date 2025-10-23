require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 연결
const useSSL = process.env.DATABASE_SSL === 'true';
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false
});

// 업로드 디렉토리
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_.]/g, '_');
        cb(null, `${name}-${unique}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024), files: 20 }
});
const cpUpload = upload.array('media', 20);

// 미들웨어
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// DB 테이블 생성
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT,
                content_blocks JSONB DEFAULT '[]'::jsonb,
                comments JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ posts 테이블 준비 완료');
    } catch (err) {
        console.error('DB 초기화 실패:', err);
    }
})();

// 유틸: 안전한 JSON 파싱
function parseMaybeJSON(input, fallback = null) {
    if (input === undefined || input === null) return fallback;
    if (typeof input === 'object') return input;
    try { return JSON.parse(input); } catch (e) { return fallback; }
}

// 유틸: 안전한 파일 삭제
async function safeUnlink(relPath) {
    try {
        const resolved = path.resolve(__dirname, relPath);
        if (!resolved.startsWith(uploadDir)) return;
        await fsp.unlink(resolved).catch(() => {});
    } catch (e) {}
}

// ---------------------- REST 엔드포인트 ----------------------

// GET /api/posts
app.get('/api/posts', async (req, res) => {
    try {
        const q = `SELECT id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt" 
                   FROM posts ORDER BY id DESC`;
        const result = await pool.query(q);
        res.json(result.rows);
    } catch (err) {
        console.error('GET /api/posts 오류:', err);
        res.status(500).json({ error: 'DB error' });
    }
});

// GET /api/posts/:id
app.get('/api/posts/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    try {
        const q = `SELECT id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt" 
                   FROM posts WHERE id = $1 LIMIT 1`;
        const { rows } = await pool.query(q, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(`GET /api/posts/${id} 오류:`, err);
        res.status(500).json({ error: 'DB error' });
    }
});

// POST /api/posts
app.post('/api/posts', cpUpload, async (req, res) => {
    try {
        const title = (req.body.title || '').trim();
        const author = (req.body.author || '익명').trim();
        if (!title) return res.status(400).json({ error: 'Title required' });

        let blocks = parseMaybeJSON(req.body.contentBlocks, []);
        if (!Array.isArray(blocks)) return res.status(400).json({ error: 'contentBlocks must be an array' });

        if (req.files && req.files.length > 0) {
            let i = 0;
            for (const block of blocks) {
                if ((block.type === 'image' || block.type === 'video') && !block.url && i < req.files.length) {
                    const file = req.files[i++];
                    block.url = `/uploads/${file.filename}`;
                    block.filename = file.originalname;
                }
            }
        }
        blocks = blocks.map(b => (b.type === 'text' && !b.content ? { ...b, content: '' } : b));

        const q = `INSERT INTO posts (title, author, content_blocks) 
                   VALUES ($1, $2, $3) 
                   RETURNING id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt"`;
        const values = [title, author, JSON.stringify(blocks)];
        const { rows } = await pool.query(q, values);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('POST /api/posts 오류:', err);
        res.status(500).json({ error: 'DB insert error', details: err.message });
    }
});

// PUT /api/posts/:id
app.put('/api/posts/:id', cpUpload, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    try {
        const fields = [];
        const values = [];
        let idx = 1;

        if (req.body.title !== undefined) { fields.push(`title = $${idx++}`); values.push(String(req.body.title).trim()); }
        if (req.body.author !== undefined) { fields.push(`author = $${idx++}`); values.push(String(req.body.author)); }

        if (req.body.contentBlocks !== undefined) {
            let blocks = parseMaybeJSON(req.body.contentBlocks, null);
            if (!Array.isArray(blocks)) return res.status(400).json({ error: 'Invalid contentBlocks format' });

            if (req.files && req.files.length > 0) {
                let i = 0;
                for (const block of blocks) {
                    if ((block.type === 'image' || block.type === 'video') && !block.url && i < req.files.length) {
                        const file = req.files[i++];
                        block.url = `/uploads/${file.filename}`;
                        block.filename = file.originalname;
                    }
                }
            }

            fields.push(`content_blocks = $${idx++}`);
            values.push(JSON.stringify(blocks));
        }

        if (req.body.comments !== undefined) {
            let commentsVal = parseMaybeJSON(req.body.comments, null);
            if (commentsVal === null) return res.status(400).json({ error: 'Invalid comments format' });
            fields.push(`comments = $${idx++}`);
            values.push(JSON.stringify(commentsVal));
        }

        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
        fields.push(`updated_at = NOW()`);

        const q = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${idx} 
                   RETURNING id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt"`;
        values.push(id);

        const { rows } = await pool.query(q, values);
        if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });

        res.json(rows[0]);
    } catch (err) {
        console.error(`PUT /api/posts/${id} 오류:`, err);
        res.status(500).json({ error: 'DB update error', details: err.message });
    }
});

// DELETE /api/posts/:id
app.delete('/api/posts/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    try {
        const q = `DELETE FROM posts WHERE id = $1 RETURNING content_blocks`;
        const { rows } = await pool.query(q, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });

        const blocks = rows[0].content_blocks || [];
        for (const block of blocks) {
            if (block && block.url) {
                const rel = block.url.startsWith('/') ? block.url.slice(1) : block.url;
                await safeUnlink(rel).catch(() => {});
            }
        }

        res.json({ message: 'Deleted', id });
    } catch (err) {
        console.error(`DELETE /api/posts/${id} 오류:`, err);
        res.status(500).json({ error: 'DB delete error', details: err.message });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadDir}`);
});
