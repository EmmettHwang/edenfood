require('dotenv').config();
const mysql = require('mysql2/promise');

async function initBrands() {
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
    // 기존 브랜드 확인
    const [existing] = await pool.query('SELECT name FROM brands');
    console.log('기존 브랜드:', existing.map(b => b.name));

    // 홍가네 추가
    const [hongane] = await pool.query('SELECT id FROM brands WHERE name = ?', ['홍가네']);
    if (hongane.length === 0) {
      await pool.query(
        `INSERT INTO brands (name, tagline, description, logo_url, color_primary, color_secondary, website, status, order_num) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          '홍가네',
          '전통 한식의 맛',
          '정성을 담은 전통 한식 브랜드입니다. 엄선된 재료와 전통 조리법으로 건강하고 맛있는 한식을 제공합니다.',
          '/assets/hongane.png',
          '#dc2626',
          '#b91c1c', 
          '',
          'active',
          1
        ]
      );
      console.log('홍가네 브랜드 추가 완료');
    }

    // 차이나 감자탕 추가
    const [namchaina] = await pool.query('SELECT id FROM brands WHERE name = ?', ['차이나 감자탕']);
    if (namchaina.length === 0) {
      await pool.query(
        `INSERT INTO brands (name, tagline, description, logo_url, color_primary, color_secondary, website, status, order_num) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          '차이나 감자탕',
          '중화풍 감자탕의 새로운 맛',
          '한국의 감자탕과 중국 요리의 조화로운 만남. 진한 국물과 풍부한 재료로 새로운 감자탕의 맛을 선사합니다.',
          '/assets/namchaina.jpg',
          '#f59e0b',
          '#d97706',
          '',
          'active', 
          2
        ]
      );
      console.log('차이나 감자탕 브랜드 추가 완료');
    }

    // 최종 확인
    const [allBrands] = await pool.query('SELECT * FROM brands ORDER BY order_num');
    console.log('\n현재 등록된 브랜드:');
    allBrands.forEach(brand => {
      console.log(`- ${brand.name} (${brand.status})`);
    });

    await pool.end();
  } catch (error) {
    console.error('브랜드 초기화 중 오류:', error);
    await pool.end();
    process.exit(1);
  }
}

initBrands();