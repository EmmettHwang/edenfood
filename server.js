/* =====================================================
   server.js - Express + MariaDB API 서버
   (주)이든푸드 인트라넷 + 차량 운행기록부 v3.0
   ===================================================== */
require('dotenv').config();
const express  = require('express');
const mysql    = require('mysql2/promise');
const path     = require('path');
const fs       = require('fs');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const multer   = require('multer');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'edenfood-intranet-secret-2026';

app.use(express.json({ 
  limit: '50mb',
  // JSON 파싱 에러 처리
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      console.error('JSON 파싱 에러:', e.message);
      console.error('요청 본문:', buf.toString());
      throw new Error('잘못된 JSON 형식');
    }
  }
}));

/* 파일 업로드 설정 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'public/assets/uploads');
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // 파일명: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${uniqueSuffix}-${name}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB 제한
  fileFilter: function (req, file, cb) {
    // 이미지 파일만 허용
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// jimp 모듈 추가 (sharp 대체)
const Jimp = require('jimp');

// 회사소개 이미지 업로드 전용 설정
const aboutStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = req.body.type || 'ceo'; // ceo, executive, history 등
    const uploadPath = path.join(__dirname, 'public/assets/uploads/about', type);
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    // 썸네일 디렉토리도 생성
    const thumbPath = path.join(__dirname, 'public/assets/uploads/about', type, 'thumbnails');
    if (!fs.existsSync(thumbPath)) {
      fs.mkdirSync(thumbPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.type || 'about'}-${uniqueSuffix}${ext}`);
  }
});

const aboutUpload = multer({ 
  storage: aboutStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

/* 요청 로그 미들웨어 (404 추적용) */
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      console.log(`[${res.statusCode}] ${req.method} ${req.url}`);
    }
  });
  next();
});

// 캐시 컨트롤 설정
app.use((req, res, next) => {
  // CSS, JS 파일에 대해 캐시 무효화
  if (req.url.match(/\.(css|js)$/)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// public/ 정적 파일 (랜딩, 로그인, 인트라넷 허브, 영상 등)
app.use(express.static(path.join(__dirname, 'public')));
// 차량 앱 정적 파일 (/car/ prefix 제거 후 루트 기준 서빙)
app.use('/car', express.static(path.join(__dirname)));
// 루트 정적 파일 (js/, css/ 등 공통 자원)
app.use(express.static(path.join(__dirname)));

/* ─────────────────────────────────────────
   DB 연결 설정 (createConnection 기반)
───────────────────────────────────────── */
const dbConfig = {
  host:           process.env.DB_HOST     || 'itedu.synology.me',
  port:           parseInt(process.env.DB_PORT || '3306'),
  user:           process.env.DB_USER     || 'root',
  password:       process.env.DB_PASS     || 'xhRl1004!@#',
  database:       process.env.DB_NAME     || 'edenfood',
  connectTimeout: 15000,
};
const DB_NAME = dbConfig.database;

/* 연결 획득 헬퍼 */
async function getConn() {
  return await mysql.createConnection(dbConfig);
}

/* query 헬퍼: 연결 자동 관리 */
const pool = {
  async query(sql, params) {
    const conn = await getConn();
    try { return await conn.query(sql, params); }
    finally { await conn.end().catch(()=>{}); }
  },
  async getConnection() {
    const conn = await getConn();
    conn.release = () => conn.end().catch(()=>{});
    conn.beginTransaction = () => conn.query('START TRANSACTION');
    conn.commit    = () => conn.query('COMMIT');
    conn.rollback  = () => conn.query('ROLLBACK');
    return conn;
  }
};

/* 연결 확인 */
async function checkDB() {
  try {
    const conn = await getConn();
    const [r] = await conn.query('SELECT VERSION() as v, DATABASE() as db');
    console.log(`✅ MariaDB 연결 성공! 버전: ${r[0].v} | DB: ${r[0].db}`);
    await conn.end();
    return true;
  } catch(e) {
    console.error('❌ DB 연결 실패:', e.message);
    return false;
  }
}

/* ─────────────────────────────────────────
   테이블 초기화 (없으면 자동 생성)
───────────────────────────────────────── */
async function initTables() {
  const conn = await pool.getConnection();
  try {
    // 1. 차량
    await conn.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id           VARCHAR(32)   NOT NULL PRIMARY KEY,
        regno        VARCHAR(20)   NOT NULL,
        model        VARCHAR(50)   NOT NULL,
        year         SMALLINT,
        odometer     INT           DEFAULT 0,
        fuel_eff     DECIMAL(5,2)  DEFAULT 0,
        fuel_price   INT           DEFAULT 0,
        memo         VARCHAR(100),
        driver1_name    VARCHAR(30),
        driver1_license VARCHAR(25),
        driver2_name    VARCHAR(30),
        driver2_license VARCHAR(25),
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. 차량 서류 (등록증/면허증 base64)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS vehicle_docs (
        id           INT           AUTO_INCREMENT PRIMARY KEY,
        vehicle_id   VARCHAR(32)   NOT NULL,
        doc_type     VARCHAR(20)   NOT NULL COMMENT 'regdoc|license1|license2',
        file_name    VARCHAR(200),
        file_type    VARCHAR(50),
        file_data    LONGTEXT      COMMENT 'base64',
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_vdoc (vehicle_id, doc_type),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 3. 거래처
    await conn.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id           VARCHAR(32)   NOT NULL PRIMARY KEY,
        name         VARCHAR(50)   NOT NULL,
        category     VARCHAR(30)   DEFAULT '미분류',
        distance     DECIMAL(6,1)  DEFAULT 0,
        variance     DECIMAL(5,1)  DEFAULT 0,
        visits       TINYINT       DEFAULT 1,
        toll         INT           DEFAULT 0,
        parking      INT           DEFAULT 0,
        memo         VARCHAR(100),
        biz_no       VARCHAR(20)   COMMENT '사업자번호',
        manager_name VARCHAR(30)   COMMENT '담당자 성명',
        phone        VARCHAR(30)   COMMENT '전화번호',
        email        VARCHAR(100)  COMMENT '이메일',
        address      VARCHAR(200)  COMMENT '주소',
        sort_order   INT           DEFAULT 0,
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 3-1. 기존 clients 테이블 컬럼 마이그레이션 (없으면 추가)
    const alterCols = [
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS biz_no      VARCHAR(20)  COMMENT '사업자번호'`,
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS manager_name VARCHAR(30) COMMENT '담당자'`,
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone       VARCHAR(30)  COMMENT '전화번호'`,
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS email       VARCHAR(100) COMMENT '이메일'`,
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS address     VARCHAR(200) COMMENT '주소'`,
    ];
    for (const sql of alterCols) { try { await conn.query(sql); } catch {} }

    // 3-2. 거래처 서류
    await conn.query(`
      CREATE TABLE IF NOT EXISTS client_docs (
        id           INT           AUTO_INCREMENT PRIMARY KEY,
        client_id    VARCHAR(32)   NOT NULL,
        doc_type     VARCHAR(20)   NOT NULL COMMENT 'biz_cert|contract|etc',
        file_name    VARCHAR(200),
        file_type    VARCHAR(50),
        file_data    LONGTEXT      COMMENT 'base64',
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cdoc (client_id, doc_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 4. 차량별 운행 설정
    await conn.query(`
      CREATE TABLE IF NOT EXISTS drive_settings (
        id                  INT         AUTO_INCREMENT PRIMARY KEY,
        vehicle_id          VARCHAR(32) NOT NULL,
        commute_dist        DECIMAL(6,1) DEFAULT 0,
        commute_variance    DECIMAL(5,1) DEFAULT 0,
        commute_days_pw     TINYINT     DEFAULT 2,
        commute_toll        INT         DEFAULT 0,
        commute_spread      VARCHAR(20) DEFAULT 'random',
        annual_km           INT         DEFAULT 7000,
        fix_seed            TINYINT(1)  DEFAULT 1,
        include_sat         TINYINT(1)  DEFAULT 0,
        selected_client_ids TEXT        COMMENT 'JSON array of client ids',
        updated_at          DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_vsetting (vehicle_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 5. 운행일지 (월 단위)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS drive_logs (
        id           INT           AUTO_INCREMENT PRIMARY KEY,
        vehicle_id   VARCHAR(32)   NOT NULL,
        year         SMALLINT      NOT NULL,
        month        TINYINT       NOT NULL,
        rows_json    LONGTEXT      NOT NULL COMMENT 'JSON array of daily rows',
        total_km     DECIMAL(8,1)  DEFAULT 0,
        commute_km   DECIMAL(8,1)  DEFAULT 0,
        biz_km       DECIMAL(8,1)  DEFAULT 0,
        start_odo    INT           DEFAULT 0,
        end_odo      INT           DEFAULT 0,
        regno        VARCHAR(20),
        model        VARCHAR(50),
        saved_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_log (vehicle_id, year, month),
        INDEX idx_vehicle_year (vehicle_id, year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. 연간 고정비용
    await conn.query(`
      CREATE TABLE IF NOT EXISTS annual_costs (
        id              INT         AUTO_INCREMENT PRIMARY KEY,
        vehicle_id      VARCHAR(32) NOT NULL,
        year            SMALLINT    NOT NULL,
        car_tax         INT         DEFAULT 0,
        insurance       INT         DEFAULT 0,
        loan_interest   INT         DEFAULT 0,
        repair_monthly  INT         DEFAULT 0,
        updated_at      DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ac (vehicle_id, year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. 비용 명세서 데이터 (월 단위)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cost_data (
        id           INT           AUTO_INCREMENT PRIMARY KEY,
        vehicle_id   VARCHAR(32)   NOT NULL,
        year         SMALLINT      NOT NULL,
        data_json    LONGTEXT      NOT NULL COMMENT 'JSON cost data by month',
        saved_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cd (vehicle_id, year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 8. 주유 기록
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fuel_logs (
        id           INT           AUTO_INCREMENT PRIMARY KEY,
        vehicle_id   VARCHAR(32)   NOT NULL,
        year         SMALLINT      NOT NULL,
        month        TINYINT       NOT NULL,
        log_date     DATE,
        amount       INT           DEFAULT 0  COMMENT '주유금액(원)',
        liters       DECIMAL(6,2)  DEFAULT 0  COMMENT '주유량(L)',
        unit_price   INT           DEFAULT 0  COMMENT '단가(원/L)',
        odometer     INT           DEFAULT 0,
        memo         VARCHAR(100),
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_fl (vehicle_id, year, month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 9. 영수증 첨부
    await conn.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id           INT           AUTO_INCREMENT PRIMARY KEY,
        vehicle_id   VARCHAR(32)   NOT NULL,
        year         SMALLINT      NOT NULL,
        month        TINYINT       NOT NULL,
        row_key      VARCHAR(50)   NOT NULL,
        file_name    VARCHAR(200),
        file_type    VARCHAR(50),
        file_data    LONGTEXT      COMMENT 'base64',
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_receipt (vehicle_id, year, month, row_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 10. 사용자 계정
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           INT           AUTO_INCREMENT PRIMARY KEY,
        username     VARCHAR(50)   NOT NULL UNIQUE,
        password     VARCHAR(100)  NOT NULL COMMENT 'bcrypt hash',
        name         VARCHAR(30)   NOT NULL,
        role         VARCHAR(20)   DEFAULT 'staff' COMMENT 'admin|staff',
        email        VARCHAR(100),
        is_approved  TINYINT(1)    DEFAULT 0 COMMENT '관리자 승인 여부',
        last_login   DATETIME,
        created_at   DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 11. 공지사항 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notices (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        title           VARCHAR(200)  NOT NULL,
        content         TEXT,
        author_id       INT,
        author_name     VARCHAR(30),
        is_important    TINYINT(1)    DEFAULT 0,
        is_popup        TINYINT(1)    DEFAULT 0,
        popup_image     VARCHAR(500),
        popup_content   TEXT,
        popup_start_date DATETIME,
        popup_end_date   DATETIME,
        linked_event    INT,
        views           INT           DEFAULT 0,
        target          VARCHAR(20)   DEFAULT 'all' COMMENT 'all|public|intranet',
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_popup (is_popup, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 12. 문서 카테고리
    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_categories (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(50)   NOT NULL,
        order_num       INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 13. 문서
    await conn.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        category_id     INT,
        title           VARCHAR(200)  NOT NULL,
        description     TEXT,
        thumbnail       VARCHAR(500),
        download_count  INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES document_categories(id) ON DELETE SET NULL,
        INDEX idx_category (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 14. 문서 파일
    await conn.query(`
      CREATE TABLE IF NOT EXISTS document_files (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        document_id     INT           NOT NULL,
        file_name       VARCHAR(200)  NOT NULL,
        original_name   VARCHAR(200)  NOT NULL,
        file_type       VARCHAR(50),
        file_size       INT,
        file_data       LONGTEXT      COMMENT 'base64',
        order_num       INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        INDEX idx_document (document_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 기본 admin 계정 (없으면 생성)
    const [existingAdmin] = await conn.query(`SELECT id FROM users WHERE username = 'admin' LIMIT 1`);
    if (!existingAdmin || existingAdmin.length === 0) {
      const hash = await bcrypt.hash('eden2026!', 10);
      await conn.query(
        `INSERT INTO users (username, password, name, role, is_approved) VALUES (?, ?, ?, 'admin', 1)`,
        ['admin', hash, '관리자']
      );
      console.log('✅ 기본 admin 계정 생성 (ID: admin / PW: eden2026!)');
    }
    
    // 15. 협회소개 콘텐츠 (싱글톤)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS about_content (
        id              INT           PRIMARY KEY DEFAULT 1,
        greeting_text   TEXT          COMMENT '인사말 텍스트',
        greeting_author VARCHAR(100)  DEFAULT '이든푸드 대표이사' COMMENT '인사말 서명',
        greeting_image  VARCHAR(500)  COMMENT '인사말 이미지 경로',
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 16. 임원진
    await conn.query(`
      CREATE TABLE IF NOT EXISTS executives (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(50)   NOT NULL,
        position        VARCHAR(50)   COMMENT '직책',
        phone           VARCHAR(20),
        email           VARCHAR(100),
        greeting        TEXT          COMMENT '인사말',
        photo           VARCHAR(500)  COMMENT '프로필 사진 URL',
        order_num       INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 17. 연혁
    await conn.query(`
      CREATE TABLE IF NOT EXISTS company_history (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        year            INT           NOT NULL,
        month           INT,
        content         VARCHAR(500)  NOT NULL,
        detail          TEXT,
        order_num       INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 18. 조직 현황 (부서/팀)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(50)   NOT NULL,
        description     TEXT,
        member_count    INT           DEFAULT 0,
        image           VARCHAR(500),
        order_num       INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 기본 문서 카테고리 생성
    const [existingCategories] = await conn.query(`SELECT COUNT(*) as count FROM document_categories`);
    if (existingCategories[0].count === 0) {
      await conn.query(`
        INSERT INTO document_categories (name, order_num) VALUES 
        ('회사 규정', 1),
        ('인사/급여', 2),
        ('계약서 양식', 3),
        ('업무 서식', 4),
        ('기타 문서', 5)
      `);
      console.log('✅ 기본 문서 카테고리 생성');
    }
    
    // 기본 협회소개 콘텐츠 생성
    const [existingAbout] = await conn.query(`SELECT id FROM about_content WHERE id = 1`);
    if (!existingAbout || existingAbout.length === 0) {
      await conn.query(`
        INSERT INTO about_content (id, greeting_text, greeting_author) VALUES (
          1,
          '안녕하십니까.\\n\\n이든푸드를 방문해 주신 여러분을 진심으로 환영합니다.\\n\\n저희 이든푸드는 건강한 식재료와 정성을 담아 고객님께 최고의 맛과 품질을 제공하기 위해 노력하고 있습니다.\\n\\n항상 고객님의 건강과 행복을 최우선으로 생각하며, 신뢰받는 기업이 되겠습니다.\\n\\n감사합니다.',
          '이든푸드 대표이사'
        )
      `);
      console.log('✅ 기본 협회소개 콘텐츠 생성');
    }
    
    // 공지사항 테이블에 날짜 필드 추가 (기존 테이블에 없을 경우)
    try {
      await conn.query(`ALTER TABLE notices ADD COLUMN popup_start_date DATETIME`);
      console.log('✅ popup_start_date 컬럼 추가');
    } catch (e) {
      // 이미 존재하는 경우 무시
    }
    
    try {
      await conn.query(`ALTER TABLE notices ADD COLUMN popup_end_date DATETIME`);
      console.log('✅ popup_end_date 컬럼 추가');
    } catch (e) {
      // 이미 존재하는 경우 무시
    }
    
    // 공지사항 테이블에 target 필드 추가
    try {
      await conn.query(`ALTER TABLE notices ADD COLUMN target VARCHAR(20) DEFAULT 'all' COMMENT 'all|public|intranet'`);
      console.log('✅ target 컬럼 추가');
    } catch (e) {
      // 이미 존재하는 경우 무시
    }
    
    // 19. 시스템 설정
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        setting_key     VARCHAR(100)  NOT NULL UNIQUE,
        setting_value   TEXT,
        setting_type    VARCHAR(50)   DEFAULT 'text',
        description     TEXT,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 기본 시스템 설정 생성
    const [existingSettings] = await conn.query(`SELECT COUNT(*) as count FROM system_settings`);
    if (existingSettings[0].count === 0) {
      await conn.query(`
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES 
        ('hero_use_image', 'true', 'boolean', '히어로 섹션에 이미지 사용 여부'),
        ('hero_image_url', '/public/assets/china01.png', 'text', '히어로 섹션 이미지 경로'),
        ('hero_video_url', '/public/assets/video/hero.mp4', 'text', '히어로 섹션 비디오 경로'),
        ('hero_display_mode', 'image', 'select', '히어로 섹션 표시 모드 (image/video/both)')
      `);
      console.log('✅ 기본 시스템 설정 생성');
    }
    
    // 20. 메뉴 아이템
    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(100)  NOT NULL,
        category        VARCHAR(50)   NOT NULL,
        description     TEXT,
        price           INT           DEFAULT 0,
        image_url       VARCHAR(500),
        calories        INT,
        protein         DECIMAL(6,2),
        fat             DECIMAL(6,2),
        carbs           DECIMAL(6,2),
        sodium          INT,
        allergens       VARCHAR(200),
        is_new          TINYINT(1)    DEFAULT 0,
        is_best         TINYINT(1)    DEFAULT 0,
        status          VARCHAR(20)   DEFAULT 'active',
        order_num       INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 20. 브랜드
    await conn.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(100)  NOT NULL,
        tagline         VARCHAR(200),
        description     TEXT,
        logo_url        VARCHAR(500),
        color_primary   VARCHAR(10)   DEFAULT '#16a34a',
        color_secondary VARCHAR(10),
        website         VARCHAR(200),
        status          VARCHAR(20)   DEFAULT 'active',
        order_num       INT           DEFAULT 0,
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 21. 갤러리 이미지
    await conn.query(`
      CREATE TABLE IF NOT EXISTS gallery_images (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        title           VARCHAR(200)  NOT NULL,
        description     TEXT,
        category        VARCHAR(50)   DEFAULT 'etc',
        tags            VARCHAR(500),
        image_url       VARCHAR(500)  NOT NULL,
        thumbnail_url   VARCHAR(500),
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // company_history 테이블에 누락된 컬럼 추가
    try {
      await conn.query(`ALTER TABLE company_history ADD COLUMN IF NOT EXISTS month INT AFTER year`);
      await conn.query(`ALTER TABLE company_history ADD COLUMN IF NOT EXISTS detail TEXT AFTER content`);
    } catch {}
    
    // departments 테이블에 누락된 컬럼 추가
    try {
      await conn.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS head VARCHAR(50) AFTER name`);
      await conn.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS members INT DEFAULT 0 AFTER head`);
      await conn.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS member_count INT DEFAULT 0 AFTER members`);
    } catch {}
    
    // executives 테이블에 누락된 컬럼 추가
    try {
      await conn.query(`ALTER TABLE executives ADD COLUMN IF NOT EXISTS bio TEXT AFTER position`);
      await conn.query(`ALTER TABLE executives ADD COLUMN IF NOT EXISTS greeting TEXT AFTER email`);
      await conn.query(`ALTER TABLE executives ADD COLUMN IF NOT EXISTS photo VARCHAR(500) AFTER greeting`);
    } catch {}
    
    // about_content 테이블의 greeting_image 컬럼 타입 변경 (LONGTEXT -> VARCHAR)
    try {
      await conn.query(`ALTER TABLE about_content MODIFY COLUMN greeting_image VARCHAR(500) COMMENT '인사말 이미지 경로'`);
    } catch {}
    
    // document_categories 테이블에 누락된 컬럼 추가
    try {
      await conn.query(`ALTER TABLE document_categories ADD COLUMN IF NOT EXISTS description TEXT AFTER name`);
      await conn.query(`ALTER TABLE document_categories ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' AFTER order_num`);
    } catch {}
    
    // 21. 제품(메뉴) 테이블
    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id              INT           AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(100)  NOT NULL,
        category        VARCHAR(50)   NOT NULL COMMENT 'signature|gamjatang|side|drink',
        price           VARCHAR(50),
        description     TEXT,
        badge           VARCHAR(20)   COMMENT 'new|best|hot',
        image           VARCHAR(500),
        calorie         VARCHAR(50),
        time            VARCHAR(50),
        serving         VARCHAR(50),
        created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 기본 제품 데이터 생성
    const [existingProducts] = await conn.query(`SELECT COUNT(*) as count FROM products`);
    if (existingProducts[0].count === 0) {
      await conn.query(`
        INSERT INTO products (name, category, price, description, badge, image, calorie, time, serving) VALUES 
        ('명품 감자탕 대', 'signature', '35,000원', '진한 국물과 푸짐한 고기로 만든 시그니처 감자탕', 'best', '/assets/gamjatang.jpg', '약 800kcal', '약 15분', '2-3인분'),
        ('명품 감자탕 중', 'signature', '28,000원', '진한 국물과 푸짐한 고기로 만든 시그니처 감자탕', null, '/assets/gamjatang.jpg', '약 600kcal', '약 12분', '1-2인분'),
        ('해장국', 'gamjatang', '7,000원', '시원하고 깔끔한 해장국', null, '/assets/haejang.jpg', '약 400kcal', '약 5분', '1인분'),
        ('뼈해장국', 'gamjatang', '8,000원', '푸짐한 뼈와 함께 끓인 해장국', 'hot', '/assets/bone-haejang.jpg', '약 500kcal', '약 7분', '1인분'),
        ('김치찜', 'side', '25,000원', '묵은지와 돼지고기의 환상 조합', 'new', '/assets/kimchi-jjim.jpg', '약 700kcal', '약 20분', '2-3인분'),
        ('계란찜', 'side', '8,000원', '부드럽고 폭신한 계란찜', null, '/assets/egg-jjim.jpg', '약 200kcal', '약 10분', '2인분'),
        ('소주', 'drink', '4,500원', '참이슬, 처음처럼', null, '/assets/soju.jpg', null, null, null),
        ('맥주', 'drink', '4,500원', '카스, 테라', null, '/assets/beer.jpg', null, null, null)
      `);
      console.log('✅ 기본 제품 데이터 생성');
    }

    console.log('✅ 모든 테이블 준비 완료');
  } finally {
    conn.release();
  }
}

/* ─────────────────────────────────────────
   유틸
───────────────────────────────────────── */
function ok(res, data)    { res.json({ ok: true,  data }); }
function err(res, msg, code=500) { res.status(code).json({ ok: false, error: msg }); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* ─────────────────────────────────────────
   JWT 인증 미들웨어
───────────────────────────────────────── */
function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query._token;
  if (!token) return res.status(401).json({ ok: false, error: '로그인이 필요합니다.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(e) {
    return res.status(401).json({ ok: false, error: '인증이 만료되었습니다. 다시 로그인하세요.' });
  }
}

/* ─────────────────────────────────────────
   API: 인증 (로그인 / 회원가입)
───────────────────────────────────────── */
// 로그인
app.post('/api/auth/login', async (req, res) => {
  console.log('=== 로그인 시도 ===');
  console.log('요청 본문:', req.body);
  
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('❌ 필수 항목 누락:', { username: !!username, password: !!password });
      return res.status(400).json({ ok: false, message: '아이디와 비밀번호를 입력하세요.' });
    }

    console.log('🔍 사용자 검색:', username);
    // 아이디 또는 이름으로 검색
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR name = ? LIMIT 1', [username, username]);
    const user = rows[0];
    
    if (!user) {
      console.log('❌ 사용자를 찾을 수 없음:', username);
      return res.json({ ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    
    console.log('✅ 사용자 찾음:', { id: user.id, username: user.username, role: user.role, is_approved: user.is_approved });
    
    if (!user.is_approved) {
      console.log('❌ 미승인 사용자');
      return res.json({ ok: false, message: '관리자 승인 대기 중입니다.' });
    }

    console.log('🔐 비밀번호 검증 중...');
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      console.log('❌ 비밀번호 불일치');
      return res.json({ ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    console.log('✅ 비밀번호 일치');
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const payload = { id: user.id, username: user.username, name: user.name, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    
    console.log('✅ 로그인 성공! 토큰 발급됨');
    res.json({ ok: true, token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch(e) {
    console.error('❌ 로그인 오류:', e);
    err(res, '서버 오류');
  }
});

// 회원가입
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name) return res.status(400).json({ ok: false, message: '필수 항목을 입력하세요.' });
    if (password.length < 6) return res.status(400).json({ ok: false, message: '비밀번호는 6자 이상이어야 합니다.' });

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    if (existing.length > 0) return res.json({ ok: false, message: '이미 사용 중인 아이디입니다.' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password, name, email, is_approved) VALUES (?, ?, ?, ?, 0)',
      [username, hash, name, email || null]
    );
    res.json({ ok: true, message: '회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인하세요.' });
  } catch(e) {
    console.error('회원가입 오류:', e);
    err(res, '서버 오류');
  }
});

// 토큰 검증 (인트라넷 진입 시)
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// 현재 사용자 정보 조회
app.get('/api/auth/me', authMiddleware, (req, res) => {
  console.log('=== /api/auth/me 호출됨 ===');
  console.log('인증된 사용자:', req.user);
  res.json({ ok: true, user: req.user });
});

// 로그아웃
app.post('/api/auth/logout', (req, res) => {
  console.log('=== 로그아웃 요청 ===');
  // JWT는 서버에서 별도로 관리하지 않으므로 클라이언트에서 토큰만 삭제하면 됨
  res.json({ ok: true, message: '로그아웃되었습니다.' });
});

// 사용자 목록 (관리자용)
app.get('/api/auth/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: '권한이 없습니다.' });
    const [rows] = await pool.query('SELECT id, username, name, role, email, is_approved, last_login, created_at FROM users ORDER BY created_at DESC');
    res.json({ ok: true, users: rows });
  } catch(e) { err(res, e.message); }
});

// 사용자 승인 (관리자용)
app.post('/api/auth/users/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: '권한이 없습니다.' });
    await pool.query('UPDATE users SET is_approved = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: '사용자가 승인되었습니다.' });
  } catch(e) { err(res, e.message); }
});

// 사용자 권한 변경 (관리자용)
app.put('/api/auth/users/:id/role', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: '권한이 없습니다.' });
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ ok: false, error: '유효하지 않은 권한입니다.' });
    }
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ ok: true, message: '권한이 변경되었습니다.' });
  } catch(e) { err(res, e.message); }
});

// 사용자 삭제 (관리자용)
app.delete('/api/auth/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: '권한이 없습니다.' });
    // 자기 자신은 삭제 불가
    if (req.user.id == req.params.id) {
      return res.status(400).json({ ok: false, error: '자기 자신은 삭제할 수 없습니다.' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ ok: true, message: '사용자가 삭제되었습니다.' });
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: 차량
───────────────────────────────────────── */
// 목록
app.get('/api/vehicles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles ORDER BY created_at');
    ok(res, rows.map(r => ({
      id: r.id, regno: r.regno, model: r.model, year: r.year,
      odometer: r.odometer, fuelEff: parseFloat(r.fuel_eff),
      fuelPrice: r.fuel_price, memo: r.memo,
      driver1Name: r.driver1_name, driver1LicenseNo: r.driver1_license,
      driver2Name: r.driver2_name, driver2LicenseNo: r.driver2_license,
    })));
  } catch(e) { err(res, e.message); }
});

// 단건
app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles WHERE id=?', [req.params.id]);
    if (!rows.length) return err(res, 'Not found', 404);
    const r = rows[0];
    ok(res, { id:r.id, regno:r.regno, model:r.model, year:r.year,
      odometer:r.odometer, fuelEff:parseFloat(r.fuel_eff),
      fuelPrice:r.fuel_price, memo:r.memo,
      driver1Name:r.driver1_name, driver1LicenseNo:r.driver1_license,
      driver2Name:r.driver2_name, driver2LicenseNo:r.driver2_license });
  } catch(e) { err(res, e.message); }
});

// 추가
app.post('/api/vehicles', async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || genId();
    await pool.query(
      `INSERT INTO vehicles (id,regno,model,year,odometer,fuel_eff,fuel_price,memo,
        driver1_name,driver1_license,driver2_name,driver2_license)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.regno, b.model, b.year||null, b.odometer||0,
       b.fuelEff||0, b.fuelPrice||0, b.memo||'',
       b.driver1Name||'', b.driver1LicenseNo||'',
       b.driver2Name||'', b.driver2LicenseNo||'']
    );
    const [rows] = await pool.query('SELECT * FROM vehicles WHERE id=?', [id]);
    const r = rows[0];
    ok(res, { id:r.id, regno:r.regno, model:r.model, year:r.year,
      odometer:r.odometer, fuelEff:parseFloat(r.fuel_eff),
      fuelPrice:r.fuel_price, memo:r.memo,
      driver1Name:r.driver1_name, driver1LicenseNo:r.driver1_license,
      driver2Name:r.driver2_name, driver2LicenseNo:r.driver2_license });
  } catch(e) { err(res, e.message); }
});

// 수정
app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const b = req.body;
    await pool.query(
      `UPDATE vehicles SET regno=?,model=?,year=?,odometer=?,fuel_eff=?,fuel_price=?,
       memo=?,driver1_name=?,driver1_license=?,driver2_name=?,driver2_license=?
       WHERE id=?`,
      [b.regno, b.model, b.year||null, b.odometer||0,
       b.fuelEff||0, b.fuelPrice||0, b.memo||'',
       b.driver1Name||'', b.driver1LicenseNo||'',
       b.driver2Name||'', b.driver2LicenseNo||'',
       req.params.id]
    );
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// 삭제
app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // 관련 테이블 데이터 먼저 삭제 (CASCADE 미지원 테이블 대비)
    await Promise.all([
      pool.query('DELETE FROM drive_settings WHERE vehicle_id=?', [id]),
      pool.query('DELETE FROM drive_logs     WHERE vehicle_id=?', [id]),
      pool.query('DELETE FROM annual_costs   WHERE vehicle_id=?', [id]),
      pool.query('DELETE FROM cost_data      WHERE vehicle_id=?', [id]),
      pool.query('DELETE FROM fuel_logs      WHERE vehicle_id=?', [id]),
      pool.query('DELETE FROM receipts       WHERE vehicle_id=?', [id]),
      pool.query('DELETE FROM vehicle_docs   WHERE vehicle_id=?', [id]),
    ]);
    await pool.query('DELETE FROM vehicles WHERE id=?', [id]);
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* --- 차량 서류 --- */
app.get('/api/vehicles/:id/docs/:type', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM vehicle_docs WHERE vehicle_id=? AND doc_type=?',
      [req.params.id, req.params.type]
    );
    ok(res, rows.length ? { name:rows[0].file_name, type:rows[0].file_type, data:rows[0].file_data } : null);
  } catch(e) { err(res, e.message); }
});

app.post('/api/vehicles/:id/docs/:type', async (req, res) => {
  try {
    const { name, type, data } = req.body;
    await pool.query(
      `INSERT INTO vehicle_docs (vehicle_id,doc_type,file_name,file_type,file_data)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),file_type=VALUES(file_type),file_data=VALUES(file_data)`,
      [req.params.id, req.params.type, name, type, data]
    );
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

app.delete('/api/vehicles/:id/docs/:type', async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicle_docs WHERE vehicle_id=? AND doc_type=?',
      [req.params.id, req.params.type]);
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: 거래처
───────────────────────────────────────── */
/* 거래처 공통 매퍼 */
function mapClient(r) {
  return {
    id: r.id, name: r.name, category: r.category,
    distance: parseFloat(r.distance), variance: parseFloat(r.variance),
    visits: r.visits, toll: r.toll, parking: r.parking, memo: r.memo,
    bizNo: r.biz_no || '', managerName: r.manager_name || '',
    phone: r.phone || '', email: r.email || '', address: r.address || ''
  };
}

app.get('/api/clients', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients ORDER BY sort_order, created_at');
    ok(res, rows.map(mapClient));
  } catch(e) { err(res, e.message); }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clients WHERE id=?', [req.params.id]);
    if (!rows.length) return err(res, 'Not found', 404);
    ok(res, mapClient(rows[0]));
  } catch(e) { err(res, e.message); }
});

app.post('/api/clients', async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || genId();
    await pool.query(
      `INSERT INTO clients (id,name,category,distance,variance,visits,toll,parking,memo,biz_no,manager_name,phone,email,address)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.name, b.category||'미분류', b.distance||0, b.variance||0,
       b.visits||1, b.toll||0, b.parking||0, b.memo||'',
       b.bizNo||'', b.managerName||'', b.phone||'', b.email||'', b.address||'']
    );
    const [rows] = await pool.query('SELECT * FROM clients WHERE id=?', [id]);
    ok(res, mapClient(rows[0]));
  } catch(e) { err(res, e.message); }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const b = req.body;
    await pool.query(
      `UPDATE clients SET name=?,category=?,distance=?,variance=?,visits=?,toll=?,parking=?,memo=?,
       biz_no=?,manager_name=?,phone=?,email=?,address=? WHERE id=?`,
      [b.name, b.category||'미분류', b.distance||0, b.variance||0,
       b.visits||1, b.toll||0, b.parking||0, b.memo||'',
       b.bizNo||'', b.managerName||'', b.phone||'', b.email||'', b.address||'',
       req.params.id]
    );
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM clients WHERE id=?', [req.params.id]);
    await pool.query('DELETE FROM client_docs WHERE client_id=?', [req.params.id]);
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* --- 거래처 서류 --- */
app.get('/api/clients/:id/docs/:type', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM client_docs WHERE client_id=? AND doc_type=?',
      [req.params.id, req.params.type]
    );
    ok(res, rows.length ? { name:rows[0].file_name, type:rows[0].file_type, data:rows[0].file_data } : null);
  } catch(e) { err(res, e.message); }
});

app.post('/api/clients/:id/docs/:type', async (req, res) => {
  try {
    const { name, type, data } = req.body;
    await pool.query(
      `INSERT INTO client_docs (client_id,doc_type,file_name,file_type,file_data)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),file_type=VALUES(file_type),file_data=VALUES(file_data)`,
      [req.params.id, req.params.type, name, type, data]
    );
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

app.delete('/api/clients/:id/docs/:type', async (req, res) => {
  try {
    await pool.query('DELETE FROM client_docs WHERE client_id=? AND doc_type=?',
      [req.params.id, req.params.type]);
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: 운행 설정 (차량별)
───────────────────────────────────────── */
app.get('/api/settings/:vehicleId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM drive_settings WHERE vehicle_id=?', [req.params.vehicleId]);
    if (!rows.length) return ok(res, null);
    const r = rows[0];
    ok(res, {
      vehicleId:          r.vehicle_id,
      commuteDist:        parseFloat(r.commute_dist),
      commuteVariance:    parseFloat(r.commute_variance),
      commuteDaysPerWeek: r.commute_days_pw,
      commuteToll:        r.commute_toll,
      commuteSpread:      r.commute_spread,
      annualKm:           r.annual_km,
      fixSeed:            !!r.fix_seed,
      includeSat:         !!r.include_sat,
      selectedClientIds:  JSON.parse(r.selected_client_ids || '[]'),
    });
  } catch(e) { err(res, e.message); }
});

app.post('/api/settings/:vehicleId', async (req, res) => {
  try {
    const b = req.body;
    await pool.query(
      `INSERT INTO drive_settings
         (vehicle_id,commute_dist,commute_variance,commute_days_pw,commute_toll,
          commute_spread,annual_km,fix_seed,include_sat,selected_client_ids)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         commute_dist=VALUES(commute_dist), commute_variance=VALUES(commute_variance),
         commute_days_pw=VALUES(commute_days_pw), commute_toll=VALUES(commute_toll),
         commute_spread=VALUES(commute_spread), annual_km=VALUES(annual_km),
         fix_seed=VALUES(fix_seed), include_sat=VALUES(include_sat),
         selected_client_ids=VALUES(selected_client_ids)`,
      [req.params.vehicleId,
       b.commuteDist||0, b.commuteVariance||0, b.commuteDaysPerWeek||2, b.commuteToll||0,
       b.commuteSpread||'random', b.annualKm||7000,
       b.fixSeed ? 1 : 0, b.includeSat ? 1 : 0,
       JSON.stringify(b.selectedClientIds || [])]
    );
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: 운행일지
───────────────────────────────────────── */
// 인덱스 전체 (대시보드용)
app.get('/api/logs/index', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT vehicle_id,year,month,total_km,commute_km,biz_km,start_odo,end_odo,regno,model,saved_at
       FROM drive_logs ORDER BY year,month`);
    ok(res, rows.map(r => ({
      key:       `${r.vehicle_id}_${r.year}_${String(r.month).padStart(2,'0')}`,
      vehicleId: r.vehicle_id, year: r.year, month: r.month,
      totalKm:   parseFloat(r.total_km),
      commuteKm: parseFloat(r.commute_km),
      bizKm:     parseFloat(r.biz_km),
      startOdo:  r.start_odo, endOdo: r.end_odo,
      regno: r.regno, model: r.model, savedAt: r.saved_at
    })));
  } catch(e) { err(res, e.message); }
});

// 차량+연도 인덱스
app.get('/api/logs/index/:vehicleId/:year', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT vehicle_id,year,month,total_km,commute_km,biz_km,start_odo,end_odo,saved_at
       FROM drive_logs WHERE vehicle_id=? AND year=? ORDER BY month`,
      [req.params.vehicleId, req.params.year]);
    ok(res, rows.map(r => ({
      key:`${r.vehicle_id}_${r.year}_${String(r.month).padStart(2,'0')}`,
      vehicleId:r.vehicle_id, year:r.year, month:r.month,
      totalKm:parseFloat(r.total_km), commuteKm:parseFloat(r.commute_km),
      bizKm:parseFloat(r.biz_km), startOdo:r.start_odo, endOdo:r.end_odo,
    })));
  } catch(e) { err(res, e.message); }
});

// 월별 상세
app.get('/api/logs/:vehicleId/:year/:month', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM drive_logs WHERE vehicle_id=? AND year=? AND month=?',
      [req.params.vehicleId, req.params.year, req.params.month]);
    if (!rows.length) return ok(res, null);
    const r = rows[0];
    ok(res, {
      vehicleId: r.vehicle_id, year: r.year, month: r.month,
      rows: JSON.parse(r.rows_json),
      regno: r.regno, model: r.model, savedAt: r.saved_at
    });
  } catch(e) { err(res, e.message); }
});

// 저장
app.post('/api/logs/:vehicleId/:year/:month', async (req, res) => {
  try {
    const b    = req.body;
    const rows = b.rows || [];
    const totalKm   = rows.reduce((s,r)=>s+(Number(r.driven)||0),0);
    const commuteKm = rows.reduce((s,r)=>s+(Number(r.commute)||0),0);
    const bizKm     = rows.reduce((s,r)=>s+(Number(r.biz)||0),0);
    await pool.query(
      `INSERT INTO drive_logs
         (vehicle_id,year,month,rows_json,total_km,commute_km,biz_km,start_odo,end_odo,regno,model)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         rows_json=VALUES(rows_json),total_km=VALUES(total_km),
         commute_km=VALUES(commute_km),biz_km=VALUES(biz_km),
         start_odo=VALUES(start_odo),end_odo=VALUES(end_odo),
         regno=VALUES(regno),model=VALUES(model)`,
      [req.params.vehicleId, req.params.year, req.params.month,
       JSON.stringify(rows), totalKm, commuteKm, bizKm,
       rows[0]?.before||0, rows[rows.length-1]?.after||0,
       b.regno||'', b.model||'']
    );
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

// 삭제
app.delete('/api/logs/:vehicleId/:year/:month', async (req, res) => {
  try {
    await pool.query('DELETE FROM drive_logs WHERE vehicle_id=? AND year=? AND month=?',
      [req.params.vehicleId, req.params.year, req.params.month]);
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: 연간 고정비용
───────────────────────────────────────── */
app.get('/api/annual-costs/:vehicleId/:year', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM annual_costs WHERE vehicle_id=? AND year=?',
      [req.params.vehicleId, req.params.year]);
    if (!rows.length) return ok(res, { carTax:0, insurance:0, loanInterest:0, repairMonthly:0 });
    const r = rows[0];
    ok(res, { carTax:r.car_tax, insurance:r.insurance,
      loanInterest:r.loan_interest, repairMonthly:r.repair_monthly });
  } catch(e) { err(res, e.message); }
});

app.post('/api/annual-costs/:vehicleId/:year', async (req, res) => {
  try {
    const b = req.body;
    await pool.query(
      `INSERT INTO annual_costs (vehicle_id,year,car_tax,insurance,loan_interest,repair_monthly)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         car_tax=VALUES(car_tax),insurance=VALUES(insurance),
         loan_interest=VALUES(loan_interest),repair_monthly=VALUES(repair_monthly)`,
      [req.params.vehicleId, req.params.year,
       b.carTax||0, b.insurance||0, b.loanInterest||0, b.repairMonthly||0]
    );
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: 비용 명세서
───────────────────────────────────────── */
app.get('/api/costdata/:vehicleId/:year', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM cost_data WHERE vehicle_id=? AND year=?',
      [req.params.vehicleId, req.params.year]);
    if (!rows.length) return ok(res, null);
    ok(res, { vehicleId: req.params.vehicleId, year: parseInt(req.params.year),
      data: JSON.parse(rows[0].data_json) });
  } catch(e) { err(res, e.message); }
});

app.post('/api/costdata/:vehicleId/:year', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO cost_data (vehicle_id,year,data_json) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE data_json=VALUES(data_json)`,
      [req.params.vehicleId, req.params.year, JSON.stringify(req.body.data || {})]
    );
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: 영수증
───────────────────────────────────────── */
app.get('/api/receipts/:vehicleId/:year/:month/:rowKey', async (req, res) => {
  try {
    const { vehicleId, year, month, rowKey } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM receipts WHERE vehicle_id=? AND year=? AND month=? AND row_key=?',
      [vehicleId, year, month, rowKey]);
    if (!rows.length) return ok(res, null);
    ok(res, { name:rows[0].file_name, type:rows[0].file_type, data:rows[0].file_data });
  } catch(e) { err(res, e.message); }
});

app.post('/api/receipts/:vehicleId/:year/:month/:rowKey', async (req, res) => {
  try {
    const { vehicleId, year, month, rowKey } = req.params;
    const { name, type, data } = req.body;
    await pool.query(
      `INSERT INTO receipts (vehicle_id,year,month,row_key,file_name,file_type,file_data)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE file_name=VALUES(file_name),file_type=VALUES(file_type),file_data=VALUES(file_data)`,
      [vehicleId, year, month, rowKey, name, type, data]
    );
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

app.delete('/api/receipts/:vehicleId/:year/:month/:rowKey', async (req, res) => {
  try {
    const { vehicleId, year, month, rowKey } = req.params;
    await pool.query(
      'DELETE FROM receipts WHERE vehicle_id=? AND year=? AND month=? AND row_key=?',
      [vehicleId, year, month, rowKey]);
    ok(res, null);
  } catch(e) { err(res, e.message); }
});

/* ─────────────────────────────────────────
   API: LocalStorage 마이그레이션
───────────────────────────────────────── */
app.post('/api/migrate', async (req, res) => {
  const { vehicles, clients, settings, logs, costData } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 차량
    for (const v of (vehicles || [])) {
      await conn.query(
        `INSERT IGNORE INTO vehicles
           (id,regno,model,year,odometer,fuel_eff,fuel_price,memo,driver1_name,driver1_license,driver2_name,driver2_license)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [v.id, v.regno, v.model, v.year||null, v.odometer||0,
         v.fuelEff||0, v.fuelPrice||0, v.memo||'',
         v.driver1Name||'', v.driver1LicenseNo||'',
         v.driver2Name||'', v.driver2LicenseNo||'']
      );
    }

    // 거래처
    for (const c of (clients || [])) {
      await conn.query(
        `INSERT IGNORE INTO clients (id,name,category,distance,variance,visits,toll,parking,memo)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [c.id, c.name, c.category||'미분류', c.distance||0, c.variance||0,
         c.visits||1, c.toll||0, c.parking||0, c.memo||'']
      );
    }

    // 설정
    for (const s of (settings || [])) {
      await conn.query(
        `INSERT INTO drive_settings
           (vehicle_id,commute_dist,commute_variance,commute_days_pw,commute_toll,
            commute_spread,annual_km,fix_seed,include_sat,selected_client_ids)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE commute_dist=VALUES(commute_dist)`,
        [s.vehicleId, s.commuteDist||0, s.commuteVariance||0, s.commuteDaysPerWeek||2,
         s.commuteToll||0, s.commuteSpread||'random', s.annualKm||7000,
         s.fixSeed?1:0, s.includeSat?1:0, JSON.stringify(s.selectedClientIds||[])]
      );
    }

    // 운행일지
    for (const l of (logs || [])) {
      const rows = l.rows || [];
      await conn.query(
        `INSERT IGNORE INTO drive_logs
           (vehicle_id,year,month,rows_json,total_km,commute_km,biz_km,start_odo,end_odo,regno,model)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [l.vehicleId, l.year, l.month, JSON.stringify(rows),
         rows.reduce((s,r)=>s+(Number(r.driven)||0),0),
         rows.reduce((s,r)=>s+(Number(r.commute)||0),0),
         rows.reduce((s,r)=>s+(Number(r.biz)||0),0),
         rows[0]?.before||0, rows[rows.length-1]?.after||0,
         l.regno||'', l.model||'']
      );
    }

    await conn.commit();
    ok(res, { migrated: { vehicles: vehicles?.length||0, clients: clients?.length||0,
      settings: settings?.length||0, logs: logs?.length||0 } });
  } catch(e) {
    await conn.rollback();
    err(res, e.message);
  } finally {
    conn.release();
  }
});

/* ─────────────────────────────────────────
   API: 사용자 관리 (관리자 전용)
───────────────────────────────────────── */
// 사용자 승인
app.post('/api/auth/users/:id/approve', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const [result] = await pool.query(
      'UPDATE users SET is_approved = 1 WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return err(res, '사용자를 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '사용자가 승인되었습니다.' });
  } catch (e) {
    console.error('사용자 승인 에러:', e);
    err(res, '승인에 실패했습니다.');
  }
});

// 사용자 권한 변경
app.put('/api/auth/users/:id/role', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'staff'].includes(role)) {
      return err(res, '유효하지 않은 권한입니다.', 400);
    }
    
    const [result] = await pool.query(
      'UPDATE users SET role = ? WHERE id = ? AND username != ?',
      [role, id, 'admin']
    );
    
    if (result.affectedRows === 0) {
      return err(res, '권한을 변경할 수 없습니다.', 400);
    }
    
    ok(res, { message: '권한이 변경되었습니다.' });
  } catch (e) {
    console.error('권한 변경 에러:', e);
    err(res, '권한 변경에 실패했습니다.');
  }
});

// 사용자 삭제
app.delete('/api/auth/users/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const [result] = await pool.query(
      'DELETE FROM users WHERE id = ? AND username != ?',
      [id, 'admin']
    );
    
    if (result.affectedRows === 0) {
      return err(res, '사용자를 삭제할 수 없습니다.', 400);
    }
    
    ok(res, { message: '사용자가 삭제되었습니다.' });
  } catch (e) {
    console.error('사용자 삭제 에러:', e);
    err(res, '삭제에 실패했습니다.');
  }
});

/* ─────────────────────────────────────────
   API: 공지사항
───────────────────────────────────────── */
// 팝업 공지 목록
app.get('/api/notices/popups', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, title, popup_image, popup_content, linked_event
      FROM notices 
      WHERE is_popup = 1 
      ORDER BY created_at DESC
    `);
    ok(res, { popups: rows });
  } catch (e) {
    console.error('팝업 조회 에러:', e);
    err(res, '팝업을 불러올 수 없습니다.');
  }
});

// 공지사항 목록
app.get('/api/notices', async (req, res) => {
  try {
    // target 파라미터로 필터링 (admin, public, intranet, all)
    const { target } = req.query;
    let whereClause = '';
    
    if (target === 'public') {
      whereClause = `WHERE (target = 'public' OR target = 'all')`;
    } else if (target === 'intranet') {
      whereClause = `WHERE (target = 'intranet' OR target = 'all')`;
    } else if (target === 'admin') {
      whereClause = ''; // 관리자는 모든 공지사항 보기
    }
    
    const [rows] = await pool.query(`
      SELECT id, title, content, author_name, is_important, is_popup, popup_image, popup_content, 
             show_title, show_content, text_position, text_align, title_color, content_color, views, 
             target, created_at
      FROM notices 
      ${whereClause}
      ORDER BY is_important DESC, created_at DESC
    `);
    res.json({ ok: true, notices: rows });
  } catch (e) {
    console.error('공지사항 조회 에러:', e);
    res.json({ ok: false, error: '공지사항을 불러올 수 없습니다.' });
  }
});

// 공지사항 상세
app.get('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 조회수 증가
    await pool.query('UPDATE notices SET views = views + 1 WHERE id = ?', [id]);
    
    const [[notice]] = await pool.query(
      'SELECT * FROM notices WHERE id = ?',
      [id]
    );
    
    if (!notice) return err(res, '공지사항을 찾을 수 없습니다.', 404);
    
    res.json({ ok: true, notice });
  } catch (e) {
    console.error('공지사항 상세 조회 에러:', e);
    err(res, '공지사항을 불러올 수 없습니다.');
  }
});

// 공지사항 등록 (관리자 전용)
app.post('/api/notices', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const {
      title,
      content,
      is_important,
      is_popup,
      popup_image,
      popup_content,
      popup_start,
      popup_end,
      linked_event,
      show_title,
      show_content,
      text_position,
      text_align,
      title_color,
      content_color,
      target
    } = req.body;
    
    if (!title) return err(res, '제목을 입력하세요.', 400);
    
    const [result] = await pool.query(
      `INSERT INTO notices (
        title, content, author_id, author_name, is_important, 
        is_popup, popup_image, popup_content, popup_start_date, popup_end_date, linked_event,
        show_title, show_content, text_position, text_align, title_color, content_color, target
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        content || '',
        req.user.id,
        req.user.name,
        is_important ? 1 : 0,
        is_popup ? 1 : 0,
        popup_image || null,
        popup_content || null,
        popup_start || null,
        popup_end || null,
        linked_event || null,
        show_title ? 1 : 0,
        show_content ? 1 : 0,
        text_position || 'center',
        text_align || 'center',
        title_color || '#FFFFFF',
        content_color || '#FFFFFF',
        target || 'all'
      ]
    );
    
    ok(res, { id: result.insertId, message: '공지사항이 등록되었습니다.' });
  } catch (e) {
    console.error('공지사항 등록 에러:', e);
    err(res, '공지사항 등록에 실패했습니다.');
  }
});

// 공지사항 수정 (관리자 전용)
app.put('/api/notices/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const {
      title,
      content,
      is_important,
      is_popup,
      popup_image,
      popup_content,
      popup_start,
      popup_end,
      linked_event,
      show_title,
      show_content,
      text_position,
      text_align,
      title_color,
      content_color,
      target
    } = req.body;
    
    if (!title) return err(res, '제목을 입력하세요.', 400);
    
    const [result] = await pool.query(
      `UPDATE notices SET 
        title = ?, content = ?, is_important = ?, is_popup = ?,
        popup_image = ?, popup_content = ?, popup_start_date = ?, popup_end_date = ?, linked_event = ?,
        show_title = ?, show_content = ?, text_position = ?, text_align = ?, title_color = ?, content_color = ?,
        target = ?
      WHERE id = ?`,
      [
        title,
        content || '',
        is_important ? 1 : 0,
        is_popup ? 1 : 0,
        popup_image || null,
        popup_content || null,
        popup_start || null,
        popup_end || null,
        linked_event || null,
        show_title ? 1 : 0,
        show_content ? 1 : 0,
        text_position || 'center',
        text_align || 'center',
        title_color || '#FFFFFF',
        content_color || '#FFFFFF',
        target || 'all',
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      return err(res, '공지사항을 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '공지사항이 수정되었습니다.' });
  } catch (e) {
    console.error('공지사항 수정 에러:', e);
    err(res, '공지사항 수정에 실패했습니다.');
  }
});

// 공지사항 삭제 (관리자 전용)
app.delete('/api/notices/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM notices WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return err(res, '공지사항을 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '공지사항이 삭제되었습니다.' });
  } catch (e) {
    console.error('공지사항 삭제 에러:', e);
    err(res, '공지사항 삭제에 실패했습니다.');
  }
});

/* ─────────────────────────────────────────
   API: 문서 관리
───────────────────────────────────────── */
// 문서 카테고리 목록
app.get('/api/documents/categories', async (req, res) => {
  try {
    const [categories] = await pool.query(
      'SELECT * FROM document_categories ORDER BY order_num'
    );
    ok(res, { categories });
  } catch (e) {
    console.error('카테고리 조회 에러:', e);
    err(res, '카테고리를 불러올 수 없습니다.');
  }
});

// 문서 목록
app.get('/api/documents', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query = `
      SELECT d.*, c.name as category_name,
        (SELECT COUNT(*) FROM document_files WHERE document_id = d.id) as file_count
      FROM documents d
      LEFT JOIN document_categories c ON d.category_id = c.id
    `;
    
    const params = [];
    if (category) {
      query += ' WHERE d.category_id = ?';
      params.push(category);
    }
    
    query += ' ORDER BY d.created_at DESC';
    
    const [documents] = await pool.query(query, params);
    res.json({ ok: true, documents });
  } catch (e) {
    console.error('문서 조회 에러:', e);
    err(res, '문서를 불러올 수 없습니다.');
  }
});

// 문서 상세 (파일 목록 포함)
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [[document]] = await pool.query(
      'SELECT d.*, c.name as category_name FROM documents d LEFT JOIN document_categories c ON d.category_id = c.id WHERE d.id = ?',
      [id]
    );
    
    if (!document) {
      return err(res, '문서를 찾을 수 없습니다.', 404);
    }
    
    const [files] = await pool.query(
      'SELECT id, original_name, file_type, file_size FROM document_files WHERE document_id = ? ORDER BY order_num',
      [id]
    );
    
    ok(res, { document, files });
  } catch (e) {
    console.error('문서 상세 조회 에러:', e);
    err(res, '문서를 불러올 수 없습니다.');
  }
});

// 파일 다운로드
app.get('/api/documents/files/:fileId/download', async (req, res) => {
  try {
    // 토큰 인증 (헤더 또는 쿼리 파라미터)
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
    if (!token) {
      return err(res, '인증이 필요합니다.', 401);
    }
    
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return err(res, '유효하지 않은 토큰입니다.', 401);
    }
    
    const { fileId } = req.params;
    
    const [[file]] = await pool.query(
      'SELECT * FROM document_files WHERE id = ?',
      [fileId]
    );
    
    if (!file) {
      return err(res, '파일을 찾을 수 없습니다.', 404);
    }
    
    // 다운로드 카운트 증가
    await pool.query(
      'UPDATE documents SET download_count = download_count + 1 WHERE id = ?',
      [file.document_id]
    );
    
    // base64를 버퍼로 변환
    const buffer = Buffer.from(file.file_data, 'base64');
    
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (e) {
    console.error('파일 다운로드 에러:', e);
    err(res, '파일을 다운로드할 수 없습니다.');
  }
});

// 문서 등록 (관리자 전용)
app.post('/api/documents', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { category_id, title, description, thumbnail, files } = req.body;
    
    if (!title) return err(res, '제목을 입력하세요.', 400);
    if (!files || files.length === 0) return err(res, '파일을 첨부하세요.', 400);
    
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    
    try {
      // 문서 등록
      const [result] = await conn.query(
        'INSERT INTO documents (category_id, title, description, thumbnail) VALUES (?, ?, ?, ?)',
        [category_id || null, title, description || '', thumbnail || null]
      );
      
      const documentId = result.insertId;
      
      // 파일 등록
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await conn.query(
          'INSERT INTO document_files (document_id, file_name, original_name, file_type, file_size, file_data, order_num) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [documentId, file.file_name, file.original_name, file.file_type, file.file_size, file.file_data, i]
        );
      }
      
      await conn.commit();
      ok(res, { id: documentId, message: '문서가 등록되었습니다.' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('문서 등록 에러:', e);
    err(res, '문서 등록에 실패했습니다.');
  }
});

// 문서 삭제 (관리자 전용)
app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM documents WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return err(res, '문서를 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '문서가 삭제되었습니다.' });
  } catch (e) {
    console.error('문서 삭제 에러:', e);
    err(res, '문서 삭제에 실패했습니다.');
  }
});

/* ─────────────────────────────────────────
   API: 협회소개 (About)
───────────────────────────────────────── */
// 협회소개 콘텐츠 조회
app.get('/api/about', async (req, res) => {
  try {
    const [[content]] = await pool.query('SELECT * FROM about_content WHERE id = 1');
    const [executives] = await pool.query('SELECT * FROM executives ORDER BY order_num, id');
    const [history] = await pool.query('SELECT * FROM company_history ORDER BY year DESC, month DESC, order_num');
    const [departments] = await pool.query('SELECT * FROM departments ORDER BY order_num, id');
    
    ok(res, {
      content: content || {},
      executives,
      history,
      departments
    });
  } catch (e) {
    console.error('협회소개 조회 에러:', e);
    err(res, '협회소개를 불러올 수 없습니다.');
  }
});

// 협회소개 콘텐츠 수정 (관리자 전용)
app.put('/api/about/content', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { greeting_text, greeting_author, greeting_image } = req.body;
    
    await pool.query(
      `INSERT INTO about_content (id, greeting_text, greeting_author, greeting_image) 
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       greeting_text = VALUES(greeting_text),
       greeting_author = VALUES(greeting_author),
       greeting_image = VALUES(greeting_image)`,
      [greeting_text || '', greeting_author || '', greeting_image || null]
    );
    
    ok(res, { message: '협회소개가 수정되었습니다.' });
  } catch (e) {
    console.error('협회소개 수정 에러:', e);
    err(res, '협회소개 수정에 실패했습니다.');
  }
});

// 임원 목록
app.get('/api/executives', async (req, res) => {
  try {
    const [executives] = await pool.query('SELECT * FROM executives ORDER BY order_num, id');
    ok(res, { executives });
  } catch (e) {
    console.error('임원 조회 에러:', e);
    err(res, '임원 목록을 불러올 수 없습니다.');
  }
});

// 임원 등록/수정 (관리자 전용)
app.post('/api/executives', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { name, position, phone, email, greeting, photo, order_num } = req.body;
    
    if (!name) return err(res, '이름을 입력하세요.', 400);
    
    const [result] = await pool.query(
      `INSERT INTO executives (name, position, phone, email, greeting, photo, order_num)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, position || '', phone || '', email || '', greeting || '', photo || null, order_num || 0]
    );
    
    ok(res, { id: result.insertId, message: '임원이 등록되었습니다.' });
  } catch (e) {
    console.error('임원 등록 에러:', e);
    err(res, '임원 등록에 실패했습니다.');
  }
});

// 임원 삭제 (관리자 전용)
app.delete('/api/executives/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM executives WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return err(res, '임원을 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '임원이 삭제되었습니다.' });
  } catch (e) {
    console.error('임원 삭제 에러:', e);
    err(res, '임원 삭제에 실패했습니다.');
  }
});

// 연혁 목록
app.get('/api/history', async (req, res) => {
  try {
    const [history] = await pool.query(
      'SELECT * FROM company_history ORDER BY year DESC, month DESC, order_num'
    );
    ok(res, { history });
  } catch (e) {
    console.error('연혁 조회 에러:', e);
    err(res, '연혁을 불러올 수 없습니다.');
  }
});

// 연혁 등록 (관리자 전용)
app.post('/api/history', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { year, month, content, detail, order_num } = req.body;
    
    if (!year || !content) return err(res, '연도와 내용을 입력하세요.', 400);
    
    const [result] = await pool.query(
      `INSERT INTO company_history (year, month, content, detail, order_num)
       VALUES (?, ?, ?, ?, ?)`,
      [year, month || null, content, detail || '', order_num || 0]
    );
    
    ok(res, { id: result.insertId, message: '연혁이 등록되었습니다.' });
  } catch (e) {
    console.error('연혁 등록 에러:', e);
    err(res, '연혁 등록에 실패했습니다.');
  }
});

// 연혁 삭제 (관리자 전용)
app.delete('/api/history/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM company_history WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return err(res, '연혁을 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '연혁이 삭제되었습니다.' });
  } catch (e) {
    console.error('연혁 삭제 에러:', e);
    err(res, '연혁 삭제에 실패했습니다.');
  }
});

// 회사소개 이미지 업로드 API
app.post('/api/about/upload-image', authMiddleware, aboutUpload.single('image'), async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    if (!req.file) {
      return err(res, '이미지 파일을 선택해주세요.', 400);
    }
    
    const type = req.body.type || 'ceo';
    const originalPath = req.file.path;
    const filename = req.file.filename;
    const ext = path.extname(filename).toLowerCase();
    const nameWithoutExt = path.basename(filename, ext);
    
    // 썸네일 생성 (300x300) - Jimp 사용
    const thumbPath = path.join(__dirname, 'public/assets/uploads/about', type, 'thumbnails', `${nameWithoutExt}_thumb${ext}`);
    
    try {
      const image = await Jimp.read(originalPath);
      await image
        .cover(300, 300) // cover는 중앙 기준으로 크롭
        .quality(90)
        .writeAsync(thumbPath);
    } catch (jimpError) {
      console.error('썸네일 생성 실패:', jimpError);
    }
    
    // 원본 이미지도 리사이즈 (최대 1200px) - Jimp 사용
    try {
      const image = await Jimp.read(originalPath);
      if (image.bitmap.width > 1200 || image.bitmap.height > 1200) {
        await image
          .scaleToFit(1200, 1200) // 비율 유지하며 최대 크기에 맞춤
          .quality(90)
          .writeAsync(originalPath);
      }
    } catch (jimpError) {
      console.error('이미지 리사이즈 실패:', jimpError);
    }
    
    // 업로드된 파일 경로 (public 경로로 변환)
    const imagePath = `/assets/uploads/about/${type}/${filename}`;
    const thumbnailPath = `/assets/uploads/about/${type}/thumbnails/${nameWithoutExt}_thumb${ext}`;
    
    ok(res, { 
      path: imagePath,
      thumbnail: thumbnailPath,
      filename: filename,
      message: '이미지가 업로드되었습니다.' 
    });
  } catch (e) {
    console.error('이미지 업로드 에러:', e);
    err(res, '이미지 업로드에 실패했습니다.');
  }
});

// 회사소개 전체 데이터 저장 (관리자 전용)
app.post('/api/about', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { content, history, departments, executives } = req.body;
    
    // 트랜잭션 시작
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 1. 인사말 저장
      if (content) {
        await connection.query(
          `INSERT INTO about_content (id, greeting_text, greeting_author, greeting_image) 
           VALUES (1, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           greeting_text = VALUES(greeting_text),
           greeting_author = VALUES(greeting_author),
           greeting_image = VALUES(greeting_image)`,
          [content.greeting_text || '', content.greeting_author || '', content.greeting_image || null]
        );
      }
      
      // 2. 연혁 저장
      if (history && Array.isArray(history)) {
        // 기존 연혁 삭제
        await connection.query('DELETE FROM company_history');
        
        // 새 연혁 추가
        for (let i = 0; i < history.length; i++) {
          const item = history[i];
          if (item.year && item.content) {
            await connection.query(
              'INSERT INTO company_history (year, content, image, order_num) VALUES (?, ?, ?, ?)',
              [item.year.trim(), item.content.trim(), item.image || null, i]
            );
          }
        }
      }
      
      // 3. 부서 저장
      if (departments && Array.isArray(departments)) {
        // 기존 부서 삭제
        await connection.query('DELETE FROM departments');
        
        // 새 부서 추가
        for (let i = 0; i < departments.length; i++) {
          const dept = departments[i];
          if (dept.name) {
            await connection.query(
              'INSERT INTO departments (name, head, members, order_num) VALUES (?, ?, ?, ?)',
              [dept.name, dept.head || '', dept.members || 0, i]
            );
          }
        }
      }
      
      // 4. 임원진 저장
      if (executives && Array.isArray(executives)) {
        // 기존 임원진 삭제
        await connection.query('DELETE FROM executives');
        
        // 새 임원진 추가
        for (let i = 0; i < executives.length; i++) {
          const exec = executives[i];
          if (exec.name && exec.position) {
            await connection.query(
              'INSERT INTO executives (name, position, greeting, photo, order_num) VALUES (?, ?, ?, ?, ?)',
              [exec.name, exec.position, exec.bio || '', exec.image || null, i]
            );
          }
        }
      }
      
      // 트랜잭션 커밋
      await connection.commit();
      ok(res, { message: '회사소개가 저장되었습니다.' });
      
    } catch (e) {
      // 트랜잭션 롤백
      await connection.rollback();
      console.error('트랜잭션 에러:', e);
      throw e;
    } finally {
      connection.release();
    }
    
  } catch (e) {
    console.error('회사소개 저장 에러:', e);
    console.error('에러 스택:', e.stack);
    console.error('요청 데이터:', {
      content: req.body.content ? 'exists' : 'missing',
      history: Array.isArray(req.body.history) ? req.body.history.length + ' items' : 'invalid',
      departments: Array.isArray(req.body.departments) ? req.body.departments.length + ' items' : 'invalid',
      executives: Array.isArray(req.body.executives) ? req.body.executives.length + ' items' : 'invalid'
    });
    err(res, '회사소개 저장에 실패했습니다: ' + e.message);
  }
});

/* ─────────────────────────────────────────
   API: CEO 인사말 (회사소개)
───────────────────────────────────────── */
// CEO 인사말 조회
app.get('/api/about/greeting', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM about_content WHERE id = 1');
    if (rows.length === 0) {
      return ok(res, { 
        greeting_text: '', 
        greeting_author: '이든푸드 대표이사',
        greeting_image: null 
      });
    }
    ok(res, rows[0]);
  } catch(e) {
    err(res, 'CEO 인사말 조회 실패: ' + e.message);
  }
});

// CEO 인사말 저장
app.put('/api/about/greeting', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { greeting_text, greeting_author, greeting_image } = req.body;
    
    await pool.query(
      `INSERT INTO about_content (id, greeting_text, greeting_author, greeting_image)
       VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       greeting_text = VALUES(greeting_text),
       greeting_author = VALUES(greeting_author),
       greeting_image = VALUES(greeting_image)`,
      [greeting_text || '', greeting_author || '이든푸드 대표이사', greeting_image || null]
    );
    
    ok(res, { message: 'CEO 인사말이 저장되었습니다.' });
  } catch(e) {
    err(res, 'CEO 인사말 저장 실패: ' + e.message);
  }
});

// 이미지 업로드 API
app.post('/api/upload/image', authMiddleware, (req, res) => {
  upload.single('image')(req, res, async function (err) {
    if (err instanceof multer.MulterError) {
      // Multer 에러 처리
      console.error('Multer 에러:', err);
      return res.status(400).json({ success: false, message: `업로드 오류: ${err.message}` });
    } else if (err) {
      // 기타 에러
      console.error('업로드 에러:', err);
      return res.status(500).json({ success: false, message: '파일 업로드 중 오류가 발생했습니다.' });
    }
    
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
      }
      
      if (!req.file) {
        return res.status(400).json({ success: false, message: '이미지 파일을 선택해주세요.' });
      }
      
      console.log('업로드된 파일:', req.file);
      
      const uploadType = req.body.type || 'general';
      const uploadPath = path.join(__dirname, 'public/assets/uploads');
      
      // 타입별 폴더 생성
      let typeFolder = '';
      if (uploadType === 'gallery') {
        typeFolder = 'gallery';
      } else if (uploadType === 'about') {
        typeFolder = 'about';
      }
      
      if (typeFolder) {
        const typePath = path.join(uploadPath, typeFolder);
        if (!fs.existsSync(typePath)) {
          fs.mkdirSync(typePath, { recursive: true });
        }
        
        // 썸네일 폴더 생성
        const thumbPath = path.join(typePath, 'thumbnails');
        if (!fs.existsSync(thumbPath)) {
          fs.mkdirSync(thumbPath, { recursive: true });
        }
        
        // 파일을 타입 폴더로 이동
        const oldPath = req.file.path;
        const newPath = path.join(typePath, req.file.filename);
        fs.renameSync(oldPath, newPath);
        
        // 갤러리 이미지인 경우 썸네일 생성 - Jimp 사용
        if (uploadType === 'gallery') {
          const thumbFilename = `thumb_${req.file.filename}`;
          const thumbFullPath = path.join(thumbPath, thumbFilename);
          
          try {
            const image = await Jimp.read(newPath);
            await image
              .cover(400, 300) // 400x300으로 중앙 기준 크롭
              .quality(85)
              .writeAsync(thumbFullPath);
          } catch (jimpError) {
            console.error('갤러리 썸네일 생성 실패:', jimpError);
          }
          
          // 웹에서 접근 가능한 경로
          const imageUrl = `/assets/uploads/${typeFolder}/${req.file.filename}`;
          const thumbnailUrl = `/assets/uploads/${typeFolder}/thumbnails/${thumbFilename}`;
          
          res.json({
            success: true,
            imageUrl,
            thumbnailUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
          });
        } else {
          // 일반 이미지
          const imageUrl = `/assets/uploads/${typeFolder ? typeFolder + '/' : ''}${req.file.filename}`;
          
          res.json({
            success: true,
            imageUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
          });
        }
      } else {
        // 기본 업로드
        const imageUrl = `/assets/uploads/${req.file.filename}`;
        
        res.json({
          success: true,
          imageUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size
        });
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
    }
  });
});

// 시스템 정보 API (관리자 전용)
const os = require('os');
const { execSync } = require('child_process');

app.get('/api/system-info', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    // CPU 사용률 계산 (실시간)
    let cpuUsage = 0;
    
    try {
      // Linux에서 top 명령어로 CPU 사용률 가져오기
      const topOutput = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'").toString().trim();
      const cpuPercent = parseFloat(topOutput);
      if (!isNaN(cpuPercent)) {
        cpuUsage = Math.round(cpuPercent);
      }
    } catch (e) {
      // top 명령어 실패시 대체 방법
      const loadAvg = os.loadavg()[0]; // 1분 평균
      const cpuCount = os.cpus().length;
      cpuUsage = Math.min(100, Math.round((loadAvg / cpuCount) * 100));
    }
    
    // 메모리 사용률
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = Math.round((usedMemory / totalMemory) * 100);
    
    // 디스크 사용률 (df 명령어 사용)
    let diskUsage = 0;
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    
    try {
      const dfOutput = execSync('df -B1 /').toString();
      const lines = dfOutput.split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 4) {
          diskTotal = parseInt(parts[1]) / 1024 / 1024 / 1024; // GB
          diskUsed = parseInt(parts[2]) / 1024 / 1024 / 1024; // GB
          diskFree = parseInt(parts[3]) / 1024 / 1024 / 1024; // GB
          diskUsage = Math.round((diskUsed / diskTotal) * 100);
        }
      }
    } catch (e) {
      console.error('디스크 정보 조회 실패:', e);
    }
    
    // 시스템 정보
    const systemInfo = {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        model: os.cpus()[0].model
      },
      memory: {
        usage: memoryUsage,
        total: Math.round(totalMemory / 1024 / 1024 / 1024 * 10) / 10, // GB
        used: Math.round(usedMemory / 1024 / 1024 / 1024 * 10) / 10, // GB
        free: Math.round(freeMemory / 1024 / 1024 / 1024 * 10) / 10 // GB
      },
      disk: {
        usage: diskUsage,
        total: Math.round(diskTotal * 10) / 10, // GB
        used: Math.round(diskUsed * 10) / 10, // GB
        free: Math.round(diskFree * 10) / 10 // GB
      },
      uptime: Math.floor(os.uptime() / 60 / 60 / 24), // days
      platform: os.platform(),
      hostname: os.hostname(),
      loadavg: os.loadavg()
    };
    
    ok(res, systemInfo);
  } catch (e) {
    console.error('시스템 정보 조회 에러:', e);
    err(res, '시스템 정보를 가져올 수 없습니다.');
  }
});

/* ─────────────────────────────────────────
   API: 메뉴 관리
───────────────────────────────────────── */
// 메뉴 목록 조회
app.get('/api/menu', async (req, res) => {
  try {
    const { category, status } = req.query;
    let sql = 'SELECT * FROM menu_items WHERE 1=1';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY category, order_num';
    const [rows] = await pool.query(sql, params);
    ok(res, { items: rows });
  } catch(e) {
    err(res, '메뉴 목록 조회 실패: ' + e.message);
  }
});

// 메뉴 추가
app.post('/api/menu', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { name, category, description, price, calories, protein, fat, carbs, sodium, allergens, status, is_new, is_best } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO menu_items (name, category, description, price, calories, protein, fat, carbs, sodium, allergens, status, is_new, is_best)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, description, price, calories, protein, fat, carbs, sodium, allergens, status || 'active', is_new || 0, is_best || 0]
    );
    
    ok(res, { id: result.insertId, message: '메뉴가 추가되었습니다.' });
  } catch(e) {
    err(res, '메뉴 추가 실패: ' + e.message);
  }
});

// 메뉴 수정
app.put('/api/menu/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    await pool.query(
      `UPDATE menu_items SET ${fields} WHERE id = ?`,
      values
    );
    
    ok(res, { message: '메뉴가 수정되었습니다.' });
  } catch(e) {
    err(res, '메뉴 수정 실패: ' + e.message);
  }
});

// 메뉴 삭제
app.delete('/api/menu/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);
    
    ok(res, { message: '메뉴가 삭제되었습니다.' });
  } catch(e) {
    err(res, '메뉴 삭제 실패: ' + e.message);
  }
});

/* ─────────────────────────────────────────
   API: 브랜드 관리
───────────────────────────────────────── */
// 브랜드 목록 조회
app.get('/api/brands', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM brands ORDER BY order_num, name');
    ok(res, { brands: rows });
  } catch(e) {
    err(res, '브랜드 목록 조회 실패: ' + e.message);
  }
});

// 브랜드 추가
app.post('/api/brands', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { name, tagline, description, logo_url, color_primary, color_secondary, website, status } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO brands (name, tagline, description, logo_url, color_primary, color_secondary, website, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, tagline, description, logo_url, color_primary || '#16a34a', color_secondary, website, status || 'active']
    );
    
    ok(res, { id: result.insertId, message: '브랜드가 추가되었습니다.' });
  } catch(e) {
    err(res, '브랜드 추가 실패: ' + e.message);
  }
});

// 브랜드 수정
app.put('/api/brands/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    await pool.query(
      `UPDATE brands SET ${fields} WHERE id = ?`,
      values
    );
    
    ok(res, { message: '브랜드가 수정되었습니다.' });
  } catch(e) {
    err(res, '브랜드 수정 실패: ' + e.message);
  }
});

// 브랜드 삭제
app.delete('/api/brands/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    await pool.query('DELETE FROM brands WHERE id = ?', [id]);
    
    ok(res, { message: '브랜드가 삭제되었습니다.' });
  } catch(e) {
    err(res, '브랜드 삭제 실패: ' + e.message);
  }
});

/* ─────────────────────────────────────────
   API: 갤러리 관리
───────────────────────────────────────── */
// 갤러리 이미지 목록 조회
app.get('/api/gallery', async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM gallery_images WHERE 1=1';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    ok(res, { images: rows });
  } catch(e) {
    err(res, '갤러리 목록 조회 실패: ' + e.message);
  }
});

// 갤러리 이미지 업로드
app.post('/api/gallery', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { title, description, category, tags, image_url, thumbnail_url } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO gallery_images (title, description, category, tags, image_url, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description, category || 'etc', tags, image_url, thumbnail_url]
    );
    
    ok(res, { id: result.insertId, message: '이미지가 업로드되었습니다.' });
  } catch(e) {
    err(res, '이미지 업로드 실패: ' + e.message);
  }
});

// 갤러리 이미지 수정
app.put('/api/gallery/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    await pool.query(
      `UPDATE gallery_images SET ${fields} WHERE id = ?`,
      values
    );
    
    ok(res, { message: '이미지 정보가 수정되었습니다.' });
  } catch(e) {
    err(res, '이미지 수정 실패: ' + e.message);
  }
});

// 갤러리 이미지 삭제
app.delete('/api/gallery/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    await pool.query('DELETE FROM gallery_images WHERE id = ?', [id]);
    
    ok(res, { message: '이미지가 삭제되었습니다.' });
  } catch(e) {
    err(res, '이미지 삭제 실패: ' + e.message);
  }
});

/* ─────────────────────────────────────────
   API: 시스템 설정 관리
───────────────────────────────────────── */
// 시스템 설정 조회
app.get('/api/settings', async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT * FROM system_settings');
    const settingsMap = {};
    
    settings.forEach(s => {
      if (s.setting_type === 'boolean') {
        settingsMap[s.setting_key] = s.setting_value === 'true';
      } else {
        settingsMap[s.setting_key] = s.setting_value;
      }
    });
    
    ok(res, { settings: settingsMap });
  } catch(e) {
    err(res, '설정 조회 실패: ' + e.message);
  }
});

// 시스템 설정 업데이트
app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { settings } = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, String(value), String(value)]
      );
    }
    
    ok(res, { message: '설정이 저장되었습니다.' });
  } catch(e) {
    err(res, '설정 저장 실패: ' + e.message);
  }
});

/* ─────────────────────────────────────────
   API: 문서 카테고리 관리
───────────────────────────────────────── */
// 문서 카테고리 목록 조회
app.get('/api/documents/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM document_categories ORDER BY order_num');
    ok(res, { categories: rows });
  } catch(e) {
    err(res, '카테고리 목록 조회 실패: ' + e.message);
  }
});

// 문서 카테고리 추가
app.post('/api/documents/categories', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { name, description } = req.body;
    
    // 최대 order_num 구하기
    const [[maxOrder]] = await pool.query('SELECT MAX(order_num) as max_order FROM document_categories');
    const order_num = (maxOrder.max_order || 0) + 1;
    
    const [result] = await pool.query(
      `INSERT INTO document_categories (name, description, order_num)
       VALUES (?, ?, ?)`,
      [name, description, order_num]
    );
    
    ok(res, { id: result.insertId, message: '카테고리가 추가되었습니다.' });
  } catch(e) {
    err(res, '카테고리 추가 실패: ' + e.message);
  }
});

// 문서 카테고리 수정
app.put('/api/documents/categories/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    await pool.query(
      `UPDATE document_categories SET ${fields} WHERE id = ?`,
      values
    );
    
    ok(res, { message: '카테고리가 수정되었습니다.' });
  } catch(e) {
    err(res, '카테고리 수정 실패: ' + e.message);
  }
});

// 문서 카테고리 삭제
app.delete('/api/documents/categories/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    
    // 해당 카테고리에 문서가 있는지 확인
    const [[count]] = await pool.query(
      'SELECT COUNT(*) as count FROM documents WHERE category_id = ?',
      [id]
    );
    
    if (count.count > 0) {
      return err(res, '문서가 있는 카테고리는 삭제할 수 없습니다.', 400);
    }
    
    await pool.query('DELETE FROM document_categories WHERE id = ?', [id]);
    
    ok(res, { message: '카테고리가 삭제되었습니다.' });
  } catch(e) {
    err(res, '카테고리 삭제 실패: ' + e.message);
  }
});

// 문서 카테고리 순서 변경
app.put('/api/documents/categories/reorder', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { orders } = req.body; // [{id: 1, order_num: 0}, ...]
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      
      for (const item of orders) {
        await conn.query(
          'UPDATE document_categories SET order_num = ? WHERE id = ?',
          [item.order_num, item.id]
        );
      }
      
      await conn.commit();
      ok(res, { message: '카테고리 순서가 변경되었습니다.' });
    } catch(e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch(e) {
    err(res, '카테고리 순서 변경 실패: ' + e.message);
  }
});

/* ─────────────────────────────────────────
   API: 헬스체크
───────────────────────────────────────── */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    ok(res, { status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch(e) { err(res, 'DB disconnected: ' + e.message); }
});

/* ─────────────────────────────────────────
   SPA fallback - index.html
───────────────────────────────────────── */
app.get('*', (req, res) => {
  const url = req.path;

  // /intranet/* → 인트라넷 허브
  if (url === '/intranet' || url.startsWith('/intranet/')) {
    const intrFile = path.join(__dirname, 'public', 'intranet', 'index.html');
    if (fs.existsSync(intrFile)) return res.sendFile(intrFile);
  }

  // /car/* → 기존 차량 운행기록부 앱
  if (url === '/car' || url.startsWith('/car/')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  // /login → 로그인 페이지
  if (url === '/login') {
    const loginFile = path.join(__dirname, 'public', 'login.html');
    if (fs.existsSync(loginFile)) return res.sendFile(loginFile);
  }
  
  // 정책 페이지들 (privacy, terms, email-policy)
  if (url === '/privacy' || url === '/terms' || url === '/email-policy') {
    const policyFile = path.join(__dirname, 'public', url.substring(1) + '.html');
    if (fs.existsSync(policyFile)) return res.sendFile(policyFile);
  }
  
  // /admin → 관리자 대시보드
  if (url === '/admin' || url === '/admin/') {
    const adminIndexFile = path.join(__dirname, 'public', 'admin', 'index.html');
    if (fs.existsSync(adminIndexFile)) return res.sendFile(adminIndexFile);
  }
  
  // /admin/* → 관리자 페이지
  if (url.startsWith('/admin/')) {
    const adminPath = url.substring(7); // /admin/ 제거
    const adminFile = path.join(__dirname, 'public', 'admin', adminPath + '.html');
    if (fs.existsSync(adminFile)) return res.sendFile(adminFile);
  }
  
  // /documents → 서식 다운로드
  if (url === '/documents' || url === '/documents/') {
    const docsFile = path.join(__dirname, 'public', 'documents', 'index.html');
    if (fs.existsSync(docsFile)) return res.sendFile(docsFile);
  }
  
  // /about → 회사소개
  if (url === '/about' || url === '/about/') {
    const aboutFile = path.join(__dirname, 'public', 'about', 'index.html');
    if (fs.existsSync(aboutFile)) return res.sendFile(aboutFile);
  }

  // / (랜딩 페이지)
  if (url === '/' || url === '/index.html') {
    const landingFile = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(landingFile)) return res.sendFile(landingFile);
  }

  // 기타 정적 자원 처리
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ===== 제품 관리 API ===== */

// 제품 목록 조회
app.get('/api/products', async (req, res) => {
  try {
    const [products] = await pool.query(`
      SELECT * FROM products 
      ORDER BY category, id DESC
    `);
    
    ok(res, { products });
  } catch (e) {
    console.error('제품 목록 조회 에러:', e);
    err(res, '제품 목록을 불러오는데 실패했습니다.');
  }
});

// 제품 이미지 업로드 전용 설정
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'public/assets/uploads/products');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  }
});

const productUpload = multer({ 
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// 제품 이미지 업로드
app.post('/api/products/upload-image', authMiddleware, productUpload.single('image'), async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    if (!req.file) {
      return err(res, '이미지 파일을 선택해주세요.', 400);
    }
    
    const imagePath = '/assets/uploads/products/' + req.file.filename;
    
    ok(res, { 
      path: imagePath,
      filename: req.file.filename,
      message: '이미지가 업로드되었습니다.' 
    });
  } catch (e) {
    console.error('제품 이미지 업로드 에러:', e);
    err(res, '이미지 업로드에 실패했습니다.');
  }
});

// 제품 추가
app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { name, category, price, description, badge, image, calorie, time, serving } = req.body;
    
    if (!name || !category) {
      return err(res, '제품명과 카테고리는 필수입니다.', 400);
    }
    
    const [result] = await pool.query(
      `INSERT INTO products (name, category, price, description, badge, image, calorie, time, serving)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, price || null, description || null, badge || null, 
       image || null, calorie || null, time || null, serving || null]
    );
    
    ok(res, { id: result.insertId, message: '제품이 추가되었습니다.' });
  } catch (e) {
    console.error('제품 추가 에러:', e);
    err(res, '제품 추가에 실패했습니다.');
  }
});

// 제품 수정
app.put('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    const { name, category, price, description, badge, image, calorie, time, serving } = req.body;
    
    if (!name || !category) {
      return err(res, '제품명과 카테고리는 필수입니다.', 400);
    }
    
    const [result] = await pool.query(
      `UPDATE products SET 
        name = ?, category = ?, price = ?, description = ?, 
        badge = ?, image = ?, calorie = ?, time = ?, serving = ?
       WHERE id = ?`,
      [name, category, price || null, description || null, badge || null, 
       image || null, calorie || null, time || null, serving || null, id]
    );
    
    if (result.affectedRows === 0) {
      return err(res, '제품을 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '제품이 수정되었습니다.' });
  } catch (e) {
    console.error('제품 수정 에러:', e);
    err(res, '제품 수정에 실패했습니다.');
  }
});

// 제품 삭제
app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return err(res, '관리자 권한이 필요합니다.', 403);
    }
    
    const { id } = req.params;
    
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return err(res, '제품을 찾을 수 없습니다.', 404);
    }
    
    ok(res, { message: '제품이 삭제되었습니다.' });
  } catch (e) {
    console.error('제품 삭제 에러:', e);
    err(res, '제품 삭제에 실패했습니다.');
  }
});

/* ─────────────────────────────────────────
   서버 시작
───────────────────────────────────────── */
async function start() {
  const dbOk = await checkDB();
  if (!dbOk) {
    console.error('⚠️  DB 연결 실패. .env 파일과 MariaDB 권한을 확인하세요.');
    process.exit(1);
  }
  await initTables();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚗 이든푸드 차량 운행기록부 서버 시작 - http://0.0.0.0:${PORT}`);
  });
}

start();
