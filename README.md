# 이든푸드 통합 관리 시스템

## 개요
(주)이든푸드의 웹사이트 및 인트라넷 통합 관리 시스템입니다.

## 버전 정보
- 현재 버전: Ver.3.0.20260513
- 버전 체계: 메이저.마이너.년월일
- 마이너 버전이 9를 초과하면 메이저 버전 상승

## 주요 기능

### 1. 공식 웹사이트
- 반응형 랜딩 페이지
- 회사 소개 (CEO 인사말, 연혁, 임원진) - DB 연동
- 제품/메뉴 소개
- 브랜드 소개
- 갤러리 - DB 연동
- 서식 자료실 - DB 연동
- 문의/연락처

### 2. 관리자 시스템
- 차량 운행기록 관리
- 사용자 관리 (직원 계정 및 권한)
- 공지사항 관리 (팝업 공지 포함)
- 일정 관리
- 회사소개 콘텐츠 관리
- 갤러리 관리 (등록일 수정 기능 포함)
- 서식자료실 관리 (CRUD 기능 완성)
- 문의 관리 (유형별 담당자 설정)
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

### Ver.3.0.20260513
- 관리자 대시보드 UI 전면 개편 (파란색 테마)
- 상단 네비게이션에 모든 관리 메뉴 통합
- 문의 관리 시스템 신규 추가
  - 문의 유형별 담당자 설정
  - 이메일 알림 기능
  - 문의 상태 관리 (신규/처리중/완료)
- 서식자료실 문서 수정 기능 추가
- 갤러리 등록일 수정 기능 추가
- 회사소개 페이지 DB 연동 완료
  - CEO 인사말 관리
  - 회사 연혁 관리
  - 임원진 정보 관리
- 갤러리 이미지 lightbox 개선 (줌, 네비게이션)
- 버전 표시 체계 개선 (메이저.마이너.년월일)

### v2.1.0 (2026-01-20)
- 디렉토리 구조 대규모 정리
- CSS 파일 `/css/`로 통합
- 업로드 파일 `/uploads/`로 통합
- 차량 앱을 `/intranet/car`로 이동
- 인트라넷 시스템 통합
- 시스템 모니터링 추가

### v2.0.0 (2025-11-15)
- 웹사이트 전면 개편
- 관리자 시스템 구축
- 인증 시스템 통합

### v1.0.0 (2025-08-10)
- 차량 운행기록부 시스템 최초 구축

## 라이선스
(주)이든푸드 전용 시스템

## 연락처
- 개발팀: dev@edenfood.com
- 웹사이트: https://edenfood.co.kr

---
© 2026 주식회사 이든푸드. All rights reserved.