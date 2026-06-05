-- users 테이블에 last_login 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL AFTER updated_at;