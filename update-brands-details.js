require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateBrandDetails() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'edenfood',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    // 홍가네 상세 정보 업데이트
    const honganeDesc = `전통 한식의 정성을 담아 만든 프리미엄 한식 브랜드입니다.
엄선된 재료와 정통 조리법으로 한국의 맛을 제대로 전달합니다.

• 100% 국내산 재료 사용
• 전통 발효 장류 사용
• 수제 반찬 매일 제조
• 건강한 한식 메뉴`;

    await pool.query(
      'UPDATE brands SET description = ?, tagline = ? WHERE name = ?',
      [honganeDesc, '전통 한식의 맛과 정성', '홍가네']
    );
    console.log('홍가네 브랜드 상세 정보 업데이트 완료');

    // 차이나 감자탕 상세 정보 업데이트
    const namchainaDesc = `한국 전통 감자탕에 중화 요리의 특별함을 더한 퓨전 브랜드입니다.
진한 사골 육수와 풍성한 재료로 새로운 감자탕의 기준을 제시합니다.

• 24시간 우려낸 진한 사골 육수
• 중화풍 특제 양념 사용
• 신선한 국내산 돼지 등뼈
• 다양한 중화 요리 메뉴`;

    await pool.query(
      'UPDATE brands SET description = ?, tagline = ? WHERE name = ?',
      [namchainaDesc, '중화풍 감자탕의 새로운 맛', '차이나 감자탕']
    );
    console.log('차이나 감자탕 브랜드 상세 정보 업데이트 완료');

    // 최종 확인
    const [allBrands] = await pool.query('SELECT * FROM brands ORDER BY order_num');
    console.log('\n현재 브랜드 정보:');
    allBrands.forEach(brand => {
      console.log(`\n[${brand.name}]`);
      console.log('태그라인:', brand.tagline);
      console.log('설명:', brand.description.substring(0, 50) + '...');
      console.log('로고:', brand.logo_url);
      console.log('상태:', brand.status);
    });

    await pool.end();
  } catch (error) {
    console.error('브랜드 업데이트 중 오류:', error);
    await pool.end();
    process.exit(1);
  }
}

updateBrandDetails();