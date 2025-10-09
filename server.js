// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 연결 (Railway에서 제공한 DATABASE_URL 사용)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Railway 환경에서 필요
});

// 업로드 디렉토리 설정 (파일 확장자 보존)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// 정적 파일 제공 + body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// DB 테이블 생성 (최초 실행 시 한 번만 생성)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        author TEXT,
        video TEXT,
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

/**
 * GET /api/posts
 * 전체 게시글 (최신순)
 */
app.get('/api/posts', async (req, res) => {
  try {
    const q = `
      SELECT id, title, content, author, video,
             comments,
             created_at AS "createdAt",
             updated_at AS "updatedAt"
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

/**
 * GET /api/posts/:id
 * 특정 게시글 상세
 */
app.get('/api/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  try {
    const q = `
      SELECT id, title, content, author, video,
             comments,
             created_at AS "createdAt",
             updated_at AS "updatedAt"
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

/**
 * POST /api/posts
 * 게시글 작성 (multipart/form-data - video optional)
 * fields: title, content, author
 */
app.post('/api/posts', upload.single('video'), async (req, res) => {
  try {
    const { title, content, author } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const videoPath = req.file ? `/uploads/${req.file.filename}` : null;

    const q = `
      INSERT INTO posts (title, content, author, video, comments)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, content, author, video, comments, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    const values = [title, content || '', author || '익명', videoPath, JSON.stringify([])];
    const result = await pool.query(q, values);

    // 클라이언트가 form submit (브라우저 폼)인지 fetch인지에 따라 다르게 응답하세요.
    // 여기서는 JSON을 리턴합니다.
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB insert error' });
  }
});

/**
 * PUT /api/posts/:id
 * 게시글 수정 (multipart/form-data or application/json)
 * - 지원 필드: title, content, comments (배열), author (optional), video (file)
 */
app.put('/api/posts/:id', upload.single('video'), async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  try {
    // 수집 가능한 필드들
    const fields = [];
    const values = [];
    let idx = 1;

    if (req.body.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(req.body.title);
    }
    if (req.body.content !== undefined) {
      fields.push(`content = $${idx++}`);
      values.push(req.body.content);
    }
    if (req.body.author !== undefined) {
      fields.push(`author = $${idx++}`);
      values.push(req.body.author);
    }

    // comments는 JSON 또는 문자열로 올 수 있음
    if (req.body.comments !== undefined) {
      let commentsVal = req.body.comments;
      if (typeof commentsVal === 'string') {
        try { commentsVal = JSON.parse(commentsVal); } catch (e) { /* keep as string if parse fails */ }
      }
      fields.push(`comments = $${idx++}`);
      values.push(JSON.stringify(commentsVal));
    }

    // 업로드된 파일이 있으면 비디오 경로 업데이트
    if (req.file) {
      const videoPath = `/uploads/${req.file.filename}`;
      fields.push(`video = $${idx++}`);
      values.push(videoPath);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // updated_at 갱신
    fields.push(`updated_at = NOW()`);

    const q = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, title, content, author, video, comments, created_at AS "createdAt", updated_at AS "updatedAt"`;
    values.push(id);

    const result = await pool.query(q, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB update error' });
  }
});

/**
 * DELETE /api/posts/:id
 * 게시글 삭제 (DB에서 삭제, 업로드된 파일도 제거 시도)
 */
app.delete('/api/posts/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  try {
    // 삭제하면서 video 경로 리턴
    const q = `DELETE FROM posts WHERE id = $1 RETURNING video`;
    const result = await pool.query(q, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });

    const video = result.rows[0].video;
    if (video) {
      let rel = video;
      if (rel.startsWith('/')) rel = rel.slice(1); // remove leading slash
      const fpath = path.join(__dirname, rel);
      fs.unlink(fpath, (err) => {
        if (err) {
          // 파일이 없을 수도 있고, 에러는 로그만 남김
          console.warn('파일 삭제 실패(무시):', fpath, err.message);
        }
      });
    }

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
