const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 업로드 디렉토리 설정
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer 설정 (POST 업로드에만 사용)
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

// GET 전체
app.get('/api/posts', (req, res) => {
    res.json(posts);
});

// GET 상세
app.get('/api/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    const post = posts.find(p => p.id === id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
});

// POST 작성 (비디오 업로드 가능)
app.post('/api/posts', upload.single('video'), (req, res) => {
    const { title, content, author } = req.body;
    const video = req.file ? `/uploads/${req.file.filename}` : null;

    const newPost = {
        id: Date.now(),
        title,
        content,
        author: author || '익명',
        video,
        createdAt: new Date().toISOString(),
        comments: []
    };

    posts.unshift(newPost);
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    // 클라이언트가 폼으로 보낸 경우 redirect, AJAX로 받는다면 JSON 리턴하도록 클라이언트와 맞추세요
    res.redirect('/');
});

// PUT 수정 (댓글 포함 — JSON 바디로 comments 배열 전달)
app.put('/api/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    const index = posts.findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Post not found' });

    // req.body may contain title/content/comments etc.
    const { title, content, comments } = req.body;

    if (title !== undefined) posts[index].title = title;
    if (content !== undefined) posts[index].content = content;

    // comments는 배열로 전달해야 함. (클라이언트에서 JSON.stringify 하지 않아야 함)
    if (comments !== undefined) {
        // 안전: 문자열로 올 수도 있으니 파싱 시도
        if (typeof comments === 'string') {
            try {
                posts[index].comments = JSON.parse(comments);
            } catch (e) {
                // ignore parse error
            }
        } else if (Array.isArray(comments)) {
            posts[index].comments = comments;
        }
    }

    posts[index].updatedAt = new Date().toISOString();
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json(posts[index]);
});

// DELETE
app.delete('/api/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    const initialLength = posts.length;
    posts = posts.filter(p => p.id !== id);

    if (posts.length === initialLength)
        return res.status(404).json({ error: 'Post not found' });

    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json({ message: 'Deleted' });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
