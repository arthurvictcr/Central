/* Seiva — ponte do aplicativo.
   Faz o app funcionar fora do claude.ai: login com Google, dados no Firestore
   (sincroniza celular e computador, funciona offline), clima pelo Open-Meteo e
   download da cópia de segurança. Nenhuma senha é guardada pelo app. */
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
        '<h1>Seiva</h1><p class="al-sub">Sua rotina em fluxo.</p>' +
        '<button type="button" id="alGoogle">Entrar com Google</button>' +
        '<button type="button" id="alGuest">Usar sem conta (visitante)</button>' +
        '<p class="al-msg" id="alMsg"></p>' +
        '<p class="al-foot">Com Google, seus dados ficam na sua conta e voltam em qualquer aparelho. Como visitante, ficam só neste aparelho: baixe a cópia de segurança de vez em quando.</p></div>';
      document.body.appendChild(el);
      document.getElementById("alGoogle").onclick = signIn;
      document.getElementById("alGuest").onclick = guest;
    }
    el.hidden = false;
    document.getElementById("alMsg").textContent = msg || "";
    if (window.__splashDone) window.__splashDone();
  }
  function hideLogin() { var el = document.getElementById("appLogin"); if (el) el.hidden = true; }

  /* entrar pela janelinha do Google (funciona no app instalado e no navegador);
     o redirecionamento fica só de reserva, porque os navegadores novos bloqueiam a volta dele */
  function provider() { var p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" }); return p; }
  function signIn() {
    var msg = document.getElementById("alMsg"); if (msg) msg.textContent = "Abrindo o Google…";
    firebase.auth().signInWithPopup(provider()).catch(function (e) {
      var c = e && e.code;
      if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") { loginScreen(""); return; }
      if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment") return firebase.auth().signInWithRedirect(provider());
      loginScreen("Não deu para entrar (" + (c || "erro") + "). Tente de novo.");
    });
  }
  function guest() {
    var msg = document.getElementById("alMsg"); if (msg) msg.textContent = "Entrando como visitante…";
    firebase.auth().signInAnonymously().catch(function (e) {
      loginScreen(e && e.code === "auth/operation-not-allowed" ? "O modo visitante ainda não foi ligado no Firebase (Authentication → Sign-in method → Anônimo)." : "Não deu para entrar como visitante. Tente de novo.");
    });
  }
  window.centralLinkGoogle = function () {
    var u = firebase.auth().currentUser; if (!u) return;
    u.linkWithPopup(provider()).then(function () { location.reload(); }).catch(function (e) {
      alert(e && e.code === "auth/credential-already-in-use"
        ? "Essa conta Google já tem dados no Seiva. Baixe a cópia de segurança (Configurações), saia, entre com a conta Google e use Restaurar."
        : "Não deu para ligar à conta Google agora. Tente de novo.");
    });
  };

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
    try { firebase.firestore().settings({ ignoreUndefinedProperties: true, merge: true }); } catch (_) {}
    try {
      firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function () {});
    } catch (_) {}
    /* o Firestore não aceita campos com nome vazio nem listas dentro de listas: limpa antes de salvar */
    var clean = function (v) {
      if (Array.isArray(v)) return v.map(function (x) { return Array.isArray(x) ? JSON.stringify(x) : clean(x); });
      if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
        var o = {}; Object.keys(v).forEach(function (k) { if (v[k] !== undefined) o[k === "" ? "classico" : k] = clean(v[k]); }); return o;
      }
      return v;
    };
    try {
      var DR = firebase.firestore.DocumentReference.prototype, CR = firebase.firestore.CollectionReference.prototype;
      var _set = DR.set, _upd = DR.update, _add = CR.add;
      DR.set = function (d, o) { return _set.call(this, clean(d), o); };
      DR.update = function (d) { return _upd.call(this, clean(d)); };
      CR.add = function (d) { return _add.call(this, clean(d)); };
    } catch (_) {}
    try { firebase.auth().getRedirectResult().catch(function (e) { if (e && e.code) loginScreen("Não deu para entrar (" + e.code + "). Toque em Entrar com Google de novo."); }); } catch (_) {}
    dbPromise = new Promise(function (resolve) {
      firebase.auth().onAuthStateChanged(function (u) {
        if (u) { user = u; window.CENTRAL_USER = { name: u.displayName || "", anon: !!u.isAnonymous }; hideLogin(); resolve(makeDb(u.uid)); }
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
      var run = function () { var L = (window.CENTRAL_WXLOC && window.CENTRAL_WXLOC()) || loc; weatherPayload(L.latitude, L.longitude).then(function (p) { cb({ type: "data", result: { payload: p } }); }).catch(function () {}); };
      window.__wxRun = run; run(); setTimeout(run, 4000); setInterval(run, (opts && opts.refetchInterval) || 1800000);
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
