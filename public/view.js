import { showToast } from './alert.js';

const loginBtn = document.getElementById('login');
const writeBtn = document.getElementById('writeBtn');
const postTitleEl = document.getElementById('post-title');
const postContentEl = document.getElementById('post-content');
const postVideoEl = document.getElementById('post-video');
const postDateEl = document.getElementById('post-date');
const commentsListEl = document.getElementById('comments-list');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit');
const deleteBtn = document.getElementById('deleteBtn');

let posts = [];
let post = null;
let comments = [];

// URL에서 id 가져오기
const postId = new URLSearchParams(window.location.search).get('id');

// 로그인 상태 확인
function checkLoginStatus() {
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');
    loginBtn.textContent = (currentUser || currentAdmin) ? '로그아웃' : '로그인';
}

loginBtn.addEventListener('click', () => {
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');

    if (currentUser || currentAdmin) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentAdmin');
        showToast('로그아웃 되었습니다');
        checkLoginStatus();
    } else {
        window.location.href = 'login.html';
    }
});

// 글쓰기 버튼
writeBtn.addEventListener('click', () => {
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');

    if (!currentUser && !currentAdmin) {
        showToast('로그인이 필요합니다');
    } else {
        window.location.href = 'post.html';
    }
});

// 게시글 불러오기
async function fetchPost() {
    try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('게시글을 가져오는 데 실패했습니다.');
        post = await res.json();

        postTitleEl.textContent = post.title;
        postContentEl.textContent = post.content;
        postDateEl.textContent = new Date(post.createdAt).toLocaleString();

        if (post.video) {
            postVideoEl.src = post.video;
            postVideoEl.style.display = 'block';
        }

        // 댓글 초기화
        comments = post.comments || [];
        renderComments();
    } catch (err) {
        showToast(err.message);
    }
}

// 댓글 렌더링
function renderComments() {
    commentsListEl.innerHTML = '';
    if (comments.length === 0) {
        commentsListEl.innerHTML = '<p>등록된 댓글이 없습니다.</p>';
        return;
    }
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment';
        div.innerHTML = `<strong>${c.author}:</strong> ${c.text}`;
        commentsListEl.appendChild(div);
    });
}

// 댓글 작성
commentSubmitBtn.addEventListener('click', async () => {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return showToast('로그인이 필요합니다');

    const text = commentInput.value.trim();
    if (!text) return showToast('댓글 내용을 입력하세요');

    comments.push({ author: currentUser, text });
    post.comments = comments;

    // posts.json 업데이트
    try {
        await fetch(`/api/posts/${post.id}`, {
            method: 'PUT', // PUT 메서드로 게시글 전체 업데이트
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post)
        });
        commentInput.value = '';
        renderComments();
    } catch (err) {
        showToast('댓글 작성 실패');
    }
});

// 게시글 삭제
deleteBtn.addEventListener('click', async () => {
    const confirmed = confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('삭제 실패');
        showToast('게시글이 삭제되었습니다!');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (err) {
        showToast(err.message);
    }
});

// 초기 실행
checkLoginStatus();
fetchPost();
