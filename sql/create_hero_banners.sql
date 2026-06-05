-- 히어로 배너 테이블 생성
CREATE TABLE IF NOT EXISTS hero_banners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    icon VARCHAR(50) DEFAULT NULL COMMENT '이모지 아이콘',
    icon_image VARCHAR(500) DEFAULT NULL COMMENT '아이콘 이미지 URL',
    number VARCHAR(50) NOT NULL COMMENT '표시할 숫자',
    unit VARCHAR(20) DEFAULT NULL COMMENT '단위 (예: +, 년, %, 일)',
    label VARCHAR(100) NOT NULL COMMENT '라벨 텍스트',
    link VARCHAR(500) DEFAULT NULL COMMENT '클릭 시 이동할 링크',
    order_num INT DEFAULT 0 COMMENT '표시 순서',
    active BOOLEAN DEFAULT TRUE COMMENT '활성화 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order (order_num),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='히어로 배너 관리';

-- 기본 데이터 삽입
INSERT INTO hero_banners (icon, number, unit, label, order_num, active) VALUES
('🏪', '500', '+', '거래처', 1, TRUE),
('📅', '15', '년', '업력', 2, TRUE),
('😊', '99', '%', '고객 만족도', 3, TRUE),
('📦', '365', '일', '연중 무휴 공급', 4, TRUE);