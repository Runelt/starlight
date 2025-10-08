import { showToast } from './alert.js';

const postTitle = document.getElementById('post-title');
const postContent = document.getElementById('post-content');
const postVideo = document.getElementById('post-video');
const postDate = document.getElementById('post-date');
const postAuthor = document.getElementById('post-author');
const deleteBtn = document.getElementById('deleteBtn');
const backBtn = document.getElementById('backBtn');

backBtn.addEventListener('click', () => window.history.back());

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

async function fetchPost() {
    if (!postId) {
        showToast('게시글 ID가 없습니다.');
        return;
    }

    try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('게시글을 가져오는 데 실패했습니다.');
        const post = await res.json();

        postTitle.textContent = post.title;
        postContent.textContent = post.content;
        postDate.textContent = `작성일: ${new Date(post.createdAt).toLocaleString()}`;
        postAuthor.textContent = `작성자: ${post.author || '익명'}`;
        
        if (post.video) {
            postVideo.src = post.video;
            postVideo.style.display = 'block';
        }

        // 로그인 사용자 확인 후 작성자가 맞으면 삭제 버튼 활성화
        const currentUser = localStorage.getItem('currentUser');
        const currentAdmin = localStorage.getItem('currentAdmin');
        if ((currentUser && currentUser === post.author) || currentAdmin) {
            deleteBtn.style.display = 'inline-block';
        }

    } catch (err) {
        showToast(err.message);
    }
}

deleteBtn.addEventListener('click', async () => {
    const confirmed = confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
        const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('삭제 실패');
        showToast('게시글이 삭제되었습니다!', () => window.location.href = 'index.html');
    } catch (err) {
        showToast(err.message);
    }
});

fetchPost();
