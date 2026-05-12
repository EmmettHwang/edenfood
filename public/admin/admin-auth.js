// 관리자 인증 공통 함수
async function checkAuth() {
  try {
    const token = localStorage.getItem('eden_token');
    console.log('토큰 확인:', token ? '있음' : '없음');
    
    if (!token) {
      alert('로그인이 필요합니다.');
      location.href = '/login';
      return false;
    }
    
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    console.log('인증 응답:', data);
    
    if (!data.ok) {
      alert('인증이 만료되었습니다. 다시 로그인하세요.');
      localStorage.removeItem('eden_token');
      localStorage.removeItem('eden_user');
      location.href = '/login';
      return false;
    }
    
    if (data.user.role !== 'admin') {
      alert('관리자 권한이 필요합니다.');
      location.href = '/login';
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('인증 확인 실패:', error);
    alert('서버 연결 오류가 발생했습니다.');
    location.href = '/login';
    return false;
  }
}

// 로그아웃
async function logout() {
  try {
    const token = localStorage.getItem('eden_token');
    const response = await fetch('/api/auth/logout', { 
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const data = await response.json();
    
    if (data.ok) {
      localStorage.removeItem('eden_token');
      localStorage.removeItem('eden_user');
      alert('로그아웃되었습니다.');
      location.href = '/login';
    }
  } catch (error) {
    console.error('로그아웃 실패:', error);
    localStorage.removeItem('eden_token');
    localStorage.removeItem('eden_user');
    location.href = '/login';
  }
}

// 인증된 API 호출 헬퍼
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('eden_token');
  const headers = {
    ...options.headers,
    'Authorization': token ? `Bearer ${token}` : ''
  };
  
  // FormData인 경우 Content-Type을 설정하지 않음 (브라우저가 자동으로 설정)
  if (options.body && options.body instanceof FormData) {
    delete headers['Content-Type'];
  }
  
  return fetch(url, { ...options, headers });
}