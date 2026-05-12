#!/bin/bash
# ─────────────────────────────────────────
# Let's Encrypt SSL 인증서 발급/갱신 스크립트
# edenfood.co.kr
#
# 사용법:
#   1. DNS A레코드를 이 서버 IP로 변경
#   2. sudo bash /var/eden/ssl-renew.sh
#   3. 자동 갱신은 certbot.timer가 처리
# ─────────────────────────────────────────

DOMAIN="edenfood.co.kr"
EMAIL="admin@edenfood.co.kr"
NGINX_CONF="/etc/nginx/sites-available/edenfood"

echo "=== Let's Encrypt SSL 인증서 발급 ==="

# 인증서 발급
certbot certonly --webroot \
  -w /var/www/certbot \
  -d $DOMAIN -d www.$DOMAIN \
  --email $EMAIL \
  --agree-tos \
  --non-interactive

if [ $? -eq 0 ]; then
  echo "✅ 인증서 발급 성공!"

  # Nginx 설정에서 자체서명 → Let's Encrypt로 전환
  sed -i 's|^\(\s*ssl_certificate\s\+/etc/nginx/ssl/edenfood.crt;\)|#\1|' $NGINX_CONF
  sed -i 's|^\(\s*ssl_certificate_key\s\+/etc/nginx/ssl/edenfood.key;\)|#\1|' $NGINX_CONF
  sed -i 's|^#\s*\(ssl_certificate\s\+/etc/letsencrypt/live/edenfood.co.kr/fullchain.pem;\)|\1|' $NGINX_CONF
  sed -i 's|^#\s*\(ssl_certificate_key\s\+/etc/letsencrypt/live/edenfood.co.kr/privkey.pem;\)|\1|' $NGINX_CONF

  # HSTS 활성화
  sed -i 's|^#\s*\(add_header Strict-Transport-Security\)|\1|' $NGINX_CONF

  nginx -t && systemctl reload nginx
  echo "✅ Nginx 재시작 완료!"
  echo "✅ https://$DOMAIN 에서 확인하세요"
else
  echo "❌ 인증서 발급 실패. DNS 설정을 확인하세요."
  echo "   이 서버 IP: $(curl -s ifconfig.me)"
  echo "   도메인 IP:  $(dig +short $DOMAIN)"
fi
