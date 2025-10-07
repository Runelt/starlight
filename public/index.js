const postsEl = document.getElementById('posts');
const paginationEl = document.getElementById('pagination');

let currentPage = 1;
const postsPerPage = 5;
let posts = [];

// 게시글 불러오기
async function fetchPosts() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) throw new Error('게시글을 가져오는 데 실패했습니다.');
    posts = await res.json();
    renderPage(currentPage);
  } catch (err) {
    postsEl.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

// 특정 페이지 렌더링
function renderPage(page) {
  postsEl.innerHTML = '';
  const start = (page - 1) * postsPerPage;
  const end = start + postsPerPage;
  const pagePosts = posts.slice(start, end);

  if (pagePosts.length === 0) {
    postsEl.innerHTML = '<p>등록된 게시글이 없습니다.</p>';
    paginationEl.innerHTML = '';
    return;
  }

  pagePosts.forEach(post => {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
      <h3><a href="post.html?id=${post.id}">${post.title}</a></h3>
      <p>${post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content}</p>
    `;
    postsEl.appendChild(div);
  });

  renderPagination();
}

// 페이지네이션 버튼 생성
function renderPagination() {
  paginationEl.innerHTML = '';
  const pageCount = Math.ceil(posts.length / postsPerPage);

  for (let i = 1; i <= pageCount; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = (i === currentPage) ? 'active' : '';
    btn.addEventListener('click', () => {
      currentPage = i;
      renderPage(currentPage);
      // 스크롤 맨 위로
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    paginationEl.appendChild(btn);
  }
}

// 로그인 상태 업데이트
function updateLoginBtn() {
  const login = document.getElementById('login');
  const currentUser = localStorage.getItem('currentUser');
  const currentAdmin = localStorage.getItem('currentAdmin');
  login.textContent = (currentUser || currentAdmin) ? '로그아웃' : '로그인';
}

// 로그인 상태 확인
function checkLoginStatus() {
  const currentUser = localStorage.getItem('currentUser');
  const currentAdmin = localStorage.getItem('currentAdmin');
  const writeBtn = document.getElementById('writeBtn');  // 게시글 작성 버튼

  // 로그인한 사용자라면
  if (currentUser || currentAdmin) {
    writeBtn.disabled = false;  // 로그인 상태에서는 버튼 활성화
  }
}

// 로그인 버튼 클릭 시 로그인 페이지로 이동
const login = document.getElementById('login');
if (login) {
  login.addEventListener('click', () => {
    const currentUser = localStorage.getItem('currentUser');
    const currentAdmin = localStorage.getItem('currentAdmin');
    
    if (currentUser || currentAdmin) {
      // 이미 로그인 상태라면 로그아웃 처리
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentAdmin');
      login.textContent = '로그인';  // 로그인 버튼 텍스트 업데이트
      showToast('로그아웃 되었습니다');
    } else {
      // 로그인 상태가 아니라면 로그인 페이지로 이동
      window.location.href = 'login.html';
    }
  });
}

// 토스트 알림 함수 (알림창)
import { showToast } from './alert.js';

// 게시글 작성 버튼 이벤트
const writeBtn = document.getElementById('writeBtn');
if (writeBtn) {
  writeBtn.addEventListener('click', () => {
    if (!localStorage.getItem('currentUser') && !localStorage.getItem('currentAdmin')) {
      // 로그인되지 않은 경우
      showToast('로그인이 필요합니다');
    } else {
        window.location.href = 'post.html';
    }
  });
}

// 페이지 로드 시 로그인 상태 확인
checkLoginStatus();
updateLoginBtn();

// 초기 데이터 불러오기
fetchPosts();
