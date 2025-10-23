// server.js (updated with dynamic column management)
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL 연결: DATABASE_URL은 반드시 설정
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

// DB 테이블 생성 (간단하고 안전하게)
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

// ---------------------- 유틸 및 동적 컬럼 로직 ----------------------
// 식별자(테이블/컬럼명) 유효성 검사: 영문 시작, 영문/숫자/언더스코어 허용
function isValidIdentifier(name) {
  return typeof name === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && name.length <= 63;
}

// 간단 타입 추정
function guessSQLType(value) {
  if (value === null || value === undefined || value === '') return 'TEXT';
  if (typeof value === 'object') return 'JSONB';
  const s = String(value).trim();
  if (/^\d+$/.test(s)) return 'BIGINT';
  if (/^\d+\.\d+$/.test(s)) return 'NUMERIC';
  if (/^(true|false)$/i.test(s)) return 'BOOLEAN';
  // 날짜 등 더 정교한 판별은 필요 시 추가
  return 'TEXT';
}

// 테이블의 기존 컬럼 목록 조회 (schema-aware: 기본 public)
async function getExistingColumns(client, tableName, schema = 'public') {
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
  const r = await client.query(q, [schema, tableName]);
  return new Set(r.rows.map(r => r.column_name));
}

// 안전하게 컬럼 추가
async function addColumnIfMissing(client, tableName, columnName, sqlType, schema = 'public') {
  if (!isValidIdentifier(columnName)) throw new Error('Invalid column name: ' + columnName);
  // 안전을 위해 schema와 table을 식별자로 직접 넣음 (이미 검증됐다고 가정)
  const qualified = `${schema}.${tableName}`;
  const sql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS "${columnName}" ${sqlType}`;
  await client.query(sql);
}

// 제한: 한 번에 자동 생성 가능한 컬럼 수
const MAX_AUTOCREATE_COLUMNS = Number(process.env.MAX_AUTOCREATE_COLUMNS || 10);

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
    if (!resolved.startsWith(uploadDir)) return; // safety: only delete inside uploadDir
    await fsp.unlink(resolved).catch(() => {});
  } catch (e) {
    // ignore
  }
}

// ---------------------- REST 엔드포인트 ----------------------
// GET /api/posts - 모두 조회
app.get('/api/posts', async (req, res) => {
  try {
    const q = `SELECT id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt" FROM posts ORDER BY id DESC`;
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
    const q = `SELECT id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt" FROM posts WHERE id = $1 LIMIT 1`;
    const { rows } = await pool.query(q, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(`GET /api/posts/${id} 오류:`, err);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST /api/posts - 새 게시글 (동적 컬럼 자동생성 포함)
app.post('/api/posts', cpUpload, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const title = (req.body.title || '').trim();
    const author = (req.body.author || '익명').trim();
    if (!title) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Title required' });
    }

    let blocks = parseMaybeJSON(req.body.contentBlocks, []);
    if (!Array.isArray(blocks)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'contentBlocks must be an array' });
    }

    // 파일과 블록 매칭
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

    // 동적 컬럼 처리: req.body의 알려진 키 제외하고 자동 컬럼 생성
    const excluded = new Set(['contentBlocks', 'content_blocks', 'comments', 'media', 'title', 'author']);
    const payloadCols = {};
    for (const k of Object.keys(req.body)) {
      if (excluded.has(k)) continue;
      const col = k.trim();
      if (!isValidIdentifier(col)) continue; // 허용되지 않는 키는 건너뜀
      payloadCols[col] = req.body[k];
    }

    // 기존 컬럼 조회 및 필요하면 추가 (제한 수 적용)
    const existing = await getExistingColumns(client, 'posts', 'public');
    let createdCount = 0;
    for (const [col, val] of Object.entries(payloadCols)) {
      if (!existing.has(col)) {
        if (createdCount >= MAX_AUTOCREATE_COLUMNS) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Auto-create column limit reached (${MAX_AUTOCREATE_COLUMNS})` });
        }
        const typ = guessSQLType(val);
        await addColumnIfMissing(client, 'posts', col, typ, 'public');
        existing.add(col);
        createdCount++;
      }
    }

    // INSERT 준비
    const insertCols = ['title','author','content_blocks'];
    const placeholders = ['$1','$2','$3'];
    const values = [title, author || '익명', JSON.stringify(blocks)];
    let idx = 4;
    for (const col of Object.keys(payloadCols)) {
      insertCols.push(`"${col}"`);
      placeholders.push(`$${idx++}`);
      values.push(payloadCols[col]);
    }

    const insertSQL = `INSERT INTO posts (${insertCols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt"`;
    const { rows } = await client.query(insertSQL, values);

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error('POST /api/posts 오류 (dynamic):', err);
    res.status(500).json({ error: 'DB insert error', details: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/posts/:id - 수정 (동적 컬럼 처리 포함)
app.put('/api/posts/:id', cpUpload, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 먼저 동적 컬럼이 있으면 생성
    const excluded = new Set(['contentBlocks', 'content_blocks', 'comments', 'media', 'title', 'author']);
    const payloadCols = {};
    for (const k of Object.keys(req.body)) {
      if (excluded.has(k)) continue;
      const col = k.trim();
      if (!isValidIdentifier(col)) continue;
      payloadCols[col] = req.body[k];
    }

    const existing = await getExistingColumns(client, 'posts', 'public');
    let createdCount = 0;
    for (const [col, val] of Object.entries(payloadCols)) {
      if (!existing.has(col)) {
        if (createdCount >= MAX_AUTOCREATE_COLUMNS) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Auto-create column limit reached (${MAX_AUTOCREATE_COLUMNS})` });
        }
        const typ = guessSQLType(val);
        await addColumnIfMissing(client, 'posts', col, typ, 'public');
        existing.add(col);
        createdCount++;
      }
    }

    // 기존 업데이트 로직: title/author/contentBlocks/comments
    const fields = [];
    const values = [];
    let idx = 1;

    if (req.body.title !== undefined) { fields.push(`title = $${idx++}`); values.push(String(req.body.title).trim()); }
    if (req.body.author !== undefined) { fields.push(`author = $${idx++}`); values.push(String(req.body.author)); }

    if (req.body.contentBlocks !== undefined) {
      let blocks = parseMaybeJSON(req.body.contentBlocks, null);
      if (!Array.isArray(blocks)) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid contentBlocks format' }); }

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
      if (commentsVal === null) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid comments format' }); }
      fields.push(`comments = $${idx++}`);
      values.push(JSON.stringify(commentsVal));
    }

    // payloadCols도 update 대상이면 추가
    for (const [col, val] of Object.entries(payloadCols)) {
      fields.push(`"${col}" = $${idx++}`);
      values.push(val);
    }

    if (fields.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No fields to update' }); }
    fields.push(`updated_at = NOW()`);

    const q = `UPDATE posts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, title, author, content_blocks AS "contentBlocks", comments, created_at AS "createdAt", updated_at AS "updatedAt"`;
    values.push(id);
    const { rows } = await client.query(q, values);
    if (rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Post not found' }); }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    console.error(`PUT /api/posts/${id} 오류 (dynamic):`, err);
    res.status(500).json({ error: 'DB update error', details: err.message });
  } finally {
    client.release();
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

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// 시작
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadDir}`);
});
