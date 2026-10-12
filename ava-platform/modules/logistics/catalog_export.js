// OWNED_BY: generic. Actual source method review and export; no demo patient ranges.
let ceData,
  ceSources,
  ceOffset = 0,
  ceSourceOffset = 0,
  ceSearch = "",
  ceEpoch = 0,
  ceScope;
const ceEsc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ceContext = () =>
  JSON.stringify([
    window.currentUser?.id,
    window.currentUser?.tenant_id ||
      window.currentUser?.profile?.tenant_id ||
      window.AVA_RUNTIME_CONFIG?.tenantId,
  ]);
const ceCurrent = (scope, epoch) =>
  scope === ceContext() &&
  epoch === ceEpoch &&
  (typeof currentPage !== "string" || currentPage === "catalog-export");
async function renderReviewedCatalog() {
  const scope = ceContext(),
    epoch = ++ceEpoch,
    main = document.getElementById("main-content");
  if (ceScope && ceScope !== scope) {
    ceOffset = ceSourceOffset = 0;
    ceSearch = "";
    ceData = ceSources = undefined;
  }
  ceScope = scope;
  main.innerHTML =
    "<h1>Katalog & Review Metode Tenant</h1><p>Memuat sumber…</p>";
  try {
    const [board, sources] = await Promise.all([
      sbRpc("lis_catalog_board", { p_offset: ceOffset }),
      sbRpc("lis_catalog_sources", {
        p_search: ceSearch,
        p_offset: ceSourceOffset,
      }),
    ]);
    if (!ceCurrent(scope, epoch)) return;
    ceData = board;
    ceSources = sources;
    main.innerHTML = `<section class=ce-review><style>.ce-review{max-width:1100px;margin:auto;padding:16px}.ce-review article,.ce-review form{padding:16px;margin:12px 0;border:1px solid #b7c6ce;border-radius:8px}.ce-review label{display:block;margin:10px 0}.ce-review input,.ce-review select,.ce-review textarea{width:100%;box-sizing:border-box;padding:9px}.ce-review button{padding:9px;margin:4px}.ce-review .ce-range{border:1px solid #aaa;padding:12px;margin:12px 0}.ce-review pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Katalog & Review Metode Tenant</h1><p>Mapping LOINC/UCUM, specimen, metode/alat/reagen, IFU dan kelompok rujukan disahkan profesional berprivilege. Katalog generik merupakan proposal. Master dan versi original dipertahankan.</p><p>Pengaturan ini menyiapkan ekspor tenant; penerapan ke interpretasi hasil LIS legacy memerlukan adapter sumber yang teruji.</p><button id=ce-new>Konfigurasi metode baru</button><button id=ce-reload>Muat ulang</button><p id=ce-error role=alert></p><div id=ce-editor></div><form id=ce-search><label>Cari sumber pemeriksaan / analit<input name=search value="${ceEsc(ceSearch)}" maxlength=200></label><button>Cari sumber</button></form><p>Sumber halaman ${1 + ceSourceOffset / 50}: ${
      sources.rows
        .slice(0, 50)
        .map((s) => ceEsc(s.examination_name + " → " + s.analyte_name))
        .join(" · ") || "Tidak ditemukan"
    }</p><button id=ce-source-prev ${ceSourceOffset === 0 ? "disabled" : ""}>Sumber sebelumnya</button><button id=ce-source-next ${sources.rows.length <= 50 ? "disabled" : ""}>Sumber berikutnya</button>${
      board.rows
        .slice(0, 50)
        .map(
          (r) =>
            `<article><h2>${ceEsc(r.source_snapshot.examination_name)} → ${ceEsc(r.source_snapshot.item_name)}</h2><p>${ceEsc(r.method_id)} · revisi ${r.revision} · ${ceEsc(r.state)} · #${r.id}</p><p>${ceEsc(r.definition.primary_name)} · LOINC ${ceEsc(r.definition.loinc)} · UCUM ${ceEsc(r.definition.ucum || "kualitatif")}</p><p>${ceEsc(r.definition.method)} · ${ceEsc(r.definition.specimen)} · ${ceEsc(r.definition.device_reagent)}</p><p>Acuan ${ceEsc(r.definition.source_version)} · ${ceEsc(r.definition.reference_evidence)}</p><p>Berlaku ${ceEsc(r.valid_from)} sampai ${ceEsc(r.valid_until)} · Reviewer ${ceEsc(r.reviewed_by || "Belum disahkan")}</p><ul>${r.definition.ranges.map((g) => `<li>Usia ${ceEsc(g.age_min)}–${ceEsc(g.age_max)} ${ceEsc({ d: "hari", mo: "bulan", a: "tahun" }[r.definition.age_unit])}; batas awal ${g.age_lower_inclusive ? "termasuk" : "tidak termasuk"}, batas akhir ${g.age_upper_inclusive ? "termasuk" : "tidak termasuk"} · ${ceEsc({ all: "Semua", male: "Laki-laki", female: "Perempuan" }[g.sex])} · ${ceEsc(g.condition)} · ${r.definition.result_type === "qualitative" ? ceEsc(g.expected_values.join(", ")) : ceEsc(g.operator === "BETWEEN" ? g.lower + "–" + g.upper : g.operator + " " + (g.upper ?? g.lower)) + " " + ceEsc(r.definition.ucum)}</li>`).join("")}</ul>${(r.state === "draft" ? ["submit"] : r.state === "in_review" ? ["approve", "reject"] : r.state === "approved" ? ["activate", "retire"] : r.state === "active" ? ["export", "retire"] : []).map((a) => `<button data-action=${a} data-id=${r.id}>${{ submit: "Ajukan review", approve: "Sahkan", reject: "Tolak", activate: "Aktifkan", retire: "Retire", export: "Ekspor CSV tenant" }[a]}</button>`).join("")}</article>`,
        )
        .join("") ||
      "<p>Belum ada konfigurasi metode tenant. Tidak ada range default yang dianggap terverifikasi.</p>"
    }<nav><button id=ce-prev ${ceOffset === 0 ? "disabled" : ""}>Sebelumnya</button> Halaman ${1 + ceOffset / 50} <button id=ce-next ${board.rows.length <= 50 ? "disabled" : ""}>Berikutnya</button></nav><p>Terminologi LOINC mengacu <a href="https://loinc.org/license" target=_blank rel=noopener>lisensi Regenstrief</a>. Review metode/IFU tenant tetap diperlukan.</p></section>`;
    main.querySelector("#ce-new").onclick = () => ceForm("create");
    main.querySelector("#ce-reload").onclick = () => renderReviewedCatalog();
    main.querySelector("#ce-prev").onclick = () => {
      ceOffset = Math.max(0, ceOffset - 50);
      renderReviewedCatalog();
    };
    main.querySelector("#ce-next").onclick = () => {
      ceOffset += 50;
      renderReviewedCatalog();
    };
    main.querySelector("#ce-source-prev").onclick = () => {
      ceSourceOffset = Math.max(0, ceSourceOffset - 50);
      renderReviewedCatalog();
    };
    main.querySelector("#ce-source-next").onclick = () => {
      ceSourceOffset += 50;
      renderReviewedCatalog();
    };
    main.querySelector("#ce-search").onsubmit = (e) => {
      e.preventDefault();
      ceSearch = e.target.elements.search.value;
      ceSourceOffset = 0;
      renderReviewedCatalog();
    };
    main.querySelectorAll("[data-action]").forEach(
      (b) =>
        (b.onclick = () => {
          const row = board.rows.find((r) => r.id === Number(b.dataset.id));
          if (b.dataset.action === "export") ceExport(row);
          else ceForm(b.dataset.action, row);
        }),
    );
  } catch (e) {
    if (ceCurrent(scope, epoch))
      main.innerHTML =
        "<h1>Katalog belum dapat dibaca</h1><p role=alert>" +
        ceEsc(e.message) +
        "</p><button id=ce-retry>Coba lagi</button>";
    const retry = main.querySelector("#ce-retry");
    if (retry) retry.onclick = () => renderReviewedCatalog();
  }
}
function ceInput(label, name, type = "text", extra = "") {
  return `<label>${ceEsc(label)}<input name=${name} type=${type} ${extra} required></label>`;
}
function ceSelect(label, name, options) {
  return `<label>${ceEsc(label)}<select name=${name} required><option value="">Pilih</option>${options.map(([value, label]) => `<option value="${ceEsc(value)}">${ceEsc(label)}</option>`).join("")}</select></label>`;
}
function ceRange(form) {
  const box = document.createElement("div");
  box.className = "ce-range";
  const select = (label, name, options) =>
      ceSelect(label, "r_" + name, options),
    input = (label, name, type = "number", extra = "step=any") =>
      ceInput(label, "r_" + name, type, extra);
  box.innerHTML =
    input("Usia min", "age_min") +
    input("Usia max", "age_max") +
    select("Batas bawah usia inklusif", "age_lower_inclusive", [
      ["true", "Ya"],
      ["false", "Tidak"],
    ]) +
    select("Batas atas usia inklusif", "age_upper_inclusive", [
      ["true", "Ya"],
      ["false", "Tidak"],
    ]) +
    select("Jenis kelamin", "sex", [
      ["all", "Semua"],
      ["male", "Laki-laki"],
      ["female", "Perempuan"],
    ]) +
    input("Kondisi / kelompok acuan", "condition", "text", "") +
    select(
      "Operator kuantitatif",
      "operator",
      ["BETWEEN", "<", "<=", ">", ">=", "="].map((v) => [v, v]),
    ) +
    input("Batas bawah", "lower") +
    input("Batas atas", "upper") +
    "<label>Expected values kualitatif — satu per baris<textarea name=r_expected_values></textarea></label><button type=button class=ce-remove>Hapus kelompok</button>";
  box.querySelector(".ce-remove").onclick = () => box.remove();
  form.querySelector("#ce-ranges").append(box);
  box.querySelector("[name=r_operator]").onchange = () => ceRangeType(form);
  ceRangeType(form);
}
function ceRangeType(form) {
  const qualitative = form.elements.result_type.value === "qualitative";
  for (const box of form.querySelectorAll(".ce-range")) {
    const op = box.querySelector("[name=r_operator]");
    op.disabled = qualitative;
    op.required = !qualitative;
    for (const name of ["lower", "upper"]) {
      const el = box.querySelector(`[name=r_${name}]`),
        allowed =
          !qualitative &&
          (op.value === "BETWEEN" ||
            (name === "upper" && ["<", "<="].includes(op.value)) ||
            (name === "lower" && [">", ">=", "="].includes(op.value)));
      el.disabled = !allowed;
      el.required = allowed;
    }
    box.querySelector("[name=r_expected_values]").disabled = !qualitative;
    box.querySelector("[name=r_expected_values]").required = qualitative;
  }
  form.elements.ucum.required = !qualitative;
}
async function ceForm(action, row) {
  const scope = ceContext(),
    epoch = ceEpoch;
  if (ceScope !== scope) throw Error("Tenant/petugas berubah; muat ulang");
  const target = document.getElementById("ce-editor");
  let fields = "";
  if (action === "create") {
    fields =
      ceSelect(
        "Pemeriksaan → analit sumber",
        "item_id",
        ceSources.rows
          .slice(0, 50)
          .map((s) => [s.item_id, s.examination_name + " → " + s.analyte_name]),
      ) +
      ceInput("Kode analit sumber", "analyte_code", "text", "readonly") +
      ceInput("Versi katalog", "catalog_version") +
      ceInput("Metode ID", "method_id") +
      ceSelect("Jenis hasil", "result_type", [
        ["numeric", "Kuantitatif"],
        ["qualitative", "Kualitatif"],
      ]) +
      ceInput("LOINC", "loinc") +
      "<button type=button id=ce-lookup>Ambil definisi primer LOINC</button>" +
      ceInput("Nama primer LOINC", "primary_name", "text", "readonly") +
      ceInput(
        "URL sumber terminologi primer",
        "terminology_url",
        "url",
        "readonly",
      ) +
      ceInput("UCUM", "ucum") +
      ceInput("Specimen", "specimen") +
      ceInput("Metode pemeriksaan", "method") +
      ceInput("Alat / reagen / konfigurasi metode", "device_reagent") +
      ceInput("Bukti review mapping", "mapping_evidence") +
      ceInput("Bukti acuan / IFU rentang", "reference_evidence") +
      ceInput("Versi acuan", "source_version") +
      ceInput("Timezone fasilitas IANA", "timezone") +
      ceSelect("Unit usia untuk seluruh kelompok", "age_unit", [
        ["d", "Hari"],
        ["mo", "Bulan"],
        ["a", "Tahun"],
      ]) +
      ceInput(
        "Berlaku mulai — waktu browser " +
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        "valid_from",
        "datetime-local",
      ) +
      ceInput(
        "Berlaku sampai — waktu browser",
        "valid_until",
        "datetime-local",
      ) +
      "<div id=ce-ranges></div><button type=button id=ce-add-range>Tambah kelompok acuan</button>";
  }
  if (action === "approve")
    fields +=
      "<label><input type=checkbox name=mapping_reviewed required> Saya memeriksa analit, specimen, LOINC/UCUM dan sumber primer</label><label><input type=checkbox name=method_reviewed required> Saya memeriksa metode, alat/reagen dan IFU</label><label><input type=checkbox name=reference_reviewed required> Saya mengesahkan reference/expected values, demografi, versi dan masa berlaku</label>";
  target.innerHTML = `<form><h2>${ceEsc(action)} ${row ? "#" + row.id : ""}</h2>${fields}<label>Alasan / bukti<textarea name=reason required minlength=5></textarea></label><p id=ce-form-error role=alert></p><button type=submit>Simpan</button><button type=button id=ce-cancel>Tutup</button></form>`;
  const form = target.querySelector("form"),
    key = crypto.randomUUID();
  form.querySelector("#ce-cancel").onclick = () => target.replaceChildren();
  if (action === "create") {
    ceRange(form);
    form.querySelector("#ce-lookup").onclick = async () => {
      const code = form.elements.loinc.value;
      try {
        const term = await sbRpc("lis_catalog_primary_term", { p_code: code });
        if (
          form.isConnected &&
          ceCurrent(scope, epoch) &&
          form.elements.loinc.value === code
        ) {
          form.elements.primary_name.value = term.long_name;
          form.elements.terminology_url.value = term.canonical_url;
          form.querySelector("#ce-form-error").textContent = "";
        }
      } catch (e) {
        if (form.isConnected && ceCurrent(scope, epoch)) {
          form.elements.primary_name.value = "";
          form.elements.terminology_url.value = "";
          form.querySelector("#ce-form-error").textContent = e.message;
        }
      }
    };
    form.elements.loinc.oninput = () => {
      form.elements.primary_name.value = "";
      form.elements.terminology_url.value = "";
    };
    form.querySelector("#ce-add-range").onclick = () => ceRange(form);
    form.elements.result_type.onchange = () => ceRangeType(form);
    form.elements.item_id.onchange = async () => {
      const id = form.elements.item_id.value,
        s = ceSources.rows.find((s) => s.item_id === Number(id));
      form.elements.analyte_code.value = "";
      if (!s) return;
      const bytes = new TextEncoder().encode(
          JSON.stringify([
            s.source_snapshot.source_product_code,
            s.source_snapshot.item_code,
          ]),
        ),
        digest = await crypto.subtle.digest("SHA-256", bytes);
      if (
        form.isConnected &&
        ceCurrent(scope, epoch) &&
        form.elements.item_id.value === id
      )
        form.elements.analyte_code.value =
          "AN-" +
          Array.from(new Uint8Array(digest))
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 24)
            .toUpperCase();
    };
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = form.querySelector("[type=submit]");
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      if (!ceCurrent(scope, epoch))
        throw Error("Tenant/petugas atau halaman berubah; muat ulang");
      let data = { reason: form.elements.reason.value };
      if (row) {
        data.id = row.id;
        data.version = row.version;
      }
      if (action === "approve")
        for (const field of [
          "mapping_reviewed",
          "method_reviewed",
          "reference_reviewed",
        ])
          data[field] = form.elements[field].checked;
      if (action === "create") {
        const source = ceSources.rows.find(
          (s) => s.item_id === Number(form.elements.item_id.value),
        );
        data = {
          ...data,
          product_id: source.product_id,
          item_id: source.item_id,
          source_snapshot: source.source_snapshot,
          analyte_code: form.elements.analyte_code.value,
          catalog_version: form.elements.catalog_version.value,
          method_id: form.elements.method_id.value,
          valid_from: new Date(form.elements.valid_from.value).toISOString(),
          valid_until: new Date(form.elements.valid_until.value).toISOString(),
          definition: {},
        };
        for (const field of [
          "result_type",
          "loinc",
          "primary_name",
          "terminology_url",
          "ucum",
          "specimen",
          "method",
          "device_reagent",
          "mapping_evidence",
          "reference_evidence",
          "source_version",
          "timezone",
          "age_unit",
        ])
          data.definition[field] = form.elements[field].value;
        data.definition.ranges = Array.from(
          form.querySelectorAll(".ce-range"),
        ).map((box) => {
          const value = (name) => box.querySelector(`[name=r_${name}]`).value,
            boolean = (name) => {
              if (!["true", "false"].includes(value(name)))
                throw Error("Pilihan batas usia inklusif wajib");
              return value(name) === "true";
            },
            numeric = (name) => {
              if (!value(name).trim() || !Number.isFinite(Number(value(name))))
                throw Error("Nilai numerik wajib: " + name);
              return Number(value(name));
            },
            r = {
              age_min: numeric("age_min"),
              age_max: numeric("age_max"),
              age_lower_inclusive: boolean("age_lower_inclusive"),
              age_upper_inclusive: boolean("age_upper_inclusive"),
              sex: value("sex"),
              condition: value("condition"),
            };
          if (data.definition.result_type === "qualitative")
            r.expected_values = value("expected_values")
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean);
          else {
            r.operator = value("operator");
            r.lower = ["BETWEEN", ">", ">=", "="].includes(r.operator)
              ? numeric("lower")
              : null;
            r.upper = ["BETWEEN", "<", "<="].includes(r.operator)
              ? numeric("upper")
              : null;
          }
          return r;
        });
      }
      await sbRpc("lis_catalog_command", {
        p_action: action,
        p_data: data,
        p_key: key,
      });
      if (form.isConnected && ceCurrent(scope, epoch))
        await renderReviewedCatalog();
    } catch (e) {
      if (form.isConnected && ceCurrent(scope, epoch))
        form.querySelector("#ce-form-error").textContent = e.message;
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  };
  target.scrollIntoView({ block: "start" });
}
async function ceExport(row) {
  const scope = ceContext(),
    epoch = ceEpoch;
  try {
    if (!ceCurrent(scope, epoch))
      throw Error("Tenant/petugas berubah; muat ulang");
    const data = await sbRpc("lis_catalog_export", { p_id: row.id });
    if (!ceCurrent(scope, epoch)) return;
    if (!Array.isArray(data.rows) || !data.rows.length)
      throw Error("Server tidak mengonfirmasi ekspor sumber");
    const headers = Object.keys(data.rows[0]),
      quote = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"',
      csv =
        headers.map(quote).join(",") +
        "\n" +
        data.rows
          .map((r) =>
            headers
              .map((h) =>
                quote(
                  typeof r[h] === "object" && r[h] !== null
                    ? JSON.stringify(r[h])
                    : r[h],
                ),
              )
              .join(","),
          )
          .join("\n") +
        "\n",
      url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "catalog-tenant-method-" + row.id + ".csv";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    if (ceCurrent(scope, epoch))
      document.getElementById("ce-error").textContent = e.message;
  }
}
window.renderReviewedCatalog = renderReviewedCatalog;
window.renderCatalogExport = renderReviewedCatalog;
