import { showToast } from './alert.js';

const postForm = document.getElementById('postForm');
const cancelBtn = document.getElementById('cancelBtn');
const fileInput = document.getElementById('fileInput');
const fileLabel = document.querySelector('.custom-file-label');
const authorInput = document.getElementById('post-author-input');

// 파일 라벨 클릭 시 파일 선택
fileLabel.addEventListener('click', () => fileInput.click());

// 파일 선택 시 라벨 텍스트 변경
fileInput.addEventListener('change', () => {
    if (fileInput.files.length === 0) {
        fileLabel.textContent = '파일 선택';
    } else if (fileInput.files.length === 1) {
        fileLabel.textContent = fileInput.files[0].name;
    } else {
        fileLabel.textContent = `${fileInput.files.length}개 파일 선택`;
    }
});

// 취소 버튼
cancelBtn.addEventListener('click', () => window.location.href = 'index.html');

// 페이지 로드 시 작성자 값 셋팅
function setAuthorField() {
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');
    const who = currentUser || currentAdmin || '';
    if (authorInput) authorInput.value = who;
}
setAuthorField();

// 제출 이벤트
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 로그인 여부 확인
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');
    if (!currentUser && !currentAdmin) {
        showToast('로그인이 필요합니다');
        return;
    }

    // FormData 생성
    const formData = new FormData();

    // 제목
    formData.append('title', postForm.title.value);
    // 작성자
    formData.append('author', authorInput.value);

    // 기존 textarea(content)도 contentBlocks 형태로 변환
    const contentBlocks = [];
    if (postForm.content && postForm.content.value.trim() !== '') {
        contentBlocks.push({ type: 'text', content: postForm.content.value.trim() });
    }

    // 업로드 파일 처리
    Array.from(fileInput.files).forEach(file => {
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        contentBlocks.push({ type }); // url은 서버에서 채워짐
    });

    formData.append('contentBlocks', JSON.stringify(contentBlocks));

    // 실제 파일 FormData에 첨부
    Array.from(fileInput.files).forEach(file => {
        formData.append('media', file);
    });

    try {
        const res = await fetch('/api/posts', {
            method: 'POST',
            body: formData
        });

        if (res.ok || res.redirected) {
            showToast('게시글이 등록되었습니다!');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            const text = await res.text();
            showToast(`게시글 등록 실패: ${text}`);
        }
    } catch (err) {
        console.error(err);
        showToast('오류가 발생했습니다');
    }
});
