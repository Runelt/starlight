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

        // meta: 작성자 + 작성일 그대로 표시
        const author = post.author || '익명';
        const dbTime = post.createdAt; 
        const dateObj = new Date(dbTime + 'Z'); // UTC로 강제 해석
        const formatted = dateObj.toLocaleString('ko-KR', { hour12: false, timeZone: 'Asia/Seoul' });

        // contentBlocks 렌더링
        renderContentBlocks();

        // 댓글 렌더링
        renderComments();

        // 댓글 작성 폼 표시(로그인한 사용자만)
        commentFormWrap.style.display = (currentUser || currentAdmin) ? 'block' : 'none';

        // 삭제 버튼 표시: 작성자 또는 admin만
        deleteBtn.style.display = ((currentUser && currentUser === post.author) || currentAdmin) ? 'inline-block' : 'none';
    } catch (err) {
        showToast(err.message);
    }
}

function renderContentBlocks() {
    postContent.innerHTML = ''; // 초기화
    const blocks = Array.isArray(post.contentBlocks) ? post.contentBlocks : [];

    if (blocks.length === 0) {
        postContent.textContent = '내용이 없습니다.';
        return;
    }

    blocks.forEach(block => {
        let el;
        switch (block.type) {
            case 'text':
                el = document.createElement('p');
                el.textContent = block.content || '';
                break;
            case 'image':
                el = document.createElement('img');
                el.src = block.url || '';
                el.alt = block.filename || '';
                el.style.maxWidth = '100%';
                break;
            case 'video':
                el = document.createElement('video');
                el.src = block.url || '';
                el.controls = true;
                el.style.maxWidth = '100%';
                break;
            default:
                return; // 알 수 없는 타입은 무시
        }
        postContent.appendChild(el);
    });
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
        setTimeout(() => window.location.href = 'index.html', 1000);
    } catch (err) {
        showToast(err.message);
    }
});

fetchPost();
