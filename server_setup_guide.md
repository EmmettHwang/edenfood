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

### 1.5 포트 충돌 사전 확인
```bash
# 주요 포트 사용 현황 확인
netstat -tlnp | grep -E ':80|:443|:3000|:3306'

# 특정 포트를 사용하는 프로세스 확인
lsof -i :80
lsof -i :443
lsof -i :3000
lsof -i :3306

# Apache2가 설치되어 있는지 확인
dpkg -l | grep apache2

# 불필요한 서비스 중지
systemctl list-units --type=service --state=active
```

### 1.6 Swap 메모리 설정 (메모리가 부족한 경우)
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

### 2.1 Claude CLI (Claude Code) 다운로드 및 설치
```bash
# Claude Code v1.0.51 설치
cd /tmp

# npm을 통한 Claude Code 설치 (권장)
npm install -g claude-code@1.0.51

# 또는 바이너리 직접 다운로드
wget https://github.com/anthropics/claude-code/releases/download/v1.0.51/claude-linux-x64.tar.gz
tar -xvf claude-linux-x64.tar.gz
mv claude /usr/local/bin/
chmod +x /usr/local/bin/claude

# 설치 확인 (버전: 1.0.51)
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

### 4.1 Node.js 20.x 설치
```bash
# NodeSource 저장소 추가 (Node.js 20.x)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js 설치
apt install -y nodejs

# 버전 확인 (v20.20.2와 호환)
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

### 5.1 MariaDB 10.6 설치
```bash
# MariaDB 10.6 저장소 추가
curl -sS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | sudo bash -s -- --mariadb-server-version="mariadb-10.6"

# MariaDB 설치
apt update
apt install -y mariadb-server mariadb-client

# MariaDB 시작 및 자동 시작 설정
systemctl start mariadb
systemctl enable mariadb

# 버전 확인 (10.6.x)
mysql --version
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
# Apache가 설치되어 있는지 확인하고 제거
systemctl status apache2
if [ $? -eq 0 ]; then
    systemctl stop apache2
    systemctl disable apache2
    apt remove -y apache2
fi

# Nginx 설치
apt install -y nginx

# Nginx 시작 및 자동 시작 설정
systemctl start nginx
systemctl enable nginx

# Nginx 버전 확인 (1.18.0)
nginx -v
```

### 6.2 Nginx 설정
```bash
# 기본 설정 백업 후 제거
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
rm -f /etc/nginx/sites-enabled/default

# 웹루트 디렉토리 생성 (Let's Encrypt 인증용)
mkdir -p /var/www/html
chown -R www-data:www-data /var/www/html

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

### 8.1 SSL 인증서 사전 준비 (중요)
```bash
# Nginx가 실행 중인지 확인
systemctl status nginx

# 만약 포트 80이 다른 프로세스에서 사용 중이면 확인
lsof -i :80
netstat -tlnp | grep :80

# Apache가 설치되어 있다면 중지 및 비활성화
systemctl stop apache2
systemctl disable apache2

# Nginx가 정상적으로 80포트를 사용하는지 확인
nginx -t
systemctl restart nginx
```

### 8.2 Certbot 설치 및 SSL 인증서 발급
```bash
# Certbot 설치
apt install -y certbot python3-certbot-nginx

# 도메인 소유권 확인을 위한 임시 파일 생성 권한 설정
mkdir -p /var/www/html/.well-known/acme-challenge
chmod -R 755 /var/www/html

# SSL 인증서 발급 (--nginx-server-root 옵션으로 nginx 설정 경로 명시)
certbot --nginx -d your-domain.com -d www.your-domain.com \
  --nginx-server-root /etc/nginx \
  --agree-tos \
  --no-eff-email \
  --email your-email@example.com

# 인증서 발급 실패 시 standalone 모드로 재시도
# (nginx를 잠시 중지하고 certbot이 직접 80포트 사용)
systemctl stop nginx
certbot certonly --standalone -d your-domain.com -d www.your-domain.com
systemctl start nginx

# 자동 갱신 설정 확인
systemctl status snap.certbot.renew.timer || systemctl status certbot.timer

# 자동 갱신 테스트
certbot renew --dry-run
```

### 8.3 SSL 인증서 문제 해결
```bash
# 일반적인 문제 해결 방법

# 1. 포트 80 접근 문제
# 방화벽에서 80, 443 포트가 열려있는지 확인
ufw status
ufw allow 80
ufw allow 443

# 2. Nginx 설정 문제
# 기본 사이트 비활성화
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 3. 도메인 DNS 설정 확인
# A 레코드가 서버 IP를 올바르게 가리키는지 확인
dig your-domain.com
nslookup your-domain.com

# 4. 인증서 수동 갱신
certbot renew --force-renewal
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

## SSL 인증서 발급 시 자주 발생하는 문제와 해결법

### 1. "Could not bind to port 80" 오류
```bash
# 해결 방법
# 1. 80포트를 사용 중인 프로세스 확인
sudo lsof -i :80
sudo netstat -tlnp | grep :80

# 2. Apache 제거
sudo systemctl stop apache2
sudo apt remove apache2

# 3. Nginx 재시작
sudo systemctl restart nginx
```

### 2. "Invalid response from domain" 오류
```bash
# 해결 방법
# 1. DNS 설정 확인
dig your-domain.com
ping your-domain.com

# 2. Nginx 설정에서 도메인 확인
grep server_name /etc/nginx/sites-enabled/*

# 3. 웹루트 권한 확인
ls -la /var/www/html/
sudo chown -R www-data:www-data /var/www/html
```

### 3. "Connection refused" 오류
```bash
# 해결 방법
# 1. 방화벽 설정 확인
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 2. 클라우드 제공자의 보안그룹/방화벽 규칙 확인
# Cafe24의 경우 관리 콘솔에서 포트 80, 443 허용 필요
```

### 4. Certbot과 Nginx 플러그인 문제
```bash
# standalone 모드로 인증서 발급 후 수동 설정
sudo certbot certonly --standalone -d your-domain.com
sudo vim /etc/nginx/sites-available/edenfood
# SSL 설정 수동 추가
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