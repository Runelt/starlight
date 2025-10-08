const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer 설정
const upload = multer({ dest: uploadDir });

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// posts.json 로딩
const POSTS_FILE = path.join(__dirname, 'posts.json');
let posts = [];
try {
    posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
} catch {
    posts = [];
}

// 게시글 목록
app.get('/api/posts', (req, res) => {
    res.json(posts);
});

// 게시글 상세
app.get('/api/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    const post = posts.find(p => p.id === id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
});

// 게시글 작성
app.post('/api/posts', upload.single('video'), (req, res) => {
    const { title, content } = req.body;
    const video = req.file ? `/uploads/${req.file.filename}` : null;

    const newPost = {
        id: Date.now(),
        title,
        content,
        video,
        createdAt: new Date().toISOString(),
        comments: [] // 댓글 초기화
    };

    posts.unshift(newPost);
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.redirect('/');
});

// 게시글 수정 (댓글 포함)
app.put('/api/posts/:id', upload.single('video'), (req, res) => {
    const id = Number(req.params.id);
    const post = posts.find(p => p.id === id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const { title, content, comments } = req.body;

    if (title) post.title = title;
    if (content) post.content = content;
    if (req.file) post.video = `/uploads/${req.file.filename}`;

    // 댓글 업데이트
    if (comments) {
        try {
            post.comments = typeof comments === 'string' ? JSON.parse(comments) : comments;
        } catch (e) {
            console.error('comments parsing error', e);
        }
    }

    post.updatedAt = new Date().toISOString();

    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json(post);
});

// 게시글 삭제
app.delete('/api/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    const initialLength = posts.length;
    posts = posts.filter(p => p.id !== id);

    if (posts.length === initialLength)
        return res.status(404).json({ error: 'Post not found' });

    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json({ message: 'Deleted' });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
