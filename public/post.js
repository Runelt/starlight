import { showToast } from './alert.js';

const postForm = document.getElementById('postForm');
const cancelBtn = document.getElementById('cancelBtn');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.querySelector('.custom-file-label');
const authorInput = document.getElementById('post-author-input');

fileLabel.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    fileLabel.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : '파일 선택';
});

cancelBtn.addEventListener('click', () => window.location.href = 'index.html');

// 페이지 로드 시 작성자 값을 셋팅
function setAuthorField() {
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');
    const who = currentUser || currentAdmin || '';
    if (authorInput) authorInput.value = who;
}
setAuthorField();

// 제출
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 로그인 여부 확인
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');
    if (!currentUser && !currentAdmin) {
        showToast('로그인이 필요합니다');
        return;
    }

    const formData = new FormData(postForm);
    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            body: formData
        });

        // 서버가 redirect 한다면 fetch가 200을 반환. 간단하게 성공 판단
        if (res.ok || res.redirected) {
            showToast('게시글이 등록되었습니다!');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000); // toast가 사라진 후 이동
        } else {
            const text = await res.text();
            showToast(`게시글 등록 실패: ${text}`);
        }
    } catch (err) {
        console.error(err);
        showToast('오류가 발생했습니다');
    }
});
