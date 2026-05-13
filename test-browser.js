const http = require('http');
const fs = require('fs');

// Simulate browser loading admin/about page
async function testAdminAboutPage() {
  console.log('=== 브라우저 시뮬레이션: /admin/about 페이지 로드 ===\n');

  // 1. Load the HTML page
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/admin/about',
    method: 'GET',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Test Browser)'
    }
  };

  let html = '';
  await new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`✓ HTML 페이지 로드: ${res.statusCode}`);
      res.on('data', chunk => html += chunk);
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });

  // 2. Extract script functions from HTML
  console.log('\n=== JavaScript 함수 검사 ===');
  
  const functionChecks = [
    'window.selectCeoImage',
    'window.handleDragOver',
    'window.handleDragLeave', 
    'window.handleDrop',
    'window.showTab',
    'selectCeoImage',
    'aboutData'
  ];

  for (const func of functionChecks) {
    if (html.includes(func)) {
      console.log(`✓ ${func} 함수 발견`);
    } else {
      console.log(`✗ ${func} 함수 없음`);
    }
  }

  // 3. Check for var declarations that might cause issues
  console.log('\n=== 잠재적 문제 검사 ===');
  
  const varMatches = html.match(/var\s+(selectCeoImage|handleDragOver|handleDragLeave|handleDrop|showTab)/g);
  if (varMatches) {
    console.log('⚠️  문제가 될 수 있는 var 선언 발견:');
    varMatches.forEach(match => console.log(`   - ${match}`));
  } else {
    console.log('✓ 문제가 될 var 선언 없음');
  }

  // 4. Check onclick handlers
  console.log('\n=== onclick 핸들러 검사 ===');
  
  const onclickMatches = html.match(/onclick="[^"]+"/g);
  if (onclickMatches) {
    console.log('발견된 onclick 핸들러:');
    onclickMatches.slice(0, 10).forEach(match => {
      console.log(`   - ${match}`);
    });
    if (onclickMatches.length > 10) {
      console.log(`   ... 외 ${onclickMatches.length - 10}개`);
    }
  }

  // 5. Check CEO image related elements
  console.log('\n=== CEO 이미지 관련 요소 ===');
  
  const ceoElements = [
    'ceo-drop-zone',
    'ceo-preview',
    'ceo-image-input',
    'ceo-message-content'
  ];

  for (const elem of ceoElements) {
    if (html.includes(`id="${elem}"`)) {
      console.log(`✓ ${elem} 요소 존재`);
    } else {
      console.log(`✗ ${elem} 요소 없음`);
    }
  }

  // 6. Check if functions are properly defined in window scope
  console.log('\n=== window 스코프 함수 정의 확인 ===');
  
  const windowFunctionPattern = /window\.(selectCeoImage|handleDragOver|handleDragLeave|handleDrop)\s*=\s*function/g;
  const windowFunctions = html.match(windowFunctionPattern);
  
  if (windowFunctions) {
    console.log('✓ window 스코프에 정의된 함수들:');
    windowFunctions.forEach(func => console.log(`   - ${func.split('=')[0].trim()}`));
  } else {
    console.log('✗ window 스코프에 정의된 함수 없음');
  }

  // Save the HTML for manual inspection
  fs.writeFileSync('/var/eden/test-about-page.html', html);
  console.log('\n✓ 페이지 내용이 /var/eden/test-about-page.html에 저장됨');
}

// Run the test
testAdminAboutPage().catch(console.error);