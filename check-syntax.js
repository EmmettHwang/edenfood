const fs = require('fs');
const vm = require('vm');

// HTML 파일에서 JavaScript 추출 및 문법 검사
function checkJavaScriptSyntax(filePath) {
  console.log(`=== ${filePath} JavaScript 문법 검사 ===\n`);
  
  const html = fs.readFileSync(filePath, 'utf8');
  
  // 모든 script 태그 찾기
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptCount = 0;
  let errorCount = 0;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptCount++;
    const scriptContent = match[1];
    const scriptStart = html.lastIndexOf('<script', match.index);
    const lineNumber = html.substring(0, scriptStart).split('\n').length;
    
    console.log(`\nScript #${scriptCount} (줄 ${lineNumber}부터 시작):`);
    
    try {
      // 문법 검사
      new vm.Script(scriptContent, { 
        filename: filePath,
        lineOffset: lineNumber - 1
      });
      console.log('✅ 문법 오류 없음');
    } catch (error) {
      errorCount++;
      console.log('❌ 문법 오류 발견!');
      console.log(`   오류: ${error.message}`);
      
      // 오류 위치 찾기
      if (error.stack) {
        const stackLines = error.stack.split('\n');
        const errorLine = stackLines[0];
        console.log(`   위치: ${errorLine}`);
      }
      
      // 오류 주변 코드 표시
      const lines = scriptContent.split('\n');
      const errorLineMatch = error.message.match(/at line (\d+)|:(\d+):/);
      if (errorLineMatch) {
        const errorLineNum = parseInt(errorLineMatch[1] || errorLineMatch[2]) - 1;
        const startLine = Math.max(0, errorLineNum - 2);
        const endLine = Math.min(lines.length, errorLineNum + 3);
        
        console.log('\n   오류 주변 코드:');
        for (let i = startLine; i < endLine; i++) {
          const marker = i === errorLineNum ? ' >>> ' : '     ';
          console.log(`   ${lineNumber + i}:${marker}${lines[i]}`);
        }
      }
    }
  }
  
  // 추가 검사: 중괄호 매칭
  console.log('\n=== 중괄호 매칭 검사 ===');
  let openBraces = 0;
  let closeBraces = 0;
  let openParens = 0;
  let closeParens = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    const prevChar = i > 0 ? html[i-1] : '';
    
    // 문자열 내부 체크
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') closeBraces++;
      if (char === '(') openParens++;
      if (char === ')') closeParens++;
    }
  }
  
  console.log(`중괄호: { ${openBraces} vs } ${closeBraces}`);
  console.log(`소괄호: ( ${openParens} vs ) ${closeParens}`);
  
  if (openBraces !== closeBraces) {
    console.log(`❌ 중괄호 불일치! 차이: ${openBraces - closeBraces}`);
  } else {
    console.log('✅ 중괄호 매칭 정상');
  }
  
  if (openParens !== closeParens) {
    console.log(`❌ 소괄호 불일치! 차이: ${openParens - closeParens}`);
  } else {
    console.log('✅ 소괄호 매칭 정상');
  }
  
  console.log(`\n총 ${scriptCount}개의 스크립트 블록 중 ${errorCount}개에서 오류 발견`);
  
  // 특정 패턴 검사
  console.log('\n=== 일반적인 문제 패턴 검사 ===');
  
  // catch 블록 뒤에 } 누락
  const catchPattern = /} catch \([^)]+\) {[\s\S]*?}\s*(?!})/g;
  let catchMatch;
  while ((catchMatch = catchPattern.exec(html)) !== null) {
    const lineNum = html.substring(0, catchMatch.index).split('\n').length;
    console.log(`⚠️  줄 ${lineNum}: catch 블록 후 } 누락 가능성`);
  }
  
  // if 블록 내부 들여쓰기 문제
  const badIndentPattern = /\n\s*if\s*\([^)]+\)\s*{\s*\n\s{0,2}\S/g;
  let indentMatch;
  while ((indentMatch = badIndentPattern.exec(html)) !== null) {
    const lineNum = html.substring(0, indentMatch.index).split('\n').length;
    console.log(`⚠️  줄 ${lineNum}: if 블록 들여쓰기 문제 가능성`);
  }
  
  return errorCount === 0;
}

// 실행
const filePath = process.argv[2] || '/var/eden/admin/about.html';
const isValid = checkJavaScriptSyntax(filePath);

if (!isValid) {
  console.log('\n❌ 문법 오류가 있습니다. 수정이 필요합니다.');
  process.exit(1);
} else {
  console.log('\n✅ 모든 JavaScript 문법이 정상입니다.');
  process.exit(0);
}