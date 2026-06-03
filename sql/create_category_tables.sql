-- 제품 카테고리 테이블 생성
CREATE TABLE IF NOT EXISTS product_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  order_num INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order (order_num),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 갤러리 카테고리 테이블 생성
CREATE TABLE IF NOT EXISTS gallery_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  order_num INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order (order_num),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 기존 제품 카테고리 데이터 삽입
INSERT INTO product_categories (name, slug, order_num) VALUES
  ('시그니처', 'signature', 1),
  ('감자탕/해장국', 'gamjatang', 2),
  ('사이드 메뉴', 'side', 3),
  ('음료/주류', 'drink', 4);

-- 기존 갤러리 카테고리 데이터 삽입
INSERT INTO gallery_categories (name, slug, order_num) VALUES
  ('제품', 'product', 1),
  ('매장', 'store', 2),
  ('이벤트', 'event', 3),
  ('기타', 'etc', 4);

-- 제품 테이블에 category_id 컬럼 추가
ALTER TABLE products ADD COLUMN category_id INT AFTER category;
ALTER TABLE products ADD CONSTRAINT fk_product_category 
  FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;

-- 갤러리 이미지 테이블에 category_id 컬럼 추가
ALTER TABLE gallery_images ADD COLUMN category_id INT AFTER category;
ALTER TABLE gallery_images ADD CONSTRAINT fk_gallery_category 
  FOREIGN KEY (category_id) REFERENCES gallery_categories(id) ON DELETE SET NULL;

-- 기존 데이터 마이그레이션
UPDATE products p
JOIN product_categories pc ON p.category = pc.slug
SET p.category_id = pc.id;

UPDATE gallery_images g
JOIN gallery_categories gc ON g.category = gc.slug
SET g.category_id = gc.id;

-- 기존 category 컬럼 삭제 (나중에 실행)
-- ALTER TABLE products DROP COLUMN category;
-- ALTER TABLE gallery_images DROP COLUMN category;