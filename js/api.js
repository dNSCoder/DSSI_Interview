// ตัวเรียก Apps Script
// POST ใช้ text/plain เพื่อเลี่ยง CORS preflight (Apps Script ไม่รองรับ preflight)
(function () {
  var S = window.DSSI_STRINGS;

  function networkError() {
    return { ok: false, network: true, error: S.err.network };
  }

  async function parse(res) {
    try {
      var data = await res.json();
      return data && typeof data === 'object' ? data : networkError();
    } catch (e) {
      return networkError();
    }
  }

  window.apiGet = async function (params) {
    try {
      var url = window.DSSI_CONFIG.API_URL + '?' + new URLSearchParams(params).toString();
      var res = await fetch(url, { method: 'GET', redirect: 'follow' });
      return await parse(res);
    } catch (e) {
      return networkError();
    }
  };

  window.apiPost = async function (body) {
    try {
      var res = await fetch(window.DSSI_CONFIG.API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
      });
      return await parse(res);
    } catch (e) {
      return networkError();
    }
  };

  // ตรวจลิงก์ Meet ฝั่ง client (ตรวจซ้ำที่ server ด้วย)
  var MEET_RE = /^https:\/\/meet\.google\.com\/[a-z0-9-]+(\?.*)?$/;
  window.isMeetUrl = function (s) {
    return typeof s === 'string' && MEET_RE.test(s.trim());
  };

  // localStorage / sessionStorage ห่อ try/catch เสมอ
  window.safeStore = function (kind) {
    function area() {
      return kind === 'session' ? window.sessionStorage : window.localStorage;
    }
    return {
      get: function (k) { try { return area().getItem(k) || ''; } catch (e) { return ''; } },
      set: function (k, v) { try { area().setItem(k, v); } catch (e) { /* ignore */ } },
      remove: function (k) { try { area().removeItem(k); } catch (e) { /* ignore */ } },
    };
  };
})();
