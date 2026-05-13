require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'edenfood-intranet-secret-2026';

async function testCeoUpdate() {
  console.log('=== CEO 이미지 업데이트 직접 테스트 ===\n');
  
  // 데이터베이스 연결
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'edenfood',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'edenfood',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  try {
    // 1. 관리자 토큰 생성 (로그인 시뮬레이션)
    console.log('1. 관리자 토큰 생성...');
    const token = jwt.sign(
      { id: 2, username: 'admin', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log('✓ 토큰 생성 완료');
    
    // 2. CEO 메시지 직접 업데이트
    console.log('\n2. CEO 메시지 데이터베이스 직접 업데이트...');
    await pool.query(
      `INSERT INTO about_content (id, greeting_text, greeting_author, greeting_image)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       greeting_text = VALUES(greeting_text),
       greeting_author = VALUES(greeting_author),
       greeting_image = VALUES(greeting_image)`,
      ['테스트 CEO 인사말입니다.', '이든푸드 대표이사', '/uploads/test-ceo.jpg']
    );
    console.log('✓ 데이터베이스 업데이트 완료');
    
    // 3. 업데이트된 내용 확인
    console.log('\n3. 업데이트된 내용 확인...');
    const [rows] = await pool.query('SELECT * FROM about_content WHERE id = 1');
    if (rows.length > 0) {
      console.log('✓ CEO 메시지 조회 성공:');
      console.log('  - greeting_text:', rows[0].greeting_text);
      console.log('  - greeting_author:', rows[0].greeting_author);
      console.log('  - greeting_image:', rows[0].greeting_image);
    } else {
      console.log('✗ CEO 메시지를 찾을 수 없습니다.');
    }
    
    // 4. API 호출 테스트
    console.log('\n4. API를 통한 업데이트 테스트...');
    const http = require('http');
    
    // 작은 base64 이미지 (1x1 빨간색 픽셀)
    const smallBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const postData = JSON.stringify({
      greeting_text: 'API 테스트 CEO 인사말',
      greeting_author: 'API 테스트 작성자',
      greeting_image: `data:image/png;base64,${smallBase64}`
    });
    
    console.log('  - 요청 데이터 크기:', Buffer.byteLength(postData), 'bytes');
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/about/greeting',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${token}`
      }
    };
    
    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('  - 응답 상태 코드:', res.statusCode);
          console.log('  - 응답 데이터:', data);
          resolve({ statusCode: res.statusCode, data });
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    // 5. 최종 확인
    console.log('\n5. 최종 데이터 확인...');
    const [finalRows] = await pool.query('SELECT * FROM about_content WHERE id = 1');
    if (finalRows.length > 0) {
      console.log('✓ 최종 CEO 메시지:');
      console.log('  - greeting_text:', finalRows[0].greeting_text);
      console.log('  - greeting_image:', finalRows[0].greeting_image);
    }
    
  } catch (error) {
    console.error('테스트 중 오류:', error);
  } finally {
    await pool.end();
    console.log('\n테스트 완료');
  }
}

testCeoUpdate().catch(console.error);