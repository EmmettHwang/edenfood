/* 순서 바꾸기 도우미 — 관리자가 정한 순서를 system_settings 에 id 배열(JSON)로 둔다 (2026-10-19)
   열쇠: gallery_item_order · notice_item_order (제품은 products 화면이 따로 쓴다)
   순서에 없는 항목(새로 올린 것)은 맨 앞에 원래 순서대로 — 새 글·새 사진이 위에 보이게 */
(function () {
  const cache = {};
  window.ItemOrder = {
    async load(key) {
      if (cache[key]) return cache[key];
      try {
        const j = await (await fetch('/api/settings')).json();
        const v = j.data && j.data.settings && j.data.settings[key];
        const a = v ? JSON.parse(v) : [];
        cache[key] = Array.isArray(a) ? a : [];
      } catch (_) { cache[key] = []; }
      return cache[key];
    },
    sort(list, order) {
      const at = new Map(order.map((id, i) => [Number(id), i]));
      const fresh = list.filter(x => !at.has(Number(x.id)));
      const known = list.filter(x => at.has(Number(x.id))).sort((a, b) => at.get(Number(a.id)) - at.get(Number(b.id)));
      return [...fresh, ...known];
    },
    // full: 지금 전체 순서 · shown: 화면에 보이는(걸러진) 목록 — 보이는 이웃과 자리를 바꾼다
    swap(full, shown, id, d) {
      const i = shown.findIndex(x => x.id === id), k = i + d;
      if (i < 0 || k < 0 || k >= shown.length) return null;
      const a = full.findIndex(x => x.id === id), b = full.findIndex(x => x.id === shown[k].id);
      const out = full.slice(); [out[a], out[b]] = [out[b], out[a]];
      return out;
    },
    async save(key, ids) {
      cache[key] = ids;
      const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('eden_token') },
        body: JSON.stringify({ settings: { [key]: JSON.stringify(ids) } }) });
      let j = {}; try { j = await r.json(); } catch (_) {}
      if (!(r.ok && j.ok)) throw new Error({ 401: '로그인이 풀렸습니다', 403: '권한이 없습니다(관리자만)' }[r.status] || j.error || ('서버 응답 ' + r.status));
    }
  };
})();
