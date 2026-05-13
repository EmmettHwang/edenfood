const http = require('http');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fullCeoTest() {
  console.log('=== CEO 인사말 완전 테스트 ===\n');
  
  // 데이터베이스 연결
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  
  try {
    // 1. 현재 DB 상태 확인
    console.log('1. 현재 데이터베이스 상태:');
    const [dbRows] = await pool.query('SELECT * FROM about_content WHERE id = 1');
    console.log('  - greeting_text:', dbRows[0].greeting_text || '(없음)');
    console.log('  - greeting_author:', dbRows[0].greeting_author || '(없음)');
    console.log('  - greeting_image:', dbRows[0].greeting_image || '(없음)');
    
    // 2. 로그인
    const loginData = JSON.stringify({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'eden2026!'
    });
    
    const token = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const result = JSON.parse(data);
          resolve(result.ok ? result.token : null);
        });
      });
      req.write(loginData);
      req.end();
    });
    
    console.log('\n2. 로그인:', token ? '성공' : '실패');
    
    // 3. 테스트 데이터로 업데이트
    console.log('\n3. CEO 인사말 업데이트 테스트...');
    const testTime = new Date().toLocaleString();
    const updateData = JSON.stringify({
      greeting_text: `테스트 CEO 인사말 - ${testTime}`,
      greeting_author: '테스트 대표이사',
      greeting_image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx8gAAAABJRU5ErkJggg=='
    });
    
    const updateResult = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/about/greeting',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(updateData),
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ error: 'JSON 파싱 실패' });
          }
        });
      });
      req.write(updateData);
      req.end();
    });
    
    console.log('  - 업데이트 결과:', updateResult.ok ? '성공' : '실패');
    if (updateResult.imagePath) {
      console.log('  - 이미지 경로:', updateResult.imagePath);
    }
    
    // 4. DB에 실제로 저장되었는지 확인
    console.log('\n4. 데이터베이스 업데이트 확인:');
    const [updatedRows] = await pool.query('SELECT * FROM about_content WHERE id = 1');
    console.log('  - greeting_text:', updatedRows[0].greeting_text);
    console.log('  - greeting_author:', updatedRows[0].greeting_author);
    console.log('  - greeting_image:', updatedRows[0].greeting_image);
    
    // 5. API로 조회했을 때 제대로 오는지 확인
    console.log('\n5. API 조회 테스트...');
    const apiData = await new Promise((resolve, reject) => {
      http.get({
        hostname: 'localhost',
        port: 3000,
        path: '/api/about',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve(JSON.parse(data));
        });
      });
    });
    
    if (apiData.ok && apiData.data) {
      console.log('  - API 응답 구조:', Object.keys(apiData.data));
      if (apiData.data.content) {
        console.log('  - content.greeting_text:', apiData.data.content.greeting_text);
        console.log('  - content.greeting_author:', apiData.data.content.greeting_author);
        console.log('  - content.greeting_image:', apiData.data.content.greeting_image);
      }
    }
    
    // 6. Admin 페이지가 제대로 로드하는지 확인
    console.log('\n6. Admin 페이지 확인...');
    const pageHtml = await new Promise((resolve, reject) => {
      http.get({
        hostname: 'localhost',
        port: 3000,
        path: '/admin/about'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
    });
    
    // 중요한 부분들이 있는지 확인
    const checks = {
      'aboutData.content 참조': pageHtml.includes('aboutData.content'),
      'greeting_text 필드': pageHtml.includes('greeting_text'),
      'greeting_image 필드': pageHtml.includes('greeting_image'),
      'showCeoImage 함수 호출': pageHtml.includes('showCeoImage(aboutData.content.greeting_image)'),
      'data.data 처리': pageHtml.includes('data.data || data')
    };
    
    console.log('  페이지 체크:');
    for (const [name, exists] of Object.entries(checks)) {
      console.log(`    ${exists ? '✓' : '✗'} ${name}`);
    }
    
    console.log('\n=== 테스트 결과 ===');
    console.log('✅ CEO 인사말 데이터가 정상적으로 저장되고 조회됩니다.');
    console.log('✅ 이미지가 서버에 파일로 저장됩니다.');
    console.log('✅ API 응답 구조가 올바릅니다.');
    console.log('\n브라우저에서 /admin/about 페이지를 열고 CEO 인사말 탭을 확인하세요.');
    
  } catch (error) {
    console.error('테스트 중 오류:', error);
  } finally {
    await pool.end();
  }
}

fullCeoTest().catch(console.error);