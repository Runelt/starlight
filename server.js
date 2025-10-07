const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 라우트 먼저 선언
app.post('/api/posts', upload.single('video'), (req, res, next) => {
  try {
    const { title, content } = req.body;
    const video = req.file ? req.file.filename : null;

    let posts = [];
    try {
      posts = JSON.parse(fs.readFileSync('./posts.json'));
    } catch {}

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
  } catch (err) {
    next(err);
  }
});

// 정적 파일 제공 (마지막에 위치)
app.use(express.static('public'));

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('서버 내부 오류');
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
