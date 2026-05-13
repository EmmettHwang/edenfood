require('dotenv').config();
const mysql = require('mysql2/promise');

async function initGallery() {
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
    // 기존 갤러리 이미지 확인
    const [existing] = await pool.query('SELECT title FROM gallery_images');
    console.log('기존 갤러리 이미지:', existing.length, '개');

    // 갤러리 이미지 데이터
    const galleryImages = [
      // 제품 이미지
      {
        title: '감자탕',
        description: '진한 국물과 푸짐한 등뼈가 들어간 시그니처 감자탕',
        category: 'product',
        tags: '감자탕,메인메뉴,대표메뉴',
        image_url: '/assets/tang.jpg',
        thumbnail_url: '/assets/thumbnails/thumb_tang.jpg'
      },
      {
        title: '뼈찜',
        description: '부드럽게 익은 등뼈와 특제 양념이 어우러진 뼈찜',
        category: 'product',
        tags: '뼈찜,메인메뉴,인기메뉴',
        image_url: '/assets/jjim.jpg',
        thumbnail_url: '/assets/thumbnails/thumb_jjim.jpg'
      },
      {
        title: '뼈해장국',
        description: '시원하고 깊은 맛의 뼈해장국',
        category: 'product',
        tags: '해장국,국물요리,아침메뉴',
        image_url: '/assets/guk.jpg',
        thumbnail_url: '/assets/thumbnails/thumb_guk.jpg'
      },
      {
        title: '통장아찌',
        description: '아삭하고 새콤한 통장아찌',
        category: 'product',
        tags: '반찬,사이드메뉴,절임',
        image_url: '/assets/tongjang.jpg',
        thumbnail_url: '/assets/thumbnails/thumb_tongjang.jpg'
      },
      {
        title: '남도한정식',
        description: '남도의 정갈한 맛을 담은 한정식',
        category: 'product',
        tags: '한정식,정식,남도음식',
        image_url: '/assets/namchaina.jpg',
        thumbnail_url: '/assets/thumbnails/thumb_namchaina.jpg'
      },
      {
        title: '여수한정식',
        description: '여수의 특별한 맛을 담은 한정식',
        category: 'product',
        tags: '한정식,정식,여수음식',
        image_url: '/assets/yeochina.jpg',
        thumbnail_url: '/assets/thumbnails/thumb_yeochina.jpg'
      },
      // 이벤트 이미지
      {
        title: '창업 기념식',
        description: '이든푸드 창업 기념식 행사',
        category: 'event',
        tags: '창업,기념식,행사',
        image_url: '/assets/saup.png',
        thumbnail_url: '/assets/thumbnails/thumb_saup.png'
      },
      {
        title: '품질 우수상 수상',
        description: '식품 품질 우수상 수상',
        category: 'event',
        tags: '수상,품질인증,우수상',
        image_url: '/assets/sang.jpg',
        thumbnail_url: '/assets/thumbnails/thumb_sang.jpg'
      },
      // 매장 이미지
      {
        title: '매장 간판',
        description: '이든푸드 매장 외관 간판',
        category: 'store',
        tags: '매장,간판,외관',
        image_url: '/assets/ganpan.ai',
        thumbnail_url: '/assets/ganpan.ai'
      }
    ];

    // 각 이미지를 DB에 추가
    for (const image of galleryImages) {
      // 이미 존재하는지 확인
      const [exists] = await pool.query('SELECT id FROM gallery_images WHERE title = ?', [image.title]);
      
      if (exists.length === 0) {
        await pool.query(
          `INSERT INTO gallery_images (title, description, category, tags, image_url, thumbnail_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [image.title, image.description, image.category, image.tags, image.image_url, image.thumbnail_url]
        );
        console.log(`✓ '${image.title}' 추가 완료`);
      } else {
        console.log(`- '${image.title}'는 이미 존재합니다.`);
      }
    }

    // 최종 확인
    const [allImages] = await pool.query('SELECT * FROM gallery_images ORDER BY category, created_at');
    console.log('\n현재 갤러리 이미지 총', allImages.length, '개');
    
    // 카테고리별 개수
    const categories = {};
    allImages.forEach(img => {
      categories[img.category] = (categories[img.category] || 0) + 1;
    });
    
    console.log('카테고리별 이미지 수:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`- ${cat}: ${count}개`);
    });

    await pool.end();
  } catch (error) {
    console.error('갤러리 초기화 중 오류:', error);
    await pool.end();
    process.exit(1);
  }
}

initGallery();