-- 접속 로그 테이블 생성
CREATE TABLE IF NOT EXISTS access_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  path VARCHAR(255),
  method VARCHAR(10),
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip (ip_address),
  INDEX idx_created (created_at),
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테스트 데이터 삽입 (실제 운영 시 제거)
INSERT INTO access_logs (ip_address, path, method) VALUES
  ('127.0.0.1', '/', 'GET'),
  ('192.168.1.100', '/about', 'GET'),
  ('10.0.0.1', '/products', 'GET');