const http = require('http');
const fs = require('fs');
require('dotenv').config();

// Test configuration
const baseUrl = 'http://localhost:3000';
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

let authToken = '';

// Helper function to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Test 1: Admin Login
async function testAdminLogin() {
  console.log('\n=== 테스트 1: 관리자 로그인 ===');
  
  const postData = JSON.stringify({
    username: adminUsername,
    password: adminPassword
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  try {
    const result = await makeRequest(options, postData);
    if (result.status === 200 && result.data.ok && result.data.token) {
      authToken = result.data.token;
      console.log('✅ 로그인 성공');
      return true;
    } else {
      console.log('❌ 로그인 실패:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ 로그인 요청 실패:', error.message);
    return false;
  }
}

// Test 2: Get About Content
async function testGetAboutContent() {
  console.log('\n=== 테스트 2: 회사소개 내용 조회 ===');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/about',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  };

  try {
    const result = await makeRequest(options);
    if (result.status === 200 && result.data.ok) {
      console.log('✅ 회사소개 조회 성공');
      if (result.data.data.ceo_message_image) {
        console.log('   - CEO 인사말 이미지:', result.data.data.ceo_message_image);
      }
      return true;
    } else {
      console.log('❌ 회사소개 조회 실패:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ 회사소개 조회 요청 실패:', error.message);
    return false;
  }
}

// Test 3: Update CEO Message with Image
async function testUpdateCeoMessage() {
  console.log('\n=== 테스트 3: CEO 인사말 업데이트 (이미지 포함) ===');
  
  // Create test image data (small 1x1 PNG)
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  const postData = JSON.stringify({
    greeting_text: '테스트 CEO 인사말입니다.',
    greeting_image: `data:image/png;base64,${testImageBase64}`
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/about/greeting',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${authToken}`
    }
  };

  try {
    const result = await makeRequest(options, postData);
    if (result.status === 200 && result.data.ok) {
      console.log('✅ CEO 인사말 업데이트 성공');
      
      // Verify the image was saved
      const getResult = await testGetAboutContent();
      if (getResult) {
        const aboutData = await makeRequest({
          hostname: 'localhost',
          port: 3000,
          path: '/api/about',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (aboutData.data.data.ceo_message_image && 
            aboutData.data.data.ceo_message_image.startsWith('/uploads/')) {
          console.log('✅ CEO 이미지가 서버에 저장됨:', aboutData.data.data.ceo_message_image);
          
          // Check if file exists on disk
          const imagePath = '/var/eden' + aboutData.data.data.ceo_message_image;
          if (fs.existsSync(imagePath)) {
            console.log('✅ 이미지 파일이 디스크에 존재함');
          } else {
            console.log('❌ 이미지 파일이 디스크에 없음');
          }
        }
      }
      return true;
    } else {
      console.log('❌ CEO 인사말 업데이트 실패:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ CEO 인사말 업데이트 요청 실패:', error.message);
    return false;
  }
}

// Test 4: Check Admin Page Access
async function testAdminPageAccess() {
  console.log('\n=== 테스트 4: 관리자 페이지 접근 테스트 ===');
  
  const pages = [
    '/admin',
    '/admin/about',
    '/admin/notices',
    '/admin/documents'
  ];

  for (const page of pages) {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: page,
      method: 'GET'
    };

    try {
      const result = await makeRequest(options);
      if (result.status === 200) {
        console.log(`✅ ${page} - 접근 가능`);
      } else {
        console.log(`❌ ${page} - 접근 불가 (상태 코드: ${result.status})`);
      }
    } catch (error) {
      console.log(`❌ ${page} - 요청 실패:`, error.message);
    }
  }
}

// Test 5: Test Static File Serving
async function testStaticFiles() {
  console.log('\n=== 테스트 5: 정적 파일 서빙 테스트 ===');
  
  const files = [
    '/css/global.css',
    '/css/landing.css',
    '/favicon.ico',
    '/assets/landing.css'
  ];

  for (const file of files) {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: file,
      method: 'HEAD'
    };

    try {
      const result = await makeRequest(options);
      if (result.status === 200) {
        console.log(`✅ ${file} - 접근 가능`);
      } else {
        console.log(`❌ ${file} - 접근 불가 (상태 코드: ${result.status})`);
      }
    } catch (error) {
      console.log(`❌ ${file} - 요청 실패:`, error.message);
    }
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Eden Food 관리자 시스템 테스트 시작...\n');
  
  // Check if server is running
  try {
    await makeRequest({ hostname: 'localhost', port: 3000, path: '/', method: 'HEAD' });
  } catch (error) {
    console.log('❌ 서버가 실행되지 않습니다. 서버를 먼저 시작하세요.');
    process.exit(1);
  }

  let results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  // Run tests
  const tests = [
    testAdminLogin,
    testGetAboutContent,
    testUpdateCeoMessage,
    testAdminPageAccess,
    testStaticFiles
  ];

  for (const test of tests) {
    results.total++;
    try {
      const passed = await test();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.log('❌ 테스트 실행 중 오류:', error.message);
      results.failed++;
    }
  }

  // Summary
  console.log('\n=== 테스트 결과 요약 ===');
  console.log(`총 테스트: ${results.total}`);
  console.log(`성공: ${results.passed}`);
  console.log(`실패: ${results.failed}`);
  
  if (results.failed === 0) {
    console.log('\n✅ 모든 테스트 통과!');
  } else {
    console.log('\n❌ 일부 테스트 실패');
  }
}

// Run tests
runTests().catch(console.error);