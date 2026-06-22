# CLAUDE.md - 이든푸드 프로젝트 작업 규칙

## 작업 완료 후 필수 루틴 (매번 반드시 실행)

작업 지시가 완료되면 아래 순서대로 항상 실행:

1. **README.md 버전 업데이트**
   - 현재 버전 번호 올리기: `Ver.메이저.마이너.년월일` (오늘 날짜로)
   - 마이너 버전: 3.2 → 3.3 → ... → 3.9 → 4.0
   - `## 버전 히스토리` 최상단에 새 버전 항목 추가 (작업 내용 요약)

2. **커밋 & 푸시**
   ```bash
   git add -A
   git commit -m "feat: ..."
   git push origin main
   ```

3. **서버 재시작**
   ```bash
   pm2 restart all
   ```

## 프로젝트 기본 정보

- 경로: `/var/eden/`
- 서버: `server.js` (Node.js + Express)
- DB: MariaDB
- 프로세스 관리: PM2 (`edenfood`)
- 원격: GitHub `EmmettHwang/edenfood`

## 버전 체계

- 형식: `Ver.메이저.마이너.년월일`
- 예: `Ver.3.3.20260622`
- 마이너가 9 초과 시 메이저 상승
