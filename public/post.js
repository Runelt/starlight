// post.html
window.onload = async function() {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (!postId) {
    return alert("잘못된 접근입니다.");
  }

  const res = await fetch(`/api/posts/${postId}`);
  if (res.ok) {
    const post = await res.json();
    // 게시글 내용 표시
    document.getElementById('postTitle').innerText = post.title;
    document.getElementById('postContent').innerText = post.content;
    // 댓글도 함께 표시 (아래에서 다루는 댓글 기능과 결합)
  } else {
    alert('게시글을 불러오는 데 실패했습니다.');
  }
};

document.getElementById('commentForm').addEventListener('submit', async function(event) {
  event.preventDefault();
  
  const commentText = document.getElementById('commentText').value;
  const postId = new URLSearchParams(window.location.search).get('id');

  const res = await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: commentText })
  });

  if (res.ok) {
    showToast('댓글이 추가되었습니다!');
    loadComments(postId); // 댓글 갱신
  } else {
    showToast('댓글 추가 실패');
  }
});

async function loadComments(postId) {
  const res = await fetch(`/api/posts/${postId}/comments`);
  if (res.ok) {
    const comments = await res.json();
    const commentsDiv = document.getElementById('comments');
    commentsDiv.innerHTML = '';
    comments.forEach(comment => {
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment';
      commentDiv.innerHTML = `
        <p>${comment.text}</p>
      `;
      commentsDiv.appendChild(commentDiv);
    });
  }
}

// 페이지 로드 시 댓글 불러오기
const postId = new URLSearchParams(window.location.search).get('id');
loadComments(postId);
