// eBike Detour - page behaviour. Pages work without it (all content is in the HTML); this adds the
// finder, sorting, filters, the range calculator and the fit picker.
(function () {
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ft(i) { return Math.floor(i / 12) + "'" + (i % 12) + '"'; }

  // Footer year.
  var y = $("#year"); if (y) y.textContent = new Date().getFullYear();

  // Disclosure bar: hide on the first scroll without making the page jump.
  var bar = $("#disclosure-bar");
  function hideBar() {
    if (!bar || window.scrollY <= 0) return;
    var h = bar.offsetHeight; bar.remove(); window.scrollBy(0, -h);
    window.removeEventListener("scroll", hideBar);
  }
  window.addEventListener("scroll", hideBar, { passive: true });

  // Phone menu.
  var tog = $(".nav-toggle"), nav = $(".main-nav");
  if (tog && nav) tog.addEventListener("click", function () {
    var open = nav.classList.toggle("open"); tog.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // ---------- Bike finder (index) ----------
  var form = $("#finder-form"), grid = $("#bike-grid");
  if (form && grid) {
    var cards = $$(".bike", grid);
    function run() {
      var f = form.elements;
      var h = (+f.hft.value) * 12 + (+f.hin.value), load = +f.load.value || 0, miles = +f.miles.value || 0;
      var budget = +f.budget.value, terrain = f.terrain.value;
      var results = cards.map(function (c) {
        var d = c.dataset, tags = " " + d.tags + " ", s = 0, why = [];
        var hmin = +d.hmin, hmax = +d.hmax, price = +d.price, weight = +d.weight;
        if (h < hmin) why.push("made for riders " + ft(hmin) + " and up");
        if (h > hmax) why.push("made for riders up to " + ft(hmax));
        if (load > +d.payload) why.push("rated to " + d.payload + " lb total");
        if (price > budget) why.push("over budget at $" + price.toLocaleString());
        if (f.fold.checked && tags.indexOf(" fold ") < 0) why.push("doesn't fold");
        if (f.step.checked && tags.indexOf(" step ") < 0) why.push("not step-through");
        // Everyday range: medium assist, rolling terrain, warm (same model as the range calculator).
        var wf = Math.max(0.8, 1 + (load + weight - 250) / 500);
        var tf = { paved: 1.0, mixed: 1.22, rough: 1.4, sand: 1.7 }[terrain];
        var everyday = +d.wh * 0.9 / (18 * wf * tf);
        if (miles > everyday * 1.3) why.push("about " + Math.round(everyday) + " mi on a charge in your conditions");
        else if (miles > everyday) s -= 2;
        else s += 2 + Math.min(2, (everyday - miles) / 20);
        if (terrain === "paved") { if (d.sensor === "torque") s += 2; if (tags.indexOf(" city ") >= 0 || tags.indexOf(" commute ") >= 0) s += 2; }
        if (terrain === "mixed") { if (d.wheel === "26") s += 1.5; if (tags.indexOf(" trail ") >= 0) s += 1; if (d.sensor === "torque") s += 1; }
        if (terrain === "rough") { if (tags.indexOf(" fullsus ") >= 0) s += 4; if (tags.indexOf(" rearsus ") >= 0) s += 1.5; if (d.wheel === "26") s += 1.5; if (tags.indexOf(" mountain ") >= 0) s += 1; }
        if (terrain === "sand") { s += (+d.wh) / 500; if (tags.indexOf(" fullsus ") >= 0 || tags.indexOf(" rearsus ") >= 0) s += 1; }
        if (f.cargo.checked) { if (tags.indexOf(" cargo ") >= 0) s += 4; s += (+d.payload - 350) / 50; }
        if (f.light.checked) s += (85 - weight) / 4;
        if (f.seat.checked) s += tags.indexOf(" seat ") >= 0 ? 4 : -1;
        if (f.fold.checked && tags.indexOf(" fold ") >= 0) s += 2;
        if (f.step.checked && tags.indexOf(" step ") >= 0) s += 2;
        s += (budget - price) / 1000;  // small nudge toward the cheaper of two equal bikes
        return { c: c, s: s, why: why };
      });
      results.sort(function (a, b) {
        if (!a.why.length !== !b.why.length) return a.why.length ? 1 : -1;
        return b.s - a.s;
      });
      var fits = 0;
      results.forEach(function (r, i) {
        grid.appendChild(r.c);
        var m = $(".match", r.c), w = $(".why-not", r.c);
        r.c.classList.toggle("dim", r.why.length > 0);
        if (!r.why.length) fits++;
        if (!r.why.length && i < 3) { m.hidden = false; m.textContent = i === 0 ? "Best match" : "Good match"; r.c.classList.add("top"); }
        else { m.hidden = true; r.c.classList.remove("top"); }
        w.hidden = !r.why.length;
        w.textContent = r.why.length ? "Not a fit: " + r.why.join(", ") + "." : "";
      });
      var sum = $("#finder-summary");
      if (sum) {
        var best = results[0];
        sum.innerHTML = fits
          ? fits + " of " + cards.length + " bikes fit. Best match: <a href=\"#lineup\">" + $("h3 a", best.c).textContent + "</a>."
          : "Nothing fits every answer - the closest options are listed first. Try a higher budget or fewer must-haves.";
      }
    }
    form.addEventListener("input", run); form.addEventListener("change", run);
    run();
  }

  // ---------- Sortable tables ----------
  $$("table.sortable").forEach(function (t) {
    $$("thead th", t).forEach(function (th, col) {
      if (!th.textContent.trim()) return;
      th.tabIndex = 0; th.classList.add("sort");
      function sortBy() {
        var asc = th.getAttribute("aria-sort") !== "ascending";
        $$("thead th", t).forEach(function (x) { x.removeAttribute("aria-sort"); });
        th.setAttribute("aria-sort", asc ? "ascending" : "descending");
        var num = th.dataset.type === "num", body = t.tBodies[0];
        var rows = $$("tr", body);
        rows.sort(function (a, b) {
          var ca = a.children[col], cb = b.children[col];
          var va = ca.dataset.sort != null ? ca.dataset.sort : ca.textContent.trim();
          var vb = cb.dataset.sort != null ? cb.dataset.sort : cb.textContent.trim();
          var r = num ? (parseFloat(va) || 0) - (parseFloat(vb) || 0) : String(va).localeCompare(String(vb));
          return asc ? r : -r;
        });
        rows.forEach(function (r) { body.appendChild(r); });
      }
      th.addEventListener("click", sortBy);
      th.addEventListener("keydown", function (ev) { if (ev.key === "Enter") sortBy(); });
    });
  });

  // ---------- Compare filters ----------
  var filters = $("#cmp-filters"), cmp = $("#cmp-table");
  if (filters && cmp) filters.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    $$("button", filters).forEach(function (x) { x.classList.toggle("on", x === b); });
    var f = b.dataset.f;
    $$("tbody tr", cmp).forEach(function (tr) {
      var tags = " " + tr.dataset.tags + " ", price = +tr.children[1].dataset.sort, wh = +tr.children[4].dataset.sort;
      var show = !f || (f === "budget" ? price < 1000 : f === "longrange" ? wh >= 960 : tags.indexOf(" " + f + " ") >= 0);
      tr.hidden = !show;
    });
  });

  // ---------- Range calculator ----------
  var rf = $("#range-form"), dataEl = $("#bike-data");
  if (rf && dataEl) {
    var bikes = JSON.parse(dataEl.textContent), byId = {};
    bikes.forEach(function (b) { byId[b.id] = b; });
    var BASE = { eco: 12, mid: 18, high: 25, throttle: 30 }, FAST = { eco: 1.0, mid: 1.08, high: 1.2, throttle: 1.25 };
    var TERR = { paved: 1.0, rolling: 1.2, gravel: 1.25, hilly: 1.45, sand: 1.7 }, TEMP = { warm: 0.9, cool: 0.8, cold: 0.7, freezing: 0.6 };
    function calc() {
      var f = rf.elements, b = byId[f.bike.value];
      var wf = Math.max(0.8, 1 + ((+f.rider.value || 0) + (+f.cargo.value || 0) + b.weight - 250) / 500);
      var whpm = BASE[f.assist.value] * (f.fast.checked ? FAST[f.assist.value] : 1) * wf * TERR[f.terrain.value];
      var mi = b.wh * TEMP[f.temp.value] / whpm;
      $("#calc-num").textContent = Math.round(mi * 0.85) + "–" + Math.round(mi * 1.15) + " miles";
      $("#calc-sub").textContent = "about " + Math.round(whpm) + " Wh per mile from a " + b.wh.toLocaleString() + "Wh battery";
      var pct = Math.min(100, Math.round(mi / b.range * 100));
      $("#calc-bar").style.width = pct + "%";
      $("#calc-note").textContent = "That's about " + pct + "% of Kingbull's " + b.range + "-mile ideal-conditions rating.";
      var link = $("#calc-link"); link.href = "kingbull-" + b.id + ".html"; link.textContent = "See the " + b.name.replace("Kingbull ", "") + " →";
    }
    rf.addEventListener("input", calc); rf.addEventListener("change", calc);
    calc();
  }

  // ---------- Battery & charger fit picker ----------
  var fs = $("#fit-select");
  if (fs) {
    function pick() {
      var v = fs.value;
      $$(".fit-block").forEach(function (b) { b.hidden = !!v && b.id !== v; });
      if (v && history.replaceState) history.replaceState(null, "", "#" + v);
    }
    if (location.hash && $(location.hash) && $(location.hash).classList.contains("fit-block")) fs.value = location.hash.slice(1);
    fs.addEventListener("change", pick);
    pick();
  }
})();
