import { showToast } from './alert.js';

const postMeta = document.getElementById('post-meta');
const postTitle = document.getElementById('post-title');
const postContent = document.getElementById('post-content');
const postMedia = document.getElementById('post-media'); // 이미지/비디오 렌더링용 div

const commentsListEl = document.getElementById('comments-list');
const commentFormWrap = document.getElementById('comment-form-wrap');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit');

const deleteBtn = document.getElementById('deleteBtn');
const backBtn = document.getElementById('backBtn');

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

backBtn.addEventListener('click', () => window.history.back());

// 현재 사용자
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

        // meta: 작성자 + 작성일
        const author = post.author || '익명';
        const created = post.createdAt ? new Date(post.createdAt).toLocaleString() : '';
        postMeta.textContent = `${author} | ${created}`;
        postTitle.textContent = post.title;

        // content_blocks 렌더링
        renderContentBlocks();

        // 댓글 렌더링
        renderComments();

        // 댓글 작성 폼 표시
        commentFormWrap.style.display = (currentUser || currentAdmin) ? 'block' : 'none';

        // 삭제 버튼 표시
        deleteBtn.style.display = ((currentUser && currentUser === post.author) || currentAdmin) ? 'inline-block' : 'none';
    } catch (err) {
        showToast(err.message);
    }
}

// content_blocks 렌더링
function renderContentBlocks() {
    postContent.innerHTML = '';
    postMedia.innerHTML = '';

    if (!Array.isArray(post.contentBlocks) || post.contentBlocks.length === 0) {
        postContent.textContent = '내용이 없습니다.';
        return;
    }

    post.contentBlocks.forEach(block => {
        if (!block || !block.type) return;

        if (block.type === 'text') {
            const p = document.createElement('p');
            p.textContent = block.content || '';
            postContent.appendChild(p);
        } else if (block.type === 'image') {
            const img = document.createElement('img');
            img.src = block.url;
            img.alt = block.filename || '';
            img.style.maxWidth = '100%';
            postMedia.appendChild(img);
        } else if (block.type === 'video') {
            const video = document.createElement('video');
            video.src = block.url;
            video.controls = true;
            video.style.maxWidth = '100%';
            postMedia.appendChild(video);
        }
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
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (err) {
        showToast(err.message);
    }
});

fetchPost();
