// ════════════════════════════════════════════
//  js/admin.js — Gestión de flota y personal (Tab 6 Admin)
//  Depende de globals: supaClient, SECTIONS, PERSONAL,
//                      state, showToast, renderList, renderPersonal
// ════════════════════════════════════════════

let _adminTab = "flota"; // "flota" | "personal"

function switchAdminTab(tab) {
  _adminTab = tab;
  document.getElementById("adminTabFlota")   .classList.toggle("active", tab === "flota");
  document.getElementById("adminTabPersonal").classList.toggle("active", tab === "personal");
  document.getElementById("adminPanelFlota")   .style.display = tab === "flota"    ? "" : "none";
  document.getElementById("adminPanelPersonal").style.display = tab === "personal" ? "" : "none";
  if (tab === "flota")    renderAdminFlota();
  if (tab === "personal") renderAdminPersonal("");
}

function renderAdminPersonal(filtro) {
  const list = document.getElementById("adminPersonalList");
  if (!list) return;
  const q = (filtro||"").toLowerCase().trim();
  const todos = [...PERSONAL_BASE, ...(state.personalExtra||[])].filter(ef =>
    !q ||
    ef.nombre.toLowerCase().includes(q) ||
    ef.jerarquia.toLowerCase().includes(q) ||
    (ef.legajo||"").includes(q)
  );
  if (!todos.length) {
    list.innerHTML = '<div class="admin-loading">No hay efectivos que coincidan</div>';
    return;
  }
  list.innerHTML = todos.map(ef => {
    const isBase  = !ef.id.startsWith("px_");
    const func    = getFuncionEfectiva(ef);
    const fLabel  = FUNCIONES.find(f=>f.id===func)?.label || func;
    const fColor  = ["vacaciones","licencia","lic_especial"].includes(func)
      ? "var(--warn)" : ["baja_med","desafect","inactividad"].includes(func)
      ? "var(--no)" : "var(--ok)";
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--blue1);font-family:var(--font-display)">${escapeHTML(ef.jerarquia)} ${escapeHTML(ef.nombre)}</div>
        <div style="font-size:11px;color:var(--muted)">Leg. ${escapeHTML(ef.legajo||"—")} ${isBase?"":"· <i>agregado</i>"}</div>
        <div style="font-size:11px;margin-top:1px"><span style="color:${fColor};font-weight:700">${escapeHTML(fLabel)}</span></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
        <button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 10px" onclick="openEditarEfAdmin('${escapeHTML(ef.id)}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm"  style="font-size:11px;padding:4px 10px" onclick="darDeBajaEfAdmin('${escapeHTML(ef.id)}')">🗑 Baja</button>
      </div>
    </div>`;
  }).join("");
}

function openEditarEfAdmin(efId) {
  // Igual que openEditarEfModal pero siempre muestra el botón de eliminar (contexto Admin)
  const ef = [...PERSONAL_BASE, ...(state.personalExtra||[])].find(p=>p.id===efId);
  if (!ef) return;
  editandoEfId = efId;
  document.getElementById("nuevoEfTitle").textContent    = "✏️ Editar Efectivo";
  document.getElementById("nuevoEfSaveBtn").textContent  = "Guardar cambios ✓";
  document.getElementById("eliminarEfBtn").style.display = "block"; // siempre visible desde Admin
  document.getElementById("nuevoEfBody").innerHTML       = buildNuevoEfForm(ef);
  document.getElementById("nuevoEfModal").classList.add("open");
}

async function darDeBajaEfAdmin(efId) {
  const ef = [...PERSONAL_BASE, ...(state.personalExtra||[])].find(p=>p.id===efId);
  if (!ef) return;
  if (!confirm(`¿Dar de baja a ${ef.jerarquia} ${ef.nombre}?\nSe eliminará del sistema para todos los dispositivos.`)) return;

  // Marcar como inactivo en Supabase
  if (supaClient) {
    try {
      const { error } = await supaClient
        .from("personal")
        .update({ activo: false })
        .eq("id", efId);
      if (error) throw error;
    } catch(e) {
      console.warn("darDeBajaEfAdmin:", e);
      showToast("⚠️ No se pudo sincronizar la baja con la nube");
    }
  }

  // Remover de PERSONAL_BASE y personalExtra localmente
  const idx = PERSONAL_BASE.findIndex(p => p.id === efId);
  if (idx >= 0) PERSONAL_BASE.splice(idx, 1);
  state.personalExtra = (state.personalExtra||[]).filter(p => p.id !== efId);
  delete state.personal[efId];
  saveStorage();

  // Refrescar ambas vistas
  renderAdminPersonal(document.getElementById("adminPersonalSearch")?.value || "");
  renderPersonal(document.getElementById("searchPersonal")?.value || "");
  showToast(`✓ ${ef.nombre.split(" ")[0]} dado de baja`);
}

function renderAdminFlota() {
  const list = document.getElementById("adminFlotaList");
  if (!list) return;
  if (!SECTIONS.length) {
    list.innerHTML = `<div class="admin-loading">Sin datos de flota</div>`;
    return;
  }
  list.innerHTML = SECTIONS.map(sec => {
    const activos = sec.vehicles.filter(v => !v._extra);
    const vHtml = activos.length
      ? activos.map(v => {
          const sub = [v.modelo, v.marca, v.dominio].filter(Boolean).join(" · ");
          const isNoId = sec.type === "no_ident";
          const label  = `${isNoId ? "Dom." : "RO"} ${escapeHTML(v.ro)}`;
          return `<div class="admin-v-row">
            <div>
              <div class="admin-v-ro">${label}</div>
              ${sub ? `<div class="admin-v-sub">${escapeHTML(sub)}</div>` : ""}
            </div>
            <button class="btn-del-v" onclick="eliminarVehiculoAdmin('${escapeHTML(sec.id)}','${escapeHTML(v.ro)}',${v._dbId||"null"})">Dar de baja</button>
          </div>`;
        }).join("")
      : `<div style="padding:10px 14px;font-size:12px;color:var(--muted)">Sin vehículos en esta sección</div>`;

    return `<div class="admin-sec-card">
      <div class="admin-sec-hdr" onclick="toggleAdminSec('${escapeHTML(sec.id)}')">
        <div>
          <div class="admin-sec-name">${escapeHTML(sec.label)}</div>
          <div class="admin-sec-meta">${activos.length} unidad${activos.length!==1?"es":""} · tipo: ${escapeHTML(sec.type)}</div>
        </div>
        <span style="color:var(--muted);font-size:18px">›</span>
      </div>
      <div class="admin-sec-body" id="adminSec_${escapeHTML(sec.id)}">
        ${vHtml}
        <div class="admin-add-v">
          <div style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Agregar vehículo</div>
          <div class="admin-add-v-grid">
            <div>
              <label class="lbl" style="margin-top:0">RO / Dominio</label>
              <input type="text" id="newVRo_${escapeHTML(sec.id)}" placeholder="28999">
            </div>
            <div>
              <label class="lbl" style="margin-top:0">Modelo</label>
              <input type="text" id="newVModelo_${escapeHTML(sec.id)}" placeholder="Opcional">
            </div>
            <div>
              <label class="lbl" style="margin-top:0">Marca</label>
              <input type="text" id="newVMarca_${escapeHTML(sec.id)}" placeholder="Opcional">
            </div>
            <div>
              <label class="lbl" style="margin-top:0">Dominio</label>
              <input type="text" id="newVDominio_${escapeHTML(sec.id)}" placeholder="Opcional">
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="guardarNuevoVehiculo('${escapeHTML(sec.id)}')">Agregar</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

function toggleAdminSec(secId) {
  const body = document.getElementById("adminSec_" + secId);
  if (body) body.classList.toggle("open");
}

async function guardarNuevoVehiculo(secId) {
  const ro     = (document.getElementById(`newVRo_${secId}`)?.value||"").trim().toUpperCase();
  const modelo = (document.getElementById(`newVModelo_${secId}`)?.value||"").trim();
  const marca  = (document.getElementById(`newVMarca_${secId}`)?.value||"").trim();
  const dominio= (document.getElementById(`newVDominio_${secId}`)?.value||"").trim();
  if (!ro) { alert("El campo RO / Dominio es obligatorio."); return; }

  const sec = SECTIONS.find(s => s.id === secId);
  if (!sec) return;
  if (sec.vehicles.find(v => v.ro === ro)) { alert(`Ya existe un vehículo con RO ${ro} en esta sección.`); return; }

  const newV = { ro, ...(marca?{marca}:{}), ...(modelo?{modelo}:{}), ...(dominio?{dominio}:{}) };

  if (supaClient) {
    try {
      const { data, error } = await supaClient
        .from("vehiculos")
        .insert({ seccion_id: secId, ro, marca, modelo, dominio, activo: true, ord: sec.vehicles.length + 1 })
        .select()
        .single();
      if (error) throw error;
      if (data) newV._dbId = data.id;
      showToast(`✅ ${ro} agregado a ${sec.label}`);
    } catch(e) {
      showToast("⚠️ Error al guardar en nube — el vehículo se agregó localmente");
      console.warn("guardarNuevoVehiculo:", e);
    }
  }

  sec.vehicles.push(newV);
  // Limpiar inputs
  ["Ro","Modelo","Marca","Dominio"].forEach(f => {
    const el = document.getElementById(`newV${f}_${secId}`);
    if (el) el.value = "";
  });
  renderAdminFlota();
  // Abrir la sección para ver el resultado
  const body = document.getElementById("adminSec_" + secId);
  if (body) body.classList.add("open");
  // Actualizar la barra de progreso y selectores si corresponde
  updateProgress();
  updateSummary();
}

async function eliminarVehiculoAdmin(secId, ro, dbId) {
  const sec = SECTIONS.find(s => s.id === secId);
  if (!sec) return;
  const isNoId = sec.type === "no_ident";
  const label  = `${isNoId ? "Dom." : "RO"} ${ro}`;
  if (!confirm(`¿Dar de baja definitiva "${label}" de la flota?\n\nEsto lo elimina del sistema para todos los turnos futuros.\nPara baja temporal de un turno, usá el botón "Baja" desde el móvil.`)) return;

  if (supaClient && dbId) {
    try {
      const { error } = await supaClient
        .from("vehiculos")
        .update({ activo: false })
        .eq("id", dbId);
      if (error) throw error;
    } catch(e) {
      showToast("⚠️ Error al actualizar en nube");
      console.warn("eliminarVehiculoAdmin:", e);
      return;
    }
  }

  sec.vehicles = sec.vehicles.filter(v => v.ro !== ro);
  // También limpiar de eliminados locales si estaba
  const key = `${secId}_${ro}`;
  state.eliminados = (state.eliminados||[]).filter(k => k !== key);
  saveEliminados();
  renderAdminFlota();
  buildSecNav();
  renderList(activeSec);
  updateProgress();
  updateSummary();
  showToast(`🚫 ${label} dado de baja definitiva`);
}

async function guardarNuevaSeccion() {
  const id    = (document.getElementById("newSecId")?.value||"").trim().replace(/\s+/g,"");
  const label = (document.getElementById("newSecLabel")?.value||"").trim();
  const type  = document.getElementById("newSecType")?.value || "movil_std";
  if (!id || !label) { alert("ID y Nombre son obligatorios."); return; }
  if (SECTIONS.find(s => s.id === id)) { alert(`Ya existe una sección con ID "${id}".`); return; }

  if (supaClient) {
    try {
      const { error } = await supaClient
        .from("secciones")
        .insert({ id, label, type, ord: SECTIONS.length + 1 });
      if (error) throw error;
    } catch(e) {
      showToast("⚠️ Error al crear sección en nube");
      console.warn("guardarNuevaSeccion:", e);
      return;
    }
  }

  SECTIONS.push({ id, label, type, vehicles: [] });
  document.getElementById("newSecId").value    = "";
  document.getElementById("newSecLabel").value = "";
  renderAdminFlota();
  buildSecNav();
  showToast(`✅ Sección "${label}" creada`);
}

