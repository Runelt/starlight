// view-post.js
import { showToast } from './alert.js';

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

const titleEl = document.getElementById('title');
const contentEl = document.getElementById('content');
const videoEl = document.getElementById('video');
const commentsEl = document.getElementById('comments');
const backBtn = document.getElementById('backBtn');

// 게시글 가져오기
async function fetchPost() {
    try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('게시글을 가져오는 데 실패했습니다.');
        const post = await res.json();

        titleEl.textContent = post.title;
        contentEl.textContent = post.content;

        if (post.video) {
            videoEl.src = post.video;
            videoEl.style.display = 'block';
        }

    } catch (err) {
        showToast(err.message);
        titleEl.textContent = '게시글 로드 실패';
        contentEl.textContent = '';
    }
}

// 댓글 가져오기 (읽기 전용)
async function fetchComments() {
    try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        if (!res.ok) throw new Error('댓글을 불러오는 데 실패했습니다.');
        const comments = await res.json();

        commentsEl.innerHTML = '';
        if (comments.length === 0) {
            commentsEl.textContent = '댓글이 없습니다.';
            return;
        }

        comments.forEach(c => {
            const div = document.createElement('div');
            div.className = 'comment';
            div.textContent = `${c.author}: ${c.text}`;
            commentsEl.appendChild(div);
        });

    } catch (err) {
        commentsEl.textContent = err.message;
    }
}

// 목록 버튼
backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});

// 초기 실행
fetchPost();
fetchComments();