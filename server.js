const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let posts = require('./posts.json');

// 게시글 목록 가져오기
app.get('/api/posts', (req, res) => {
  res.json(posts);
});

// 게시글 업로드
app.post('/api/posts', upload.single('video'), (req, res) => {
  const { title, content } = req.body;
  const video = req.file ? req.file.filename : null;

  const newPost = {
    id: Date.now(),
    title,
    content,
    video,
    createdAt: new Date().toISOString()
  };

  posts.unshift(newPost);
  fs.writeFileSync('./posts.json', JSON.stringify(posts, null, 2));
  res.redirect('/');
});

// 게시글 상세 보기
app.get('/api/posts/:id', (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.status(404).send('Not found');
  res.json(post);
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});