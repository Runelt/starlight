import { showToast } from './alert.js';

const postMeta = document.getElementById('post-meta');
const postTitle = document.getElementById('post-title');
const postContent = document.getElementById('post-content');
const postVideo = document.getElementById('post-video');
const deleteBtn = document.getElementById('deleteBtn');
const backBtn = document.getElementById('backBtn');

const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

backBtn.addEventListener('click', () => window.history.back());

async function fetchPost() {
    if (!postId) {
        showToast('게시글 ID가 없습니다.');
        return;
    }

    try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error('게시글을 가져오는 데 실패했습니다.');
        const post = await res.json();

        // 작성자 표시: 로그인 상태 확인
        const currentUser = localStorage.getItem('currentUser');
        const currentAdmin = localStorage.getItem('currentAdmin');
        let authorName = post.author || '익명';
        if (currentUser && post.author === currentUser) {
            authorName = currentUser;
        } else if (currentAdmin) {
            authorName = post.author || '익명';
        }

        postMeta.textContent = `${authorName} | ${new Date(post.createdAt).toLocaleString()}`;
        postTitle.textContent = post.title;
        postContent.textContent = post.content;

        if (post.video) {
            postVideo.src = post.video;
            postVideo.style.display = 'block';
        }

        // 작성자 또는 관리자만 삭제 버튼 보이게
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
