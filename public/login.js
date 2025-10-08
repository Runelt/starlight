import { showToast } from './alert.js';

// 탭 버튼과 내용
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = {
    login: document.getElementById('login-tab'),
    admin: document.getElementById('admin-tab'),
    home: document.getElementById('home-tab')
};

// 기본 활성 탭 설정
let activeTab = 'login';
Object.keys(tabContents).forEach(k => {
    tabContents[k].style.display = (k === activeTab) ? 'block' : 'none';
});
tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === activeTab) btn.classList.add('active');
});

// 탭 버튼 클릭 이벤트
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.getAttribute('data-tab');
        Object.keys(tabContents).forEach(k => tabContents[k].style.display = 'none');
        tabContents[tab].style.display = 'block';
    });
});

// 기본 관리자 계정
const adminAccount = { username: 'admin', password: 'admin123' };

// Gist URL (테스트 시 CORS 문제 주의)
const usersGistUrl = 'https://gist.githubusercontent.com/Runelt/7d391bd9279f03ddf247b71c4a3f8f23/raw/dcb863e008245520aa11ceeb43388f2c398b7935/users.json';

// 유저 데이터 가져오기
async function fetchUsers() {
    try {
        const response = await fetch(usersGistUrl);
        const data = await response.json();
        if (data && Array.isArray(data.users)) {
            return data.users;
        } else {
            console.warn('유저 데이터가 users 키 아래에 없습니다.');
            return [];
        }
    } catch (error) {
        console.error('유저 데이터를 가져오는 중 오류 발생:', error);
        return [];
    }
}

// 로그인 처리
async function handleLogin(isAdmin = false) {
    const username = document.getElementById(isAdmin ? 'admin-username' : 'username')?.value.trim();
    const password = document.getElementById(isAdmin ? 'admin-password' : 'password')?.value.trim();

    if (!username || !password) {
        showToast('아이디와 비밀번호를 모두 입력해주세요');
        return;
    }

    if (isAdmin) {
        if (username === adminAccount.username && password === adminAccount.password) {
            localStorage.setItem('currentAdmin', username);
            // showToast 종료 후 바로 리디렉션
            showToast(`관리자 로그인 성공`);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000); // toast가 사라진 후 이동
        } else {
            showToast('관리자 아이디 또는 비밀번호가 틀렸습니다');
        }
    } else {
        const users = await fetchUsers();
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            localStorage.setItem('currentUser', username);
            // showToast 종료 후 바로 리디렉션
            showToast(`환영합니다, ${username}님`);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000); // toast가 사라진 후 이동
        } else {
            showToast('아이디 또는 비밀번호가 틀렸습니다');
        }
    }
}

// 버튼 이벤트 등록
const loginBtn = document.getElementById('login-btn');
const adminLoginBtn = document.getElementById('admin-login-btn');
const signupBtn = document.getElementById('signup');

if (loginBtn) loginBtn.addEventListener('click', () => handleLogin(false));
if (adminLoginBtn) adminLoginBtn.addEventListener('click', () => handleLogin(true));
if (signupBtn) signupBtn.addEventListener('click', () => showToast('회원가입은 디스코드로 문의해주세요'));
