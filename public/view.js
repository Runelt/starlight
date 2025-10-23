import { showToast } from './alert.js';

const postMeta = document.getElementById('post-meta');
const postTitle = document.getElementById('post-title');
const postContent = document.getElementById('post-content');
const commentsListEl = document.getElementById('comments-list');
const commentFormWrap = document.getElementById('comment-form-wrap');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit');
const deleteBtn = document.getElementById('deleteBtn');
const backBtn = document.getElementById('backBtn');

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

backBtn.addEventListener('click', () => window.history.back());

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

        const author = post.author || '익명';
        postMeta.textContent = `${author} | ${new Date(post.createdAt).toLocaleString()}`;
        postTitle.textContent = post.title;

        renderPostContent(post.contentBlocks);

        renderComments();

        commentFormWrap.style.display = (currentUser || currentAdmin) ? 'block' : 'none';

        deleteBtn.style.display =
            ((currentUser && currentUser === post.author) || currentAdmin) ? 'inline-block' : 'none';
    } catch (err) {
        showToast(err.message);
    }
}

function renderPostContent(blocks) {
    postContent.innerHTML = '';
    if (!Array.isArray(blocks) || blocks.length === 0) {
        postContent.innerHTML = '<p>내용이 없습니다.</p>';
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
                el = document.createElement('p');
                el.textContent = '[알 수 없는 블록]';
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

deleteBtn.addEventListener('click', async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
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
