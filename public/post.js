import { showToast } from './alert.js';

const postForm = document.getElementById('postForm');
const cancelBtn = document.getElementById('cancelBtn');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.querySelector('.custom-file-label');

// 파일 선택 UI
fileLabel.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    fileLabel.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : '파일 선택';
});

// 취소 버튼
cancelBtn.addEventListener('click', () => window.location.href = 'index.html');

// 글 작성 제출
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

    // 비디오 업로드가 있는지 확인
    const hasVideo = fileInput.files.length > 0;

    try {
        let apiUrl = '/api/posts'; // 기본 내장 DB
        if (hasVideo) {
            // 비디오가 있으면 외장 DB 사용
            apiUrl = '/api/posts/external'; // 서버에서 외장 DB 처리용 엔드포인트
        }

        const res = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            showToast('게시글이 등록되었습니다!', () => {
                window.location.href = 'index.html';
            });
        } else {
            const text = await res.text();
            showToast(`게시글 등록 실패: ${text}`);
        }
    } catch (err) {
        console.error(err);
        showToast('오류가 발생했습니다');
    }
});
