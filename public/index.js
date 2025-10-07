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

// 글쓰기 버튼 클릭 이벤트
const writeBtn = document.getElementById('writeBtn');
if (writeBtn) {
  writeBtn.addEventListener('click', () => {
    window.location.href = 'post.html'; // 글쓰기 페이지로 이동
  });
}

// 초기 데이터 불러오기
fetchPosts();