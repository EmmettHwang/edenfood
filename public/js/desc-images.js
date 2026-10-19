/* 설명 글 → HTML (브랜드 설명 등) — 홈페이지와 관리자 미리보기가 함께 쓴다 (2026-10-19)
   그림: ![설명](주소)            → 폭 100% · 가운데
         ![설명](주소){w=60,a=left} → 폭 60% · 왼쪽   (a = left | center | right)
   줄바꿈은 그대로, 두 칸 이상 공백은 들여쓰기로 남긴다. 그림 앞뒤 공백은 지운다(들여쓰기에 밀리지 않게). */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const IMG = /!\[([^\]]*)\]\(([^)\s]+)\)(?:\{([^}]*)\})?/g;
  function opts(s) {
    const o = { w: 100, a: 'center' };
    String(s || '').split(/[,\s]+/).forEach(kv => {
      const m = kv.match(/^(w|a)=(.+)$/); if (!m) return;
      if (m[1] === 'w') { const n = parseInt(m[2], 10); if (n >= 10 && n <= 100) o.w = n; }
      if (m[1] === 'a' && ['left', 'center', 'right'].includes(m[2])) o.a = m[2];
    });
    return o;
  }
  function imgHtml(alt, url, o) {
    if (!/^(\/|https?:\/\/)/.test(url)) return esc(alt);
    const margin = o.a === 'left' ? '1rem auto 1rem 0' : o.a === 'right' ? '1rem 0 1rem auto' : '1rem auto';
    return `<img src="${esc(url)}" alt="${esc(alt)}" class="bd-img" loading="lazy" style="display:block;width:${o.w}%;max-width:100%;height:auto;margin:${margin};border-radius:.5rem">`;
  }
  window.DescImages = {
    // 글 속 그림 목록(관리자 「그림 크기·정렬」 칸이 쓴다)
    list(text) {
      const out = []; let m; IMG.lastIndex = 0;
      while ((m = IMG.exec(String(text || '')))) out.push({ alt: m[1], url: m[2], ...opts(m[3]), start: m.index, end: m.index + m[0].length });
      return out;
    },
    // n 번째 그림의 크기·정렬을 바꾼 글을 돌려준다
    set(text, n, w, a) {
      let k = -1;
      return String(text || '').replace(IMG, (all, alt, url) => {
        k++; if (k !== n) return all;
        return (w === 100 && a === 'center') ? `![${alt}](${url})` : `![${alt}](${url}){w=${w},a=${a}}`;
      });
    },
    toHtml(text) {
      const parts = []; let last = 0, m; const src = String(text || ''); IMG.lastIndex = 0;
      while ((m = IMG.exec(src))) {
        parts.push({ t: src.slice(last, m.index) }); parts.push({ img: imgHtml(m[1], m[2], opts(m[3])) }); last = m.index + m[0].length;
      }
      parts.push({ t: src.slice(last) });
      return parts.map((p, i) => {
        if (p.img) return p.img;
        let t = p.t;
        if (i > 0 && parts[i - 1].img) t = t.replace(/^[ \t]*\n?/, '');          // 그림 바로 뒤 공백·줄바꿈
        if (i < parts.length - 1 && parts[i + 1].img) t = t.replace(/\n?[ \t]*$/, ''); // 그림 바로 앞
        return esc(t).replace(/\n/g, '<br>').replace(/ {2,}/g, s => '&nbsp;'.repeat(s.length));
      }).join('');
    }
  };
})();
