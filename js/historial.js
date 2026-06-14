// ════════════════════════════════════════════
//  js/historial.js — Modal de historial y Tab 7 de guardias
//  Depende de globals: supaClient, state, SECTIONS, PERSONAL,
//                      showToast, saveStorage, renderList, goTab
// ════════════════════════════════════════════

// H-08: se eliminó el modal de historial antiguo (openHistorialModal,
// closeHistorialModal, filtrarHistorial, _historialData) — reemplazado por el Tab 7.

async function cargarInformeHistorial(id) {
  if (!supaClient) return;
  setNubeStatus("saving", "Cargando informe...");
  try {
    const { data, error } = await supaClient
      .from("informes").select("*").eq("id", id).single();
    if (error) throw error;
    cargarDesdeNube(data);
    showToast("✓ Informe cargado");
    setNubeStatus("online", "Conectado");
    renderDashboard();
  } catch(e) {
    showToast("❌ Error al cargar");
    setNubeStatus("error", "Error");
    console.error(e);
  }
}
// ════════════════════════════════════════════
//  AUTENTICACIÓN — Supabase Auth
//  Crear en Supabase Auth (Dashboard → Authentication → Users):
//    guardia@diprotran.internal  / villalba@diprotran.internal / cabral@diprotran.internal
// ════════════════════════════════════════════
let appInited        = false;
let currentUserRol   = "oficial";   // "oficial" | "jefe"
let currentUserEmail = "";

// ── Control de acceso por rol ─────────────────────────────────
// Roles disponibles en user_metadata de Supabase Auth:
//   "jefe"    → acceso completo (Admin, Historial, todo)
//   "oficial" → sin tab Admin (default si no se configura)


// ════════════════════════════════════════════
//  HISTORIAL TAB — Tab 7
// ════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  HISTORIAL TAB — Tab 7
// ════════════════════════════════════════════════════════════
let _histTabData     = [];
let _histTabFiltered = [];
let _histTabShown    = 0;
const HIST_PAGE_SIZE = 15;



async function renderHistorialTab() {
  const list  = document.getElementById("histTabList");
  const stats = document.getElementById("histTabStats");
  const more  = document.getElementById("histTabMore");
  const srch  = document.getElementById("histTabSearch");
  if (!list) return;
  cerrarDetalleHistorial();
  if (srch) srch.value = "";
  if (more) more.style.display = "none";
  if (stats) stats.textContent = "";

  if (!supaClient) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Sin conexión a la nube</div>';
    return;
  }
  list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px">Cargando...</div>';

  try {
    const { data, error } = await supaClient
      .from("informes")
      .select("id, fecha, oficial, ayudante, vehicles, extras, vacaciones, created_at")
      .order("fecha", { ascending: false })
      .limit(200);
    if (error) throw error;
    _histTabData     = data || [];
    _histTabFiltered = _histTabData;
    _histTabShown    = 0;
    if (stats) stats.textContent = `${_histTabData.length} guardias registradas`;
    _renderHistTabList();
  } catch(e) {
    console.error("renderHistorialTab:", e);
    list.innerHTML = '<div style="text-align:center;color:var(--no);padding:32px;font-size:13px">Error al cargar el historial</div>';
  }
}

function _renderHistTabList() {
  const list = document.getElementById("histTabList");
  const more = document.getElementById("histTabMore");
  if (!list) return;

  if (!_histTabFiltered.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px;font-size:13px">No hay guardias que coincidan</div>';
    if (more) more.style.display = "none";
    return;
  }

  const page = _histTabFiltered.slice(0, _histTabShown + HIST_PAGE_SIZE);
  _histTabShown = page.length;

  list.innerHTML = page.map(inf => {
    const parts    = (inf.fecha||"").split("-");
    const fechaStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : (inf.fecha||"Sin fecha");
    const vCount   = Object.keys(inf.vehicles||{}).length;
    const novCount = Object.values(inf.vehicles||{}).filter(v => v.obs?.trim() || v.fotoUrl).length;
    const vacCount = Object.keys(inf.vacaciones||{}).filter(k => (inf.vacaciones||{})[k]).length;
    return `<div class="hist-item" onclick="verDetalleHistorial('${inf.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div>
          <div class="hist-fecha">📄 ${fechaStr}</div>
          <div class="hist-meta">Oficial: ${escapeHTML(inf.oficial)||"—"} · Aydte: ${escapeHTML(inf.ayudante)||"—"}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          ${novCount ? `<div style="font-size:10px;font-weight:700;color:var(--ba-teal);margin-bottom:2px">⚠️ ${novCount} novel.</div>` : ""}
          <div style="font-size:10px;color:var(--muted)">${vCount} vehíc.</div>
          ${vacCount ? `<div style="font-size:10px;color:var(--muted)">${vacCount} vac.</div>` : ""}
        </div>
      </div>
    </div>`;
  }).join("");

  if (more) more.style.display = _histTabShown < _histTabFiltered.length ? "block" : "none";
}

function filtrarHistorialTab(query) {
  const q = (query||"").toLowerCase().trim();
  // Convertir búsqueda DD/MM/AAAA o DD/MM a formato compatible con AAAA-MM-DD
  let qFecha = q;
  const matchDMA = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (matchDMA) {
    const [, dd, mm, yyyy] = matchDMA;
    qFecha = yyyy ? `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}` : `-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }
  _histTabFiltered = _histTabData.filter(inf => {
    if (!q) return true;
    return (inf.fecha||"").includes(qFecha) ||
      (inf.oficial||"").toLowerCase().includes(q) ||
      (inf.ayudante||"").toLowerCase().includes(q);
  });
  _histTabShown = 0;
  _renderHistTabList();
  const stats = document.getElementById("histTabStats");
  if (stats) stats.textContent = q
    ? `${_histTabFiltered.length} de ${_histTabData.length} guardias`
    : `${_histTabData.length} guardias registradas`;
}

function histTabLoadMore() { _renderHistTabList(); }

async function verDetalleHistorial(id) {
  const panel   = document.getElementById("histDetail");
  const content = document.getElementById("histDetailContent");
  if (!panel || !content) return;

  content.innerHTML = '<div style="text-align:center;color:var(--muted);padding:32px">Cargando...</div>';
  panel.style.display = "block";
  panel.scrollTop = 0;

  let inf = _histTabData.find(x => x.id === id);
  if (!inf) {
    content.innerHTML = '<div style="text-align:center;color:var(--no);padding:32px">No se encontró el informe</div>';
    return;
  }

  const parts     = (inf.fecha||"").split("-");
  const fechaStr  = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : (inf.fecha||"Sin fecha");
  const vehicles  = inf.vehicles || {};
  const allKeys   = Object.keys(vehicles);
  const doneCount = allKeys.filter(k => vehicles[k]?._done).length;
  const novKeys   = allKeys.filter(k => vehicles[k]?.obs?.trim() || vehicles[k]?.fotoUrl);
  const vacMap    = inf.vacaciones || {};
  const vacKeys   = Object.keys(vacMap).filter(k => vacMap[k]);
  const extras    = inf.extras || [];

  const novHTML = novKeys.length ? `
    <div class="dash-section" style="margin-top:16px">Novedades</div>
    ${novKeys.map(k => {
      const vd = vehicles[k];
      let vInfo = null, secInfo = null;
      for (const sec of SECTIONS) {
        const v2 = sec.vehicles.find(v3 => sec.id + "_" + v3.ro === k);
        if (v2) { vInfo = v2; secInfo = sec; break; }
      }
      const ro    = k.split("_").slice(1).join("_");
      const sub   = vInfo ? (vInfo.modelo||vInfo.marca||"") : "";
      const secLb = secInfo ? secInfo.label : "";
      const fotoTag = vd.fotoUrl
        ? `<img src="${vd.fotoUrl}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer" onclick="verFotoNovedad('${vd.fotoUrl}')">`
        : "";
      return `<div style="padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:flex-start;gap:10px">
          ${fotoTag}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px">RO ${ro}${sub ? " — " + sub : ""} <span style="font-weight:400;color:var(--muted);font-size:11px">${secLb}</span></div>
            ${vd.obs?.trim() ? `<div style="font-size:12px;margin-top:3px;color:var(--text)">${escapeHTML(vd.obs)}</div>` : ""}
            ${vd.fotoUrl ? `<div style="font-size:10px;color:var(--ba-teal);font-weight:700;margin-top:3px">📷 Con foto</div>` : ""}
          </div>
        </div>
      </div>`;
    }).join("")}` : "";

  const vacHTML = vacKeys.length ? `
    <div class="dash-section" style="margin-top:16px">Vacaciones / Licencias</div>
    <div style="font-size:13px;color:var(--text);line-height:1.8">
      ${vacKeys.map(k => k.replace(/_/g," ")).join(" · ")}
    </div>` : "";

  const extHTML = extras.length ? `
    <div class="dash-section" style="margin-top:16px">Vehículos adicionales</div>
    ${extras.map(e => `<div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--border)">
      ${escapeHTML(e.ro)||""}${e.tipo ? " — " + escapeHTML(e.tipo) : ""}${e.obs ? ` <span style="color:var(--muted)">· ${escapeHTML(e.obs)}</span>` : ""}
    </div>`).join("")}` : "";

  content.innerHTML = `
    <div style="background:var(--white);border-radius:var(--r);border:1px solid var(--border);padding:14px;margin-bottom:12px;box-shadow:var(--shadow)">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:var(--blue1);margin-bottom:6px">📄 ${fechaStr}</div>
      <div style="font-size:13px;margin-bottom:3px"><b>Oficial de servicio:</b> ${escapeHTML(inf.oficial)||"—"}</div>
      <div style="font-size:13px"><b>Ayudante:</b> ${escapeHTML(inf.ayudante)||"—"}</div>
    </div>
    <div class="stat-grid-2" style="margin-bottom:4px">
      <div class="stat-card"><div class="s-val">${doneCount}<span style="font-size:14px;color:var(--muted)">/${allKeys.length}</span></div><div class="s-lbl">Vehículos revisados</div></div>
      <div class="stat-card"><div class="s-val" style="color:${novKeys.length ? "var(--ba-teal)" : "var(--ok)"}">${novKeys.length}</div><div class="s-lbl">Novedades</div></div>
    </div>
    ${novHTML}${vacHTML}${extHTML}
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border)">
      <button class="btn btn-gold" onclick="confirmarCargarHistorial('${inf.id}')" style="margin-bottom:6px">📥 Cargar esta guardia en la app</button>
      <div style="font-size:11px;color:var(--muted)">⚠️ Reemplaza los datos del turno actual</div>
      ${currentUserRol === "jefe" ? `
      <button class="btn btn-outline" onclick="eliminarInformeHistorial('${inf.id}')"
        style="margin-top:12px;color:var(--no);border-color:var(--no)">🗑 Eliminar este informe</button>
      <div style="font-size:11px;color:var(--muted)">Borra la guardia de la nube para todos los dispositivos. No se puede deshacer.</div>` : ""}
    </div>`;
}

// ── Eliminar un informe del historial (solo rol JEFE) ───────────────────────
async function eliminarInformeHistorial(id) {
  if (currentUserRol !== "jefe") { showToast("⛔ Solo un Jefe puede eliminar informes"); return; }
  if (!supaClient) { showToast("❌ Sin conexión a la nube"); return; }
  const inf = _histTabData.find(x => x.id === id);
  const parts = (inf?.fecha||"").split("-");
  const fechaStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : "esta guardia";
  if (!confirm(`¿Eliminar el informe del ${fechaStr} definitivamente?\nEsta acción no se puede deshacer.`)) return;
  try {
    const { error } = await supaClient.from("informes").delete().eq("id", id);
    if (error) throw error;
    _histTabData     = _histTabData.filter(x => x.id !== id);
    _histTabFiltered = _histTabFiltered.filter(x => x.id !== id);
    _histTabShown    = 0;
    cerrarDetalleHistorial();
    _renderHistTabList();
    const stats = document.getElementById("histTabStats");
    if (stats) stats.textContent = `${_histTabData.length} guardias registradas`;
    showToast("🗑 Informe eliminado");
  } catch(e) {
    console.error("eliminarInformeHistorial:", e);
    showToast("❌ No se pudo eliminar (verificar permisos en Supabase)");
  }
}

function cerrarDetalleHistorial() {
  const panel = document.getElementById("histDetail");
  if (panel) panel.style.display = "none";
}

function confirmarCargarHistorial(id) {
  if (!confirm("¿Cargar esta guardia? Se perderán los datos del turno actual.")) return;
  cerrarDetalleHistorial();
  cargarInformeHistorial(id);
}

