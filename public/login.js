import { showToast } from './alert.js';

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = {
    login: document.getElementById('login-tab'),
    admin: document.getElementById('admin-tab'),
    home: document.getElementById('home-tab')
};

// 탭 버튼 클릭 시 탭 내용 표시
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

// Gist URL 확인 필요
const usersGistUrl = 'https://gist.githubusercontent.com/Runelt/7d391bd9279f03ddf247b71c4a3f8f23/raw/dcb863e008245520aa11ceeb43388f2c398b7935/users.json';

// 유저 데이터 가져오기
async function fetchUsers() {
    try {
        const response = await fetch(usersGistUrl);
        const data = await response.json();

        // 응답 구조 확인
        console.log(data);  // 응답 구조 확인

        // 유저 목록이 'users' 키 아래 있는지 확인
        if (data && Array.isArray(data.users)) {
            console.log('유저 목록:', data.users);  // 유저 목록 출력
            return data.users;  // 유저 데이터 반환
        } else {
            throw new Error('유저 데이터가 없습니다.');
        }
    } catch (error) {
        console.error('유저 데이터를 가져오는 중 오류 발생:', error);
        return [];  // 오류 발생 시 빈 배열 반환
    }
}

// 로그인 처리 함수
async function handleLogin(isAdmin = false) {
    const username = document.getElementById(isAdmin ? 'admin-username' : 'username').value.trim();
    const password = document.getElementById(isAdmin ? 'admin-password' : 'password').value.trim();

    if (isAdmin) {
        // 관리자 로그인
        if (username === adminAccount.username && password === adminAccount.password) {
            localStorage.setItem('currentAdmin', username);
            showToast('로그인 성공', () => location.href = 'index.html');
        } else {
            showToast('관리자 아이디 또는 비밀번호가 틀렸습니다');
        }
    } else {
        // 일반 사용자 로그인
        try {
            const users = await fetchUsers();  // 유저 목록을 가져오기 위해 기다림
            const user = users.find(u => u.username === username && u.password === password);

            if (user) {
                localStorage.setItem('currentUser', username);
                showToast(`환영합니다, ${username}님`);
                setTimeout(() => {
                    window.location.href = 'index.html'; // 로그인 페이지로 리디렉션
                }, 1000); // 2초 후 로그인 페이지로 이동
            } else {
                showToast('아이디 또는 비밀번호가 틀렸습니다');
            }
        } catch (error) {
            console.error('로그인 중 오류 발생:', error);
            showToast('유저 데이터를 가져오는 데 문제가 발생했습니다');
        }
    }
}

// 로그인 버튼 이벤트 리스너
document.getElementById('login-btn').addEventListener('click', () => handleLogin(false));  // 일반 로그인
document.getElementById('admin-login-btn').addEventListener('click', () => handleLogin(true));  // 관리자 로그인

// 회원 가입 알림
document.getElementById('signup').addEventListener('click', async () => {
    showToast('회원가입은 디스코드로 문의해주세요');
});