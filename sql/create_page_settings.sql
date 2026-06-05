-- 페이지 설정 테이블 생성
CREATE TABLE IF NOT EXISTS page_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_name VARCHAR(50) NOT NULL UNIQUE,
  header_title VARCHAR(255),
  header_subtitle TEXT,
  header_image VARCHAR(255),
  content JSON,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_page_name (page_name),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기본 페이지 설정 추가
INSERT INTO page_settings (page_name, header_title, header_subtitle) VALUES
  ('about', '회사소개', '건강한 식재료로 만드는 행복한 식탁, 이든푸드'),
  ('products', '제품소개', '맛있고 건강한 한식 메뉴를 만나보세요'),
  ('brands', '브랜드소개', '이든푸드와 함께하는 성공 창업 이야기'),
  ('logistics', '물류·유통시스템', '최첨단 콜드체인 시스템으로 신선함을 그대로 전달합니다'),
  ('gallery', '갤러리', '이든푸드의 다양한 모습을 만나보세요'),
  ('documents', '서식자료실', '유용한 문서와 자료를 다운로드하세요'),
  ('contact', '문의하기', '궁금하신 점이 있으시면 언제든지 문의해주세요')
ON DUPLICATE KEY UPDATE 
  header_title = VALUES(header_title),
  header_subtitle = VALUES(header_subtitle);