// 로그인 실패 제한 (2026-09-15)
//
// 교수오빠: 「백도어는 단단히 잠궈 놓자. 모든 사이트 공통이야」
//
// 같은 IP 에서 로그인을 여러 번 틀리면 그 IP 를 잠시 막고, 막는 그 순간
// 호스트의 site-switch 로 알려 교수오빠 폰에 문자가 가게 한다.
//
// ⚠️ 값은 메모리에만 둔다. 다시 시작하면 지워진다 — 그래도 무차별 대입은 막힌다.
// ⚠️ 막혀도 돌려주는 말은 바꾸지 않는다. 어떤 아이디가 있는지 알려 주지 않기 위해서.
const fs = require('fs');
const path = require('path');

const MAX_FAIL = 5;       // 이만큼 틀리면
const WINDOW = 600000;    // 10분 안에
const BLOCK = 900000;     // 15분 막는다

const fails = new Map();    // ip -> [틀린 시각]
const blocked = new Map();  // ip -> 풀리는 시각

const SWITCH = process.env.SITE_SWITCH_URL || 'http://172.17.0.1:8099';

function clientIp(req) {
  // Cloudflare·nginx 를 거쳐 오므로 넘겨받은 머리글을 먼저 본다
  const h = req.headers || {};
  const v = h['cf-connecting-ip'] || h['x-real-ip']
         || (h['x-forwarded-for'] || '').split(',')[0];
  return String(v || req.ip || '?').trim().slice(0, 45);
}

function lockoutKey() {
  // ⚠️ 환경변수에 없으면 옆의 .env 를 훑는다. 사이트마다 설정 읽는 방식이 다르다.
  if (process.env.LOCKOUT_KEY) return process.env.LOCKOUT_KEY.trim();
  for (const d of [__dirname, path.dirname(__dirname)]) {
    for (const name of ['.env', '.env.docker']) {
      try {
        const t = fs.readFileSync(path.join(d, name), 'utf8');
        const m = t.match(/^LOCKOUT_KEY=(.*)$/m);
        if (m) return m[1].trim().replace(/^["']|["']$/g, '');
      } catch (e) { /* 없으면 넘어간다 */ }
    }
  }
  return '';
}

async function notify(site, ip, tries) {
  const key = lockoutKey();
  if (!key) return;
  try {
    await fetch(SWITCH + '/public/lockout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, site, ip, tries }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (e) { /* 알림이 실패해도 로그인 처리를 막지 않는다 */ }
}

function blockedFor(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const until = blocked.get(ip) || 0;
  if (until > now) return Math.ceil((until - now) / 1000);
  if (until) blocked.delete(ip);
  return 0;
}

function recordFail(req, site) {
  const ip = clientIp(req);
  const now = Date.now();
  const arr = (fails.get(ip) || []).filter(t => now - t < WINDOW);
  arr.push(now);
  fails.set(ip, arr);
  if (arr.length >= MAX_FAIL && (blocked.get(ip) || 0) <= now) {
    blocked.set(ip, now + BLOCK);
    fails.set(ip, []);
    notify(site, ip, arr.length);
  }
}

function recordOk(req) {
  const ip = clientIp(req);
  fails.delete(ip);
  blocked.delete(ip);
}

module.exports = { blockedFor, recordFail, recordOk, clientIp };
