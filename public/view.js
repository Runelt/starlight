import { showToast } from './alert.js';

const postMeta = document.getElementById('post-meta');
const postTitle = document.getElementById('post-title');
const postContent = document.getElementById('post-content');
const postVideo = document.getElementById('post-video');

const commentsListEl = document.getElementById('comments-list');
const commentFormWrap = document.getElementById('comment-form-wrap');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit');

const deleteBtn = document.getElementById('deleteBtn');
const backBtn = document.getElementById('backBtn');

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

backBtn.addEventListener('click', () => window.history.back());

// 현재 사용자 (로컬 시뮬레이션용)
const currentUser = localStorage.getItem('currentUser');
const currentAdmin = localStorage.getItem('currentAdmin');

// 게시글 로드
let post = null;
async function fetchPost() {
    if (!postId) {
        showToast('게시글 ID가 없습니다.');
        return;
    }
    try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('게시글을 가져오는 데 실패했습니다.');
        post = await res.json();

        // meta: 작성자(작게) + 작성일
        const author = post.author || '익명';
        postMeta.textContent = `작성자: ${author} | 작성일: ${new Date(post.createdAt).toLocaleString()}`;
        postTitle.textContent = post.title;
        postContent.textContent = post.content;

        if (post.video) {
            postVideo.src = post.video;
            postVideo.style.display = 'block';
        } else {
            postVideo.style.display = 'none';
        }

        // 댓글 렌더링
        renderComments();

        // 댓글 작성 폼 표시(로그인한 사용자만)
        if (currentUser || currentAdmin) {
            commentFormWrap.style.display = 'block';
        } else {
            commentFormWrap.style.display = 'none';
        }

        // 삭제 버튼 표시: 작성자 또는 admin만
        if ((currentUser && currentUser === post.author) || currentAdmin) {
            deleteBtn.style.display = 'inline-block';
        } else {
            deleteBtn.style.display = 'none';
        }
    } catch (err) {
        showToast(err.message);
    }
}

function renderComments() {
    commentsListEl.innerHTML = '';
    const comments = Array.isArray(post.comments) ? post.comments : [];
    if (comments.length === 0) {
        commentsListEl.innerHTML = '<p>등록된 댓글이 없습니다.</p>';
        return;
    }
    comments.forEach(c => {
        const el = document.createElement('div');
        el.className = 'comment';
        el.innerHTML = `<strong>${c.author}:</strong> ${c.text}`;
        commentsListEl.appendChild(el);
    });
}

// 댓글 작성
commentSubmitBtn.addEventListener('click', async () => {
    const text = commentInput.value.trim();
    if (!text) return showToast('댓글 내용을 입력하세요');
    if (!currentUser && !currentAdmin) return showToast('로그인이 필요합니다');

    const authorName = currentUser || currentAdmin || '익명';
    const newComment = { author: authorName, text };

    // push locally
    const newComments = Array.isArray(post.comments) ? [...post.comments, newComment] : [newComment];

    try {
        const res = await fetch(`/api/posts/${post.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comments: newComments })
        });
        if (!res.ok) throw new Error('댓글 작성 실패');
        post.comments = newComments;
        commentInput.value = '';
        renderComments();
    } catch (err) {
        showToast(err.message);
    }
});

// 게시글 삭제
deleteBtn.addEventListener('click', async () => {
    const confirmed = confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;
    try {
        const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('삭제 실패');
        showToast('게시글이 삭제되었습니다!', () => window.location.href = 'index.html');
    } catch (err) {
        showToast(err.message);
    }
});

fetchPost();
