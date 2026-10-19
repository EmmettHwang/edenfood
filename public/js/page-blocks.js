/* 간편 에디터 블록 그리기 — 홈페이지와 관리자 미리보기가 함께 쓴다 (2026-10-19)
   블록: heading(제목) · text(본문) · image(사진) · cards(카드: 제목·설명·사진) · table(표) · process(단계) */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const CSS = `
  .pb-wrap{max-width:1100px;margin:0 auto;padding:8px 0 24px;color:#1f2937;font-size:16px;line-height:1.75}
  .pb-wrap .pb-h{font-size:clamp(22px,3.2vw,32px);font-weight:800;color:#14532d;margin:28px 0 10px;letter-spacing:-.02em;text-align:center}
  .pb-wrap .pb-t{white-space:pre-line;margin:0 auto 18px;max-width:820px;text-align:center;color:#374151;font-size:clamp(15px,1.9vw,18px)}
  .pb-wrap .pb-img{margin:18px 0;text-align:center}.pb-wrap .pb-img img{max-width:100%;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.08)}
  .pb-wrap .pb-img figcaption{font-size:14px;color:#6b7280;margin-top:8px}
  .pb-wrap .pb-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin:22px 0}
  .pb-wrap .pb-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.06);display:flex;flex-direction:column}
  .pb-wrap .pb-card .ph{aspect-ratio:4/3;background:#f3f4f6 center/cover no-repeat}
  .pb-wrap .pb-card .bd{padding:16px 18px 20px}.pb-wrap .pb-card h4{margin:0 0 6px;font-size:19px;font-weight:800;color:#15803d}
  .pb-wrap .pb-card p{margin:0;color:#4b5563;font-size:15px;white-space:pre-line}
  .pb-wrap .pb-tbl{margin:20px 0;overflow-x:auto}.pb-wrap .pb-tbl .tt{font-weight:700;margin-bottom:8px}
  .pb-wrap table{width:100%;border-collapse:collapse;background:#fff;font-size:15px}
  .pb-wrap th{background:#15803d;color:#fff;padding:10px 12px;text-align:left}.pb-wrap td{border-bottom:1px solid #e5e7eb;padding:10px 12px}
  .pb-wrap .pb-proc{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:22px 0}
  .pb-wrap .pb-step{flex:1 1 150px;max-width:220px;background:linear-gradient(135deg,#16a34a,#0e7490);color:#fff;border-radius:14px;padding:14px 12px;text-align:center;font-weight:700}
  .pb-wrap .pb-step b{display:inline-flex;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.25);align-items:center;justify-content:center;margin-right:6px}
  .pb-wrap .pb-step small{display:block;font-weight:500;opacity:.9;margin-top:6px;font-size:13px}
  @media (max-width:600px){.pb-wrap{padding:0 4px 16px}.pb-wrap .pb-cards{gap:14px}}`;
  function ensureCss() {
    if (document.getElementById('pb-css')) return;
    const st = document.createElement('style'); st.id = 'pb-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  function process(text) {
    const steps = []; let last = null;
    String(text || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      const c = l.match(/^(\d+)\.(\d+)[.)]?\s*(.+)$/), p = l.match(/^(\d+)[.)]\s*(.+)$/);
      if (c && last) last.sub.push(c[3]); else if (p) { last = { n: p[1], t: p[2], sub: [] }; steps.push(last); }
    });
    return steps;
  }
  window.renderPageBlocks = function (blocks) {
    ensureCss();
    if (!Array.isArray(blocks) || !blocks.length) return '';
    return '<div class="pb-wrap">' + blocks.map(b => {
      if (b.type === 'heading') return b.text ? `<h3 class="pb-h">${esc(b.text)}</h3>` : '';
      if (b.type === 'text') return b.text ? `<p class="pb-t">${esc(b.text)}</p>` : '';
      if (b.type === 'image') return b.url ? `<figure class="pb-img"><img src="${esc(b.url)}" alt="${esc(b.caption || '')}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : '';
      if (b.type === 'cards') return `<div class="pb-cards">${(b.items || []).filter(it => it.title || it.desc).map(it => `<div class="pb-card">${it.image ? `<div class="ph" style="background-image:url('${esc(it.image)}')"></div>` : ''}<div class="bd"><h4>${esc(it.title)}</h4><p>${esc(it.desc)}</p></div></div>`).join('')}</div>`;
      if (b.type === 'table') return `<div class="pb-tbl">${b.title ? `<div class="tt">${esc(b.title)}</div>` : ''}<table><thead><tr>${(b.headers || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(b.rows || []).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      if (b.type === 'process') return `<div class="pb-proc">${process(b.text).map(s => `<div class="pb-step"><b>${esc(s.n)}</b>${esc(s.t)}${s.sub.length ? `<small>${s.sub.map(esc).join(' · ')}</small>` : ''}</div>`).join('')}</div>`;
      return '';
    }).join('') + '</div>';
  };
})();
