const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

let posts = [];
try {
    posts = JSON.parse(fs.readFileSync('./posts.json'));
} catch { }

app.get('/api/posts', (req, res) => {
    res.json(posts);
});

app.get('/api/posts/:id', (req, res) => {
    const post = posts.find(p => p.id == req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
});

app.post('/api/posts', upload.single('video'), (req, res) => {
    const { title, content } = req.body;
    const video = req.file ? `/uploads/${req.file.filename}` : null;
    const newPost = {
        id: Date.now(),
        title,
        content,
        video,
        createdAt: new Date().toISOString(),
    };
    posts.unshift(newPost);
    fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2));
    res.redirect('/');
});

app.delete('/api/posts/:id', (req, res) => {
    const id = Number(req.params.id);
    posts = posts.filter(p => p.id !== id);
    fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2));
    res.json({ message: 'Deleted' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
