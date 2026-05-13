const http = require('http');

// HTTP 기반 자동화 테스트
async function runAutomatedTest() {
  console.log('=== CEO 이미지 업로드 자동화 테스트 ===\n');
  
  // 1. 서버 상태 확인
  console.log('1. 서버 상태 확인...');
  try {
    const response = await new Promise((resolve, reject) => {
      http.get('http://localhost:3000', (res) => {
        resolve(res.statusCode);
      }).on('error', reject);
    });
    console.log('✓ 서버 응답:', response);
  } catch (error) {
    console.log('✗ 서버 연결 실패:', error.message);
    return;
  }
  
  // 2. admin/about 페이지 확인
  console.log('\n2. Admin About 페이지 확인...');
  const pageContent = await new Promise((resolve, reject) => {
    http.get('http://localhost:3000/admin/about', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
  
  // 필수 요소 확인
  const checks = {
    'ceo-image-upload 요소': pageContent.includes('id="ceo-image-upload"'),
    'ceo-image-input 요소': pageContent.includes('id="ceo-image-input"'),
    'selectCeoImage 함수': pageContent.includes('selectCeoImage'),
    'handleCeoImageSelect 함수': pageContent.includes('handleCeoImageSelect'),
    'onclick 핸들러': pageContent.includes('onclick="selectCeoImage()"'),
    'onchange 핸들러': pageContent.includes('onchange="handleCeoImageSelect(event)"'),
    'window.selectCeoImage 정의': pageContent.includes('window.selectCeoImage'),
    'window.handleCeoImageSelect 정의': pageContent.includes('window.handleCeoImageSelect')
  };
  
  console.log('페이지 요소 확인:');
  for (const [item, exists] of Object.entries(checks)) {
    console.log(`  ${exists ? '✓' : '✗'} ${item}`);
  }
  
  // 3. JavaScript 에러 확인
  console.log('\n3. JavaScript 구문 검사...');
  
  // script 태그 추출
  const scriptMatches = pageContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  console.log(`  - 스크립트 태그: ${scriptMatches ? scriptMatches.length : 0}개`);
  
  // 함수 정의 순서 확인
  const selectCeoImageIndex = pageContent.indexOf('window.selectCeoImage');
  const handleCeoImageSelectIndex = pageContent.indexOf('window.handleCeoImageSelect');
  const onclickIndex = pageContent.indexOf('onclick="selectCeoImage()"');
  const onchangeIndex = pageContent.indexOf('onchange="handleCeoImageSelect(event)"');
  
  console.log('\n함수 정의 순서:');
  console.log(`  - window.selectCeoImage 정의 위치: ${selectCeoImageIndex}`);
  console.log(`  - window.handleCeoImageSelect 정의 위치: ${handleCeoImageSelectIndex}`);
  console.log(`  - onclick 사용 위치: ${onclickIndex}`);
  console.log(`  - onchange 사용 위치: ${onchangeIndex}`);
  
  if (selectCeoImageIndex > onclickIndex) {
    console.log('  ⚠️  경고: selectCeoImage가 사용되기 전에 정의되지 않음!');
  }
  if (handleCeoImageSelectIndex > onchangeIndex) {
    console.log('  ⚠️  경고: handleCeoImageSelect가 사용되기 전에 정의되지 않음!');
  }
  
  // 4. 실제 함수 구현 확인
  console.log('\n4. 실제 함수 구현 확인...');
  
  // handleCeoImageSelect 전체 구현 찾기
  const fullImplMatch = pageContent.match(/window\.handleCeoImageSelect\s*=\s*async\s*function\s*\([^)]*\)\s*{[\s\S]*?}\s*(?=window\.|function|$)/);
  if (fullImplMatch) {
    console.log('  ✓ handleCeoImageSelect 전체 구현 발견');
    const implLength = fullImplMatch[0].length;
    console.log(`  - 구현 크기: ${implLength} 문자`);
    
    // 주요 기능 확인
    const impl = fullImplMatch[0];
    console.log(`  - FileReader 사용: ${impl.includes('FileReader') ? '✓' : '✗'}`);
    console.log(`  - readAsDataURL 사용: ${impl.includes('readAsDataURL') ? '✓' : '✗'}`);
    console.log(`  - fetch 사용: ${impl.includes('fetch') ? '✓' : '✗'}`);
  } else {
    console.log('  ✗ handleCeoImageSelect 전체 구현을 찾을 수 없음');
  }
  
  console.log('\n테스트 완료!');
  
  // 5. 권장사항
  console.log('\n권장사항:');
  console.log('1. 브라우저에서 http://localhost:3000/test-ceo-browser.html 열기');
  console.log('2. 순서대로 버튼을 클릭하여 테스트 진행');
  console.log('3. 콘솔 로그 확인');
}

runAutomatedTest().catch(console.error);