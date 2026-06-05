-- documents 테이블에 visibility 컬럼 추가
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS visibility ENUM('public', 'internal') DEFAULT 'public' 
COMMENT '문서 공개 설정 - public: 공개용, internal: 내부용' 
AFTER description;

-- 인덱스 추가
ALTER TABLE documents ADD INDEX idx_visibility (visibility);

-- 기존 데이터는 모두 공개로 설정
UPDATE documents SET visibility = 'public' WHERE visibility IS NULL;