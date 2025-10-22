const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 연결
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 업로드 디렉토리
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage });
const cpUpload = upload.array('media'); // 모든 파일을 media로 받음

// 정적 파일 + body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    
    // GET /api/posts
    app.get('/api/posts', async (req, res) => {
        try {
            const q = `
      SELECT id, title, author, content_blocks AS "contentBlocks",
             comments, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM posts
      ORDER BY id DESC
    `;
            const result = await pool.query(q);
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'DB error' });
        }
    });
    
    // GET /api/posts/:id
    app.get('/api/posts/:id', async (req, res) => {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid id' });
        
        try {
            const q = `
      SELECT id, title, author, content_blocks AS "contentBlocks",
             comments, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM posts
      WHERE id = $1
      LIMIT 1
    `;
            const result = await pool.query(q, [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'DB error' });
        }
    });
    
    // POST /api/posts
    app.post('/api/posts', cpUpload, async (req, res) => {
        try {
            const { title, author, contentBlocks } = req.body;
            if (!title) return res.status(400).json({ error: 'Title required' });
            
            // contentBlocks 문자열 → JSON 배열
            let blocks = [];
            try {
                blocks = JSON.parse(contentBlocks);
            } catch (e) {}
            
            // 업로드 파일 매칭
            if (req.files) {
                let fileIndex = 0;
                blocks.forEach(block => {
                    if (block.type !== 'text' && fileIndex < req.files.length) {
                        block.url = `/uploads/${req.files[fileIndex].filename}`;
                        fileIndex++;
                    }
                });
            }
            
            const q = `
      INSERT INTO posts (title, author, content_blocks)
      VALUES ($1, $2, $3)
      RETURNING id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
            const values = [title, author || '익명', JSON.stringify(blocks)];
            const result = await pool.query(q, values);
            
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'DB insert error' });
        }
    });
    
    // PUT /api/posts/:id
    app.put('/api/posts/:id', cpUpload, async (req, res) => {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid id' });
        
        try {
            const fields = [];
            const values = [];
            let idx = 1;
            
            if (req.body.title !== undefined) { fields.push(`title = $${idx++}`); values.push(req.body.title); }
            if (req.body.author !== undefined) { fields.push(`author = $${idx++}`); values.push(req.body.author); }
            if (req.body.contentBlocks !== undefined) {
                let blocks = [];
                try { blocks = JSON.parse(req.body.contentBlocks); } catch(e) {}
                // 업로드 파일 매칭
                if (req.files) {
                    let fileIndex = 0;
                    blocks.forEach(block => {
                        if (block.type !== 'text' && fileIndex < req.files.length) {
                            block.url = `/uploads/${req.files[fileIndex].filename}`;
                            fileIndex++;
                        }
                    });
                }
                fields.push(`content_blocks = $${idx++}`);
                values.push(JSON.stringify(blocks));
            }
            if (req.body.comments !== undefined) {
                let commentsVal = req.body.comments;
                if (typeof commentsVal === 'string') {
                    try { commentsVal = JSON.parse(commentsVal); } catch(e) {}
                }
                fields.push(`comments = $${idx++}`);
                values.push(JSON.stringify(commentsVal));
            }
            
            if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
            
            fields.push(`updated_at = NOW()`);
            const q = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt"`;
            values.push(id);
            
            const result = await pool.query(q, values);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'DB update error' });
        }
    });
    
    // DELETE /api/posts/:id
    app.delete('/api/posts/:id', async (req, res) => {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid id' });
        
        try {
            const q = `DELETE FROM posts WHERE id = $1 RETURNING content_blocks`;
            const result = await pool.query(q, [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            
            // 업로드 파일 삭제
            const blocks = result.rows[0].content_blocks || [];
            blocks.forEach(block => {
                if (block.url) {
                    const rel = block.url.startsWith('/') ? block.url.slice(1) : block.url;
                    const fpath = path.join(__dirname, rel);
                    fs.unlink(fpath, err => {
                        if (err) console.warn('파일 삭제 실패(무시):', fpath, err.message);
                    });
                }
            });
            
            res.json({ message: 'Deleted' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'DB delete error' });
        }
    });
    
    // 서버 시작
    app.listen(PORT, () => {
        console.log(`✅ Server running at http://localhost:${PORT}`);
    });
