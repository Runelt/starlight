import { showToast } from './alert.js';

const postMetaEl = document.getElementById('post-meta');
const postTitleEl = document.getElementById('post-title');
const postContentEl = document.getElementById('post-content');

const commentsListEl = document.getElementById('comments-list');
const commentFormWrap = document.getElementById('comment-form-wrap');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit');

const deleteBtn = document.getElementById('deleteBtn');
const backBtn = document.getElementById('backBtn');

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

// 뒤로가기 버튼
backBtn.addEventListener('click', () => window.history.back());

// 현재 로그인 사용자
const currentUser = localStorage.getItem('currentUser');
const currentAdmin = localStorage.getItem('currentAdmin');

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

        // 작성자 + 날짜 표시
        const author = post.author || '익명';
        postMetaEl.textContent = `${author} | ${new Date(post.createdAt).toLocaleString()}`;
        postTitleEl.textContent = post.title;

        // contentBlocks 렌더링
        renderContentBlocks(post.contentBlocks);

        // 댓글 렌더링
        renderComments();

        // 댓글 작성 폼 표시
        if (currentUser || currentAdmin) {
            commentFormWrap.style.display = 'block';
        } else {
            commentFormWrap.style.display = 'none';
        }

        // 삭제 버튼 표시
        if ((currentUser && currentUser === post.author) || currentAdmin) {
            deleteBtn.style.display = 'inline-block';
        } else {
            deleteBtn.style.display = 'none';
        }
    } catch (err) {
        showToast(err.message);
    }
}

function renderContentBlocks(blocks) {
    postContentEl.innerHTML = '';
    const arr = Array.isArray(blocks) ? blocks : [];

    arr.forEach(block => {
        let el;
        if (block.type === 'text') {
            el = document.createElement('p');
            el.textContent = block.content || '';
        } else if (block.type === 'image') {
            el = document.createElement('img');
            el.src = block.url;
            el.alt = block.filename || '';
            el.style.maxWidth = '100%';
            el.style.margin = '8px 0';
        } else if (block.type === 'video') {
            el = document.createElement('video');
            el.src = block.url;
            el.controls = true;
            el.style.maxWidth = '100%';
            el.style.margin = '8px 0';
        }
        if (el) postContentEl.appendChild(el);
    });
}

// 댓글 렌더링
function renderComments() {
    commentsListEl.innerHTML = '';
    const comments = Array.isArray(post.comments) ? post.comments : [];
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
    const text = commentInput.value.trim();
    if (!text) return showToast('댓글 내용을 입력하세요');
    if (!currentUser && !currentAdmin) return showToast('로그인이 필요합니다');

    const authorName = currentUser || currentAdmin || '익명';
    const newComment = { author: authorName, text };

    // 기존 댓글과 합치기
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
        showToast('게시글이 삭제되었습니다!');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (err) {
        showToast(err.message);
    }
});

fetchPost();
