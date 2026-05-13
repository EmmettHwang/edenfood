require('dotenv').config();
const mysql = require('mysql2/promise');

async function updateGanpan() {
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
    // ganpan.ai를 ganpan.png로 변경
    await pool.query(
      `UPDATE gallery_images 
       SET image_url = '/assets/ganpan.png', 
           thumbnail_url = '/assets/ganpan.png'
       WHERE title = '매장 간판'`
    );
    
    console.log('매장 간판 이미지를 ganpan.png로 변경했습니다.');
    
    await pool.end();
  } catch (error) {
    console.error('업데이트 중 오류:', error);
    await pool.end();
    process.exit(1);
  }
}

updateGanpan();