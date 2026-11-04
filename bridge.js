/* Central — ponte do aplicativo.
   Faz a Central funcionar fora do claude.ai: login com Google, dados no Firestore
   (sincroniza celular e computador, funciona offline), clima pelo Open-Meteo e
   download da cópia de segurança. Nenhuma senha é guardada pela Central. */
(function () {
  "use strict";
  var cfg = window.CENTRAL_FIREBASE;
  var ready = !!(cfg && cfg.apiKey && window.firebase);
  var dbPromise = null, user = null;

  function loginScreen(msg) {
    var el = document.getElementById("appLogin");
    if (!el) {
      el = document.createElement("div");
      el.id = "appLogin";
      el.innerHTML =
        '<div class="al-card"><img src="icons/icon-192.png" alt="" width="72" height="72">' +
        '<h1>Central</h1><p class="al-sub">Sua vida organizada num lugar só.</p>' +
        '<button type="button" id="alGoogle">Entrar com Google</button>' +
        '<p class="al-msg" id="alMsg"></p>' +
        '<p class="al-foot">Seus dados ficam só na sua conta. A Central não guarda senhas.</p></div>';
      document.body.appendChild(el);
      document.getElementById("alGoogle").onclick = signIn;
    }
    el.hidden = false;
    document.getElementById("alMsg").textContent = msg || "";
  }
  function hideLogin() { var el = document.getElementById("appLogin"); if (el) el.hidden = true; }

  function signIn() {
    var p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    var go = standalone ? firebase.auth().signInWithRedirect(p) : firebase.auth().signInWithPopup(p).catch(function (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return firebase.auth().signInWithRedirect(p);
      throw e;
    });
    Promise.resolve(go).catch(function (e) { loginScreen("Não deu para entrar (" + (e && e.code || "erro") + "). Tente de novo."); });
  }

  function makeDb(uid) {
    var fs = firebase.firestore();
    var root = fs.collection("users").doc(uid);
    return {
      collection: function (c) { return root.collection(c); },
      doc: function (path) { var p = String(path).split("/"); return root.collection(p[0]).doc(p[1]); }
    };
  }

  if (ready) {
    firebase.initializeApp(cfg);
    try {
      firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function () {});
    } catch (_) {}
    dbPromise = new Promise(function (resolve) {
      firebase.auth().onAuthStateChanged(function (u) {
        if (u) { user = u; hideLogin(); resolve(makeDb(u.uid)); }
        else { loginScreen(""); }
      });
    });
  }

  /* clima: Open-Meteo, sem chave e sem enviar nada pessoal */
  var WMO = function (c) {
    if (c >= 95) return "thunderstorm"; if (c >= 80 || (c >= 51 && c <= 67)) return "rain";
    if (c === 45 || c === 48) return "fog"; if (c === 3) return "overcast"; if (c === 1 || c === 2) return "partly cloudy"; return "clear";
  };
  function weatherPayload(lat, lon) {
    var u = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1";
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      return { atualizado: new Date().toISOString(),
        current: { temperature: j.current.temperature_2m, condition: WMO(j.current.weather_code), is_day: !!j.current.is_day },
        daily: [{ high: j.daily.temperature_2m_max[0], low: j.daily.temperature_2m_min[0], precipitation_chance: j.daily.precipitation_probability_max[0] }] };
    });
  }
  var mcp = {
    watchTool: function (_s, _t, loc, cb, opts) {
      var run = function () { weatherPayload(loc.latitude, loc.longitude).then(function (p) { cb({ type: "data", result: { payload: p } }); }).catch(function () {}); };
      run(); setInterval(run, (opts && opts.refetchInterval) || 1800000);
    }
  };

  var downloads = {
    save: function (o) {
      var b = new Blob([o.data], { type: "application/json" }), a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = o.filename; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return Promise.resolve();
    }
  };

  window.claude = {
    use: function (name) {
      if (name === "db") return dbPromise || Promise.resolve(null);
      if (name === "mcp") return Promise.resolve(mcp);
      if (name === "downloads") return Promise.resolve(downloads);
      if (name === "user") return Promise.resolve(user ? { id: user.uid, name: user.displayName } : null);
      return Promise.resolve(null);
    }
  };
  window.centralSignOut = function () { return firebase.auth().signOut().then(function () { location.reload(); }); };

  /* service worker: abre rápido e funciona sem internet */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();

/* botão "Instalar o app" (Android/computador) */
(function () {
  var ev = null;
  window.centralInstall = { ok: false, go: function () { if (ev) { ev.prompt(); ev = null; window.centralInstall.ok = false; } } };
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); ev = e; window.centralInstall.ok = true; });
  addEventListener("appinstalled", function () { window.centralInstall.ok = false; });
})();
