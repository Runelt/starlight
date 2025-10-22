const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const length = post.content ? post.content.length : 0;

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
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 제한
});
const cpUpload = upload.array('media', 20); // 최대 20개 파일

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

// GET /api/posts - 모든 게시글 조회
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
        console.error('GET /api/posts 오류:', err);
        res.status(500).json({ error: 'DB error' });
    }
});

// GET /api/posts/:id - 특정 게시글 조회
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
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`GET /api/posts/${id} 오류:`, err);
        res.status(500).json({ error: 'DB error' });
    }
});

// POST /api/posts - 새 게시글 작성
app.post('/api/posts', cpUpload, async (req, res) => {
    try {
        const { title, author, contentBlocks } = req.body;
        
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title required' });
        }
        
        // contentBlocks 파싱
        let blocks = [];
        try {
            blocks = JSON.parse(contentBlocks || '[]');
        } catch (e) {
            console.error('contentBlocks 파싱 실패:', e);
            return res.status(400).json({ error: 'Invalid contentBlocks format' });
        }
        
        if (!Array.isArray(blocks)) {
            return res.status(400).json({ error: 'contentBlocks must be an array' });
        }
        
        // 업로드된 파일들을 순서대로 블록에 매칭
        if (req.files && req.files.length > 0) {
            let fileIndex = 0;
            
            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i];
                
                // 미디어 블록이고 아직 url이 없으면 파일 할당
                if ((block.type === 'image' || block.type === 'video') && !block.url) {
                    if (fileIndex < req.files.length) {
                        const file = req.files[fileIndex];
                        block.url = `/uploads/${file.filename}`;
                        block.filename = file.originalname;
                        fileIndex++;
                    }
                }
            }
        }
        
        // 텍스트 블록 검증
        blocks.forEach(block => {
            if (block.type === 'text' && !block.content) {
                block.content = '';
            }
        });
        
        const q = `
            INSERT INTO posts (title, author, content_blocks)
            VALUES ($1, $2, $3)
            RETURNING id, title, author, content_blocks AS "contentBlocks", 
                      comments, created_at AS "createdAt", updated_at AS "updatedAt"
        `;
        const values = [
            title.trim(), 
            author || '익명', 
            JSON.stringify(blocks)
        ];
        
        const result = await pool.query(q, values);
        
        console.log(`✅ 게시글 생성 성공 (ID: ${result.rows[0].id})`);
        res.status(201).json(result.rows[0]);
        
    } catch (err) {
        console.error('POST /api/posts 오류:', err);
        res.status(500).json({ error: 'DB insert error', details: err.message });
    }
});

// PUT /api/posts/:id - 게시글 수정
app.put('/api/posts/:id', cpUpload, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    
    try {
        const fields = [];
        const values = [];
        let idx = 1;
        
        // 제목 업데이트
        if (req.body.title !== undefined) {
            fields.push(`title = $${idx++}`);
            values.push(req.body.title.trim());
        }
        
        // 작성자 업데이트
        if (req.body.author !== undefined) {
            fields.push(`author = $${idx++}`);
            values.push(req.body.author);
        }
        
        // contentBlocks 업데이트
        if (req.body.contentBlocks !== undefined) {
            let blocks = [];
            try {
                blocks = JSON.parse(req.body.contentBlocks);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid contentBlocks format' });
            }
            
            // 업로드된 파일 매칭
            if (req.files && req.files.length > 0) {
                let fileIndex = 0;
                
                for (let i = 0; i < blocks.length; i++) {
                    const block = blocks[i];
                    
                    if ((block.type === 'image' || block.type === 'video') && !block.url) {
                        if (fileIndex < req.files.length) {
                            const file = req.files[fileIndex];
                            block.url = `/uploads/${file.filename}`;
                            block.filename = file.originalname;
                            fileIndex++;
                        }
                    }
                }
            }
            
            fields.push(`content_blocks = $${idx++}`);
            values.push(JSON.stringify(blocks));
        }
        
        // 댓글 업데이트
        if (req.body.comments !== undefined) {
            let commentsVal = req.body.comments;
            if (typeof commentsVal === 'string') {
                try {
                    commentsVal = JSON.parse(commentsVal);
                } catch (e) {
                    return res.status(400).json({ error: 'Invalid comments format' });
                }
            }
            fields.push(`comments = $${idx++}`);
            values.push(JSON.stringify(commentsVal));
        }
        
        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        fields.push(`updated_at = NOW()`);
        
        const q = `
            UPDATE posts 
            SET ${fields.join(', ')} 
            WHERE id = $${idx} 
            RETURNING id, title, author, content_blocks AS "contentBlocks", 
                      comments, created_at AS "createdAt", updated_at AS "updatedAt"
        `;
        values.push(id);
        
        const result = await pool.query(q, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        console.log(`✅ 게시글 수정 성공 (ID: ${id})`);
        res.json(result.rows[0]);
        
    } catch (err) {
        console.error(`PUT /api/posts/${id} 오류:`, err);
        res.status(500).json({ error: 'DB update error', details: err.message });
    }
});

// DELETE /api/posts/:id - 게시글 삭제
app.delete('/api/posts/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    
    try {
        const q = `DELETE FROM posts WHERE id = $1 RETURNING content_blocks`;
        const result = await pool.query(q, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // 업로드된 파일 삭제
        const blocks = result.rows[0].content_blocks || [];
        blocks.forEach(block => {
            if (block.url) {
                const rel = block.url.startsWith('/') ? block.url.slice(1) : block.url;
                const fpath = path.join(__dirname, rel);
                fs.unlink(fpath, err => {
                    if (err) {
                        console.warn(`파일 삭제 실패 (무시): ${fpath}`, err.message);
                    } else {
                        console.log(`✅ 파일 삭제: ${fpath}`);
                    }
                });
            }
        });
        
        console.log(`✅ 게시글 삭제 성공 (ID: ${id})`);
        res.json({ message: 'Deleted', id });
        
    } catch (err) {
        console.error(`DELETE /api/posts/${id} 오류:`, err);
        res.status(500).json({ error: 'DB delete error', details: err.message });
    }
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
    console.error('서버 오류:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadDir}`);
});
