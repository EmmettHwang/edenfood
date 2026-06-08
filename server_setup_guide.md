# Cafe24 가상서버 Eden Food 시스템 구축 가이드

## 목차
1. [서버 초기 설정](#1-서버-초기-설정)
2. [Claude CLI 설치](#2-claude-cli-설치)
3. [필수 소프트웨어 설치](#3-필수-소프트웨어-설치)
4. [Node.js 및 PM2 설치](#4-nodejs-및-pm2-설치)
5. [MariaDB 설치 및 설정](#5-mariadb-설치-및-설정)
6. [Nginx 설치 및 설정](#6-nginx-설치-및-설정)
7. [프로젝트 배포](#7-프로젝트-배포)
8. [SSL 인증서 설정](#8-ssl-인증서-설정)
9. [방화벽 및 보안 설정](#9-방화벽-및-보안-설정)
10. [백업 설정](#10-백업-설정)
11. [문제 해결](#11-문제-해결)

## 1. 서버 초기 설정

### 1.1 서버 접속
```bash
ssh root@your-server-ip
```

### 1.2 시스템 업데이트
```bash
apt update && apt upgrade -y
```

### 1.3 기본 패키지 설치
```bash
apt install -y curl wget git vim build-essential software-properties-common
```

### 1.4 시간대 설정
```bash
timedatectl set-timezone Asia/Seoul
```

### 1.5 Swap 메모리 설정 (메모리가 부족한 경우)
```bash
# 4GB Swap 파일 생성
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# 영구 설정
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# Swap 설정 최적화
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
sysctl -p
```

## 2. Claude CLI 설치

### 2.1 Claude CLI 다운로드 및 설치
```bash
# Claude CLI 다운로드
cd /tmp
wget https://github.com/anthropics/claude-cli/releases/latest/download/claude-linux-x64.tar.gz

# 압축 해제
tar -xvf claude-linux-x64.tar.gz

# 실행 파일을 시스템 경로로 이동
mv claude /usr/local/bin/
chmod +x /usr/local/bin/claude

# 설치 확인
claude --version
```

### 2.2 Claude API 키 설정
```bash
# 환경 변수로 API 키 설정 (영구 설정)
echo 'export ANTHROPIC_API_KEY="your-api-key-here"' >> ~/.bashrc
source ~/.bashrc

# 또는 Claude 설정 파일 생성
mkdir -p ~/.config/claude
cat > ~/.config/claude/config.json << EOL
{
  "api_key": "your-api-key-here",
  "model": "claude-3-5-sonnet-20241022"
}
EOL
```

### 2.3 Claude CLI 초기 테스트
```bash
# 간단한 테스트 실행
claude "Hello, can you confirm you're working?"

# 프로젝트 분석에 사용
claude code --context /var/eden "Analyze this project structure"
```

### 2.4 Claude CLI 유용한 명령어
```bash
# 파일 분석
claude code --file /path/to/file.js "Explain this code"

# 디렉토리 전체 분석
claude code --dir /var/eden "What does this application do?"

# 특정 작업 수행
claude code --dir /var/eden "Add a new feature for user authentication"

# 대화형 모드
claude chat --context /var/eden
```

## 3. 필수 소프트웨어 설치

### 3.1 필수 개발 도구
```bash
apt install -y gcc g++ make python3-pip
```

### 3.2 이미지 처리 라이브러리
```bash
apt install -y imagemagick libpng-dev libjpeg-dev
```

## 4. Node.js 및 PM2 설치

### 4.1 Node.js 18.x 설치
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Node.js 설치
apt install -y nodejs

# 버전 확인
node --version
npm --version
```

### 4.2 PM2 설치
```bash
npm install -g pm2

# PM2 시작 시 자동 실행 설정
pm2 startup systemd -u root --hp /root
```

## 5. MariaDB 설치 및 설정

### 5.1 MariaDB 설치
```bash
apt install -y mariadb-server mariadb-client

# MariaDB 시작 및 자동 시작 설정
systemctl start mariadb
systemctl enable mariadb
```

### 5.2 MariaDB 보안 설정
```bash
mysql_secure_installation

# 다음 옵션으로 설정:
# - root 비밀번호 설정: Y (강력한 비밀번호 입력)
# - 익명 사용자 제거: Y
# - 원격 root 로그인 비활성화: Y
# - 테스트 DB 제거: Y
# - 권한 테이블 리로드: Y
```

### 5.3 데이터베이스 및 사용자 생성
```bash
mysql -u root -p

# MySQL 프롬프트에서 실행:
CREATE DATABASE edenfood CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'edenfood'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON edenfood.* TO 'edenfood'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 5.4 MariaDB 설정 최적화
```bash
# /etc/mysql/mariadb.conf.d/50-server.cnf 편집
vim /etc/mysql/mariadb.conf.d/50-server.cnf

# 다음 설정 추가/수정:
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
innodb_flush_method = O_DIRECT

# MariaDB 재시작
systemctl restart mariadb
```

## 6. Nginx 설치 및 설정

### 6.1 Nginx 설치
```bash
apt install -y nginx

# Nginx 시작 및 자동 시작 설정
systemctl start nginx
systemctl enable nginx
```

### 6.2 Nginx 설정
```bash
# 기본 설정 제거
rm /etc/nginx/sites-enabled/default

# Eden Food 설정 생성
vim /etc/nginx/sites-available/edenfood

# 다음 내용 추가:
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # 파일 업로드 크기 제한 증가
    client_max_body_size 100M;
    
    # 프록시 타임아웃 설정
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 정적 파일 직접 서빙 (선택사항)
    location /uploads/ {
        alias /var/eden/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    location /assets/ {
        alias /var/eden/public/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6.3 설정 활성화 및 테스트
```bash
# 심볼릭 링크 생성
ln -s /etc/nginx/sites-available/edenfood /etc/nginx/sites-enabled/

# 설정 테스트
nginx -t

# Nginx 재시작
systemctl restart nginx
```

## 7. 프로젝트 배포

### 7.1 프로젝트 디렉토리 생성
```bash
mkdir -p /var/eden
cd /var/eden
```

### 7.2 GitHub에서 프로젝트 클론
```bash
git clone https://github.com/EmmettHwang/edenfood.git .
```

### 7.3 의존성 설치
```bash
npm install
```

### 7.4 환경 변수 설정
```bash
# .env 파일 생성
vim .env

# 다음 내용 추가:
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=edenfood
DB_PASS=your_secure_password
DB_NAME=edenfood
JWT_SECRET=your_jwt_secret_key_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
```

### 7.5 필요한 디렉토리 생성
```bash
mkdir -p uploads/gallery/thumbnails
mkdir -p uploads/brands
mkdir -p uploads/products
mkdir -p uploads/about/ceo
mkdir -p uploads/about/history
mkdir -p uploads/about/executives
mkdir -p uploads/documents
mkdir -p logs

# 권한 설정
chmod -R 755 uploads
chmod -R 755 logs
```

### 7.6 PM2 설정 파일 생성
```bash
vim ecosystem.config.js

# 다음 내용 추가:
module.exports = {
  apps: [{
    name: 'edenfood',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### 7.7 애플리케이션 시작
```bash
pm2 start ecosystem.config.js
pm2 save
```

## 8. SSL 인증서 설정

### 8.1 Certbot 설치
```bash
apt install -y certbot python3-certbot-nginx
```

### 8.2 SSL 인증서 발급
```bash
certbot --nginx -d your-domain.com -d www.your-domain.com

# 이메일 입력 및 약관 동의
# 자동 갱신 설정 확인
systemctl status snap.certbot.renew.timer
```

## 9. 방화벽 및 보안 설정

### 9.1 UFW 방화벽 설정
```bash
# UFW 설치
apt install -y ufw

# 기본 정책 설정
ufw default deny incoming
ufw default allow outgoing

# 필요한 포트 허용
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp

# 방화벽 활성화
ufw enable
```

### 9.2 Fail2ban 설치 (선택사항)
```bash
apt install -y fail2ban

# 기본 설정으로 시작
systemctl start fail2ban
systemctl enable fail2ban
```

## 10. 백업 설정

### 10.1 백업 스크립트 생성
```bash
vim /root/backup.sh

#!/bin/bash
# Eden Food 백업 스크립트

# 변수 설정
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/root/backups"
PROJECT_DIR="/var/eden"
DB_NAME="edenfood"
DB_USER="edenfood"
DB_PASS="your_secure_password"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# 데이터베이스 백업
mysqldump -u$DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# 업로드 파일 백업
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz $PROJECT_DIR/uploads

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "백업 완료: $DATE"
```

### 10.2 실행 권한 부여 및 크론 설정
```bash
chmod +x /root/backup.sh

# 크론탭 편집
crontab -e

# 매일 새벽 3시 백업 실행
0 3 * * * /root/backup.sh >> /var/log/backup.log 2>&1
```

## 11. 문제 해결

### 11.1 로그 확인
```bash
# PM2 로그
pm2 logs

# Nginx 로그
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log

# MariaDB 로그
tail -f /var/log/mysql/error.log
```

### 11.2 서비스 상태 확인
```bash
# 모든 서비스 상태
systemctl status nginx
systemctl status mariadb
pm2 status
```

### 11.3 포트 확인
```bash
netstat -tlnp | grep -E '80|443|3000|3306'
```

### 11.4 메모리 사용량 확인
```bash
free -h
pm2 monit
```

## 추가 권장사항

### 1. 모니터링 설정
- PM2 Plus 또는 Datadog 등 모니터링 도구 설정
- 디스크 공간, CPU, 메모리 알림 설정

### 2. 보안 강화
- SSH 키 인증만 허용
- 비밀번호 정책 강화
- 정기적인 시스템 업데이트

### 3. 성능 최적화
- Redis 캐시 서버 추가 고려
- CDN 사용 검토
- 이미지 최적화 도구 설정

### 4. 개발 환경
- Git hooks 설정
- CI/CD 파이프라인 구축
- 스테이징 서버 구성

---

이 가이드를 따라 설정하면 Eden Food 시스템이 안정적으로 운영될 수 있습니다. 
문제가 발생하면 각 섹션의 로그를 확인하고 필요시 공식 문서를 참조하세요.