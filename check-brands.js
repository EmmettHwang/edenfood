#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkBrands() {
  let pool;
  
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'eden',
      password: process.env.DB_PASS || 'eden1234',
      database: process.env.DB_NAME || 'eden',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10
    });

    console.log('=== 현재 등록된 브랜드 목록 ===\n');

    const [brands] = await pool.query('SELECT * FROM brands ORDER BY order_num, name');
    
    if (brands.length === 0) {
      console.log('등록된 브랜드가 없습니다.');
    } else {
      brands.forEach((brand, index) => {
        console.log(`[${index + 1}] ${brand.name}`);
        console.log(`   - ID: ${brand.id}`);
        console.log(`   - 슬로건: ${brand.tagline || '(없음)'}`);
        console.log(`   - 설명: ${brand.description || '(없음)'}`);
        console.log(`   - 로고: ${brand.logo_url || '(없음)'}`);
        console.log(`   - 메인 색상: ${brand.color_primary}`);
        console.log(`   - 보조 색상: ${brand.color_secondary || '(없음)'}`);
        console.log(`   - 웹사이트: ${brand.website || '(없음)'}`);
        console.log(`   - 상태: ${brand.status}`);
        console.log(`   - 순서: ${brand.order_num}`);
        console.log(`   - 생성일: ${brand.created_at}`);
        console.log('');
      });
      
      console.log(`총 ${brands.length}개의 브랜드가 등록되어 있습니다.`);
    }

  } catch (error) {
    console.error('브랜드 조회 실패:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

checkBrands();