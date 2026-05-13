const http = require('http');
const fs = require('fs');
require('dotenv').config();

console.log('=== 연혁 CRUD 테스트 ===\n');

// 로그인 토큰 가져오기
async function getAuthToken() {
  const postData = JSON.stringify({
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'eden2026!'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.ok && result.token) {
          resolve(result.token);
        } else {
          reject(new Error('로그인 실패'));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 현재 연혁 데이터 조회
async function getHistoryData(token) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/about',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        resolve(result);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 테스트 실행
async function runTests() {
  try {
    // 1. 로그인
    console.log('1. 관리자 로그인...');
    const token = await getAuthToken();
    console.log('✓ 로그인 성공\n');

    // 2. 현재 연혁 데이터 조회
    console.log('2. 현재 연혁 데이터 조회...');
    const data = await getHistoryData(token);
    
    console.log('API 응답:', JSON.stringify(data, null, 2));
    
    if (data.ok || data.success) {
      const historyData = data.history || (data.data && data.data.history) || [];
      console.log(`✓ 연혁 데이터 ${historyData.length}개 발견:`);
      historyData.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.year} - ${item.content}`);
        if (item.image) {
          console.log(`      이미지: ${item.image}`);
        }
      });
    } else {
      console.log('✗ 연혁 데이터를 가져올 수 없음');
    }

    // 3. admin/about 페이지 체크
    console.log('\n3. admin/about 페이지 확인...');
    const pageResponse = await new Promise((resolve, reject) => {
      http.get('http://localhost:3000/admin/about', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });

    if (pageResponse.status === 200) {
      console.log('✓ 페이지 로드 성공');
      
      // 주요 함수 확인
      const functions = [
        'loadHistoryList',
        'addHistoryItem',
        'selectHistoryImage',
        'handleHistoryImageSelect',
        'removeHistoryImage',
        'saveHistory'
      ];
      
      console.log('\n연혁 관련 함수 확인:');
      functions.forEach(func => {
        if (pageResponse.data.includes(func)) {
          console.log(`✓ ${func} 함수 존재`);
        } else {
          console.log(`✗ ${func} 함수 없음`);
        }
      });
    }

    // 4. 연혁 이미지 업로드 API 테스트
    console.log('\n4. 연혁 이미지 업로드 API 확인...');
    const uploadTestOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/about/upload-image',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
    
    // HEAD 요청으로 엔드포인트 존재 확인
    const uploadExists = await new Promise((resolve) => {
      const req = http.request({ ...uploadTestOptions, method: 'HEAD' }, (res) => {
        resolve(res.statusCode !== 404);
      });
      req.on('error', () => resolve(false));
      req.end();
    });
    
    console.log(uploadExists ? '✓ 업로드 API 존재' : '✗ 업로드 API 없음');

  } catch (error) {
    console.error('테스트 중 오류:', error);
  }
}

runTests();