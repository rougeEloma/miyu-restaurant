/* MIYU — envoi des réservations vers /api/reservation (WhatsApp). Injecté dans le site exporté. */
(function () {
  var busy = false;
  function val(id) { var el = document.getElementById(id); return el ? String(el.value || "").trim() : ""; }
  function toast(msg, ok) {
    var t = document.getElementById("miyu-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "miyu-toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.appendChild(t);
    }
    t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;max-width:min(92vw,520px);" +
      "padding:16px 22px;border-radius:14px;font:500 15px/1.5 Jost,'Segoe UI',sans-serif;box-shadow:0 18px 40px rgba(0,0,0,.35);" +
      (ok ? "background:#efc688;color:#022d33;" : "background:#f4ecdd;color:#7a1f1f;border:1px solid #c98a8a;");
    t.textContent = msg;
    clearTimeout(t._h);
    t._h = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, ok ? 9000 : 7000);
  }
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-resa]") : null;
    if (!btn) return;
    e.preventDefault();
    if (busy) return;
    var p = btn.getAttribute("data-resa");
    var data = {
      nom: val(p + "-nom"), tel: val(p + "-tel"), date: val(p + "-date"),
      heure: val(p + "-heure"), personnes: val(p + "-pers"), espace: val(p + "-espace"), site: ""
    };
    if (data.nom.length < 2) { toast("Merci d'indiquer votre nom.", false); var n = document.getElementById(p + "-nom"); if (n) n.focus(); return; }
    if (data.tel.replace(/\D/g, "").length < 8) { toast("Merci d'indiquer un numéro de téléphone valide.", false); var tl = document.getElementById(p + "-tel"); if (tl) tl.focus(); return; }
    if (!data.date) { toast("Merci de choisir une date.", false); var d = document.getElementById(p + "-date"); if (d) d.focus(); return; }
    busy = true;
    var label = btn.textContent;
    btn.textContent = "Envoi…";
    btn.disabled = true;
    fetch("/api/reservation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res && res.ok) {
          toast("Merci " + data.nom.split(" ")[0] + " ! Votre demande est bien reçue. Nous vous confirmons la table par WhatsApp.", true);
          ["-nom", "-tel", "-date"].forEach(function (s) { var el = document.getElementById(p + s); if (el) el.value = ""; });
        } else {
          toast((res && res.error) || "La réservation n'a pas pu être envoyée. Appelez-nous au +242 05 773 9999.", false);
        }
      })
      .catch(function () { toast("Connexion impossible. Réessayez ou appelez-nous au +242 05 773 9999.", false); })
      .then(function () { busy = false; btn.textContent = label; btn.disabled = false; });
  }, true);

  // Compatibilité : si l'export du design n'a pas encore les champs Nom / Téléphone,
  // on les ajoute à côté du champ Date, et on branche le bouton « Vérifier ».
  function makeField(dateWrap, px, key, label, type, ac, ph) {
    if (document.getElementById(px + "-" + key)) return;
    var w = dateWrap.cloneNode(true);
    var lab = w.querySelector("label"), inp = w.querySelector("input");
    if (!lab || !inp) return;
    lab.setAttribute("for", px + "-" + key); lab.textContent = label;
    inp.id = px + "-" + key; inp.type = type; inp.value = ""; inp.removeAttribute("min");
    inp.setAttribute("autocomplete", ac); inp.setAttribute("placeholder", ph);
    w.style.flex = "1 1 180px";
    dateWrap.parentNode.insertBefore(w, dateWrap);
  }
  function ensureFields() {
    ["r", "c"].forEach(function (px) {
      var date = document.getElementById(px + "-date");
      if (!date) return;
      var wrap = date.parentNode, bar = wrap && wrap.parentNode;
      if (!bar) return;
      makeField(wrap, px, "nom", "Nom", "text", "name", "Votre nom");
      makeField(wrap, px, "tel", "Téléphone (WhatsApp)", "tel", "tel", "+242 …");
      var btn = bar.querySelector("button");
      if (btn && !btn.hasAttribute("data-resa")) {
        btn.setAttribute("data-resa", px);
        if (/vérifier/i.test(btn.textContent)) btn.textContent = "Réserver";
      }
    });
  }
  var pending = false;
  new MutationObserver(function () {
    if (pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; ensureFields(); });
  }).observe(document, { childList: true, subtree: true });
  // Empêche de choisir une date passée.
  document.addEventListener("focusin", function (e) {
    var t = e.target;
    if (t && t.type === "date" && /-date$/.test(t.id || "")) t.min = new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
  });
})();
