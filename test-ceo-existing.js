const http = require('http');
require('dotenv').config();

async function testCeoExistingImage() {
  console.log('=== CEO 기존 이미지 표시 테스트 ===\n');
  
  // 1. 로그인
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
        if (result.ok && result.token) {
          resolve(result.token);
        } else {
          reject(new Error('로그인 실패'));
        }
      });
    });
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
  
  console.log('1. 로그인 성공\n');
  
  // 2. About 데이터 조회
  console.log('2. CEO 인사말 데이터 조회...');
  const aboutData = await new Promise((resolve, reject) => {
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
    }).on('error', reject);
  });
  
  if (aboutData.ok && aboutData.data && aboutData.data.content) {
    const content = aboutData.data.content;
    console.log('✓ CEO 인사말 데이터:');
    console.log('  - greeting_text:', content.greeting_text || '(없음)');
    console.log('  - greeting_author:', content.greeting_author || '(없음)');
    console.log('  - greeting_image:', content.greeting_image || '(없음)');
  } else {
    console.log('✗ CEO 인사말 데이터를 가져올 수 없음');
  }
  
  // 3. Admin 페이지 확인
  console.log('\n3. Admin About 페이지 확인...');
  const pageHtml = await new Promise((resolve, reject) => {
    http.get({
      hostname: 'localhost',
      port: 3000,
      path: '/admin/about'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
  
  // CEO 이미지 관련 요소 확인
  const checks = {
    'showCeoImage 함수': pageHtml.includes('showCeoImage'),
    'ceo-image-upload 요소': pageHtml.includes('id="ceo-image-upload"'),
    'greeting_image 로드 코드': pageHtml.includes('aboutData.content.greeting_image'),
    'showCeoImage 호출': pageHtml.includes('showCeoImage(aboutData.content.greeting_image)')
  };
  
  console.log('페이지 요소 확인:');
  for (const [name, exists] of Object.entries(checks)) {
    console.log(`  ${exists ? '✓' : '✗'} ${name}`);
  }
  
  // 4. 실제 이미지 표시 확인을 위한 추가 테스트
  console.log('\n4. CEO 이미지 업데이트 테스트...');
  
  // 작은 테스트 이미지로 업데이트
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  const updateData = JSON.stringify({
    greeting_text: '테스트 CEO 인사말',
    greeting_author: '테스트 대표',
    greeting_image: testImageBase64
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
          resolve({ error: '응답 파싱 실패' });
        }
      });
    });
    req.on('error', reject);
    req.write(updateData);
    req.end();
  });
  
  if (updateResult.ok) {
    console.log('✓ CEO 이미지 업데이트 성공');
    console.log('  - 이미지 경로:', updateResult.imagePath);
    
    // 5. 업데이트 후 다시 조회
    console.log('\n5. 업데이트 후 데이터 재조회...');
    const newData = await new Promise((resolve, reject) => {
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
      }).on('error', reject);
    });
    
    if (newData.ok && newData.data && newData.data.content) {
      const newContent = newData.data.content;
      console.log('✓ 업데이트된 CEO 인사말 데이터:');
      console.log('  - greeting_text:', newContent.greeting_text);
      console.log('  - greeting_author:', newContent.greeting_author);
      console.log('  - greeting_image:', newContent.greeting_image);
      
      if (newContent.greeting_image && newContent.greeting_image.startsWith('/uploads/')) {
        console.log('\n✅ CEO 이미지가 성공적으로 저장되고 표시될 준비가 되었습니다!');
        console.log('브라우저에서 /admin/about 페이지를 열면 기존 이미지가 표시됩니다.');
      }
    }
  } else {
    console.log('✗ CEO 이미지 업데이트 실패:', updateResult.error || updateResult.message);
  }
  
  console.log('\n테스트 완료!');
}

testCeoExistingImage().catch(console.error);