# 이든푸드 통합 관리 시스템 v3.0

## 개요
(주)이든푸드의 웹사이트 및 인트라넷 통합 관리 시스템입니다.

## 주요 기능

### 1. 공식 웹사이트
- 반응형 랜딩 페이지
- 회사 소개 (CEO 인사말, 연혁, 임원진)
- 제품/메뉴 소개
- 브랜드 소개
- 갤러리
- 서식 자료실
- 문의/연락처

### 2. 관리자 시스템
- 공지사항 관리 (팝업 공지 포함)
- 회사소개 콘텐츠 관리
- 제품/메뉴 관리
- 브랜드 관리
- 갤러리 관리
- 서식자료실 관리
- 시스템 모니터링

### 3. 인트라넷
- 직원 로그인
- 차량 운행 기록부 (/intranet/car)

## 기술 스택
- Backend: Node.js, Express.js
- Database: MariaDB
- Frontend: HTML, CSS, JavaScript
- 인증: JWT (JSON Web Tokens)
- 파일 업로드: Multer
- 이미지 처리: Jimp

## 디렉토리 구조
```
/var/eden/
├── server.js           # 메인 서버 파일
├── public/             # 정적 파일 (웹사이트)
│   ├── assets/         # 이미지, 비디오 등
│   ├── index.html      # 랜딩 페이지
│   └── ...
├── admin/              # 관리자 페이지
├── intranet/           # 인트라넷 (차량 앱)
├── css/                # 모든 CSS 파일
├── uploads/            # 업로드된 파일
└── .env                # 환경 변수
```

## URL 구조
- 메인 사이트: https://edenfood.co.kr
- 관리자: https://edenfood.co.kr/admin
- 인트라넷: https://edenfood.co.kr/intranet
- 차량 관리: https://edenfood.co.kr/intranet/car

## 주요 경로 통합 (v3.0)
- CSS: `/css/` → `/var/eden/css/`
- 업로드: `/uploads/` → `/var/eden/uploads/`
- 정적 파일: `/assets/` → `/var/eden/public/assets/`

## 설치 및 실행

### 필수 요구사항
- Node.js 14.0 이상
- MariaDB 10.5 이상
- PM2 (프로세스 관리)
- Nginx (리버스 프록시)

### 설치
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집

# PM2로 실행
pm2 start ecosystem.config.js
```

### 데이터베이스 설정
서버 시작 시 필요한 테이블이 자동으로 생성됩니다.

## 환경 변수 (.env)
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=edenfood
DB_PASS=your_password
DB_NAME=edenfood
JWT_SECRET=your_jwt_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin_password
```

## API 엔드포인트

### 인증
- POST `/api/auth/login` - 로그인
- POST `/api/auth/logout` - 로그아웃
- GET `/api/auth/me` - 현재 사용자 정보
- GET `/api/auth/verify` - 토큰 검증

### 공지사항
- GET `/api/notices` - 공지사항 목록
- GET `/api/notices/:id` - 공지사항 상세
- POST `/api/notices` - 공지사항 작성 (관리자)
- PUT `/api/notices/:id` - 공지사항 수정 (관리자)
- DELETE `/api/notices/:id` - 공지사항 삭제 (관리자)

### 회사소개
- GET `/api/about` - 회사소개 정보
- PUT `/api/about` - 회사소개 수정 (관리자)
- GET `/api/executives` - 임원진 목록
- POST `/api/executives` - 임원 추가 (관리자)

### 업로드
- POST `/api/upload/image` - 이미지 업로드

## 버전 히스토리

### v3.0.0 (2026-05-13)
- 디렉토리 구조 대규모 정리
- CSS 파일 `/css/`로 통합
- 업로드 파일 `/uploads/`로 통합
- 차량 앱을 `/intranet/car`로 이동
- 경로 문제 전면 해결

### v2.1.0
- 인트라넷 시스템 통합
- 관리자 페이지 개선
- 시스템 모니터링 추가

### v2.0.0
- 웹사이트 전면 개편
- 관리자 시스템 구축

### v1.0.0
- 차량 운행기록부 시스템

## 라이선스
(주)이든푸드 전용 시스템

## 연락처
- 개발팀: dev@edenfood.com
- 웹사이트: https://edenfood.co.kr

---
© 2026 주식회사 이든푸드. All rights reserved.