// ════════════════════════════════════════════
//  js/personal.js — Gestión de personal, calendario y Tab 5
//  Depende de globals: supaClient, PERSONAL, state,
//                      showToast, saveStorage, JERARQUIAS, FUNCIONES
// ════════════════════════════════════════════

// ════════════════════════════════════════════
//  AGREGAR / EDITAR / ELIMINAR EFECTIVO
// ════════════════════════════════════════════

// Lista de jerarquías ordenada para el select
// Ley 13982, Art. 29 + escalafones completos de la PBA
// Subescalafones según Ley 13982, Art. 27 y Decreto 1050/09
// No existe un "escalafón principal" — el personal se agrupa en subescalafones
const ESCALAFONES = [
  { abrev:"CDO.",  label:"Comando" },
  { abrev:"E.G.",  label:"General" },
  { abrev:"S.G.",  label:"Servicios Generales" },
  { abrev:"TEC.",  label:"Técnico" },
  { abrev:"ADM.",  label:"Administrativo" },
  { abrev:"PROF.", label:"Profesional" },
  { abrev:"COM.",  label:"Comunicaciones" },
];

const JERARQUIAS_LIST = [
  // ── Subescalafón Comando (CDO.) — Art. 29 inc. a) ──
  // Oficiales de Conducción
  { abrev:"CRIO GRAL",  label:"Comisario General",    esc:"CDO.", categoria:"Oficial de Conducción" },
  { abrev:"CRIO MAYOR", label:"Comisario Mayor",       esc:"CDO.", categoria:"Oficial de Conducción" },
  // Oficial de Supervisión
  { abrev:"CRIO INSP",  label:"Comisario Inspector",   esc:"CDO.", categoria:"Oficial de Supervisión" },
  // Oficiales Jefes
  { abrev:"CRIO",       label:"Comisario",             esc:"CDO.", categoria:"Oficial Jefe" },
  { abrev:"SUBCRIO",    label:"Subcomisario",          esc:"CDO.", categoria:"Oficial Jefe" },
  // Oficiales Subalternos CDO.
  { abrev:"OF PPAL",    label:"Oficial Principal",     esc:"CDO.", categoria:"Oficial Subalterno" },
  { abrev:"OI",         label:"Oficial Inspector",     esc:"CDO.", categoria:"Oficial Subalterno" },
  { abrev:"OSI",        label:"Oficial Subinspector",  esc:"CDO.", categoria:"Oficial Subalterno" },
  { abrev:"OA",         label:"Oficial Ayudante",      esc:"CDO.", categoria:"Oficial Subalterno" },
  { abrev:"OSA",        label:"Oficial Subayudante",   esc:"CDO.", categoria:"Oficial Subalterno" },
  // ── Subescalafón General (E.G.) — Art. 29 inc. b) ──
  // Oficiales Superiores
  { abrev:"MYR",        label:"Mayor",                 esc:"E.G.", categoria:"Oficial Superior" },
  { abrev:"CAP",        label:"Capitán",               esc:"E.G.", categoria:"Oficial Superior" },
  { abrev:"TTE 1°",     label:"Teniente 1°",           esc:"E.G.", categoria:"Oficial Superior" },
  // Oficiales Subalternos E.G.
  { abrev:"TTE",        label:"Teniente",              esc:"E.G.", categoria:"Oficial Subalterno" },
  { abrev:"SUBTE",      label:"Subteniente",           esc:"E.G.", categoria:"Oficial Subalterno" },
  { abrev:"SGTO",       label:"Sargento",              esc:"E.G.", categoria:"Oficial Subalterno" },
  { abrev:"OFL",        label:"Oficial",               esc:"E.G.", categoria:"Oficial Subalterno" },
];

let editandoEfId = null; // null = nuevo, string = editando existente

function onEscalafonChange(sel) {
  // campo único — nada que sincronizar, el valor ya queda en nef_escalafon
}

function actualizarEscalafon(sel) {
  const opt = sel.options[sel.selectedIndex];
  const esc = opt.dataset.esc || "";
  const sub = opt.dataset.sub || "";
  const escEl = document.getElementById("nef_escalafon");
  const subEl = document.getElementById("nef_subescalafon");
  if (escEl) escEl.value = esc;
  if (subEl) subEl.value = sub;
}

function buildNuevoEfForm(datos) {
  // datos: objeto con valores previos (para edición) o vacío (para nuevo)
  const d = datos || {};
  // Agrupar por escalafón para el select (Ley 13982 Art. 27 y 29)
  let lastEsc = null;
  const jerOptions = JERARQUIAS_LIST.map(j => {
    let optgroup = "";
    if (j.esc !== lastEsc) {
      const escLabel = j.esc === "CDO." ? "Subescalafón Comando (CDO.)" : "Subescalafón General (E.G.)";
      optgroup = `</optgroup><optgroup label="── ${escLabel} ──" disabled style="color:var(--blue1);font-weight:700">`;
      lastEsc = j.esc;
    }
    return `${optgroup}<option value="${j.abrev}" ${d.jerarquia===j.abrev?"selected":""}>${j.abrev} — ${j.label} · ${j.categoria}</option>`;
  }).join("");

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">

      <div style="grid-column:1/-1">
        <label class="lbl" style="margin-top:0">Apellido y Nombre *</label>
        <input type="text" id="nef_nombre" placeholder="Ej: García Juan Pablo" value="${d.nombre||""}">
      </div>

      <div style="grid-column:1/-1">
        <label class="lbl">Jerarquía * <span style="font-size:10px;color:var(--muted);font-weight:400">Ley 13982, Art. 29</span></label>
        <select id="nef_jerarquia" onchange="actualizarEscalafon(this)">
          <option value="">— Seleccionar jerarquía —</option>
          <optgroup label="── Subescalafón Comando (CDO.) ──">
            ${JERARQUIAS_LIST.filter(j=>j.esc==="CDO.").map(j=>
              `<option value="${j.abrev}" data-esc="CDO." data-sub="Comando" ${d.jerarquia===j.abrev?"selected":""}>${j.abrev} — ${j.label}</option>`
            ).join("")}
          </optgroup>
          <optgroup label="── Subescalafón General (E.G.) ──">
            ${JERARQUIAS_LIST.filter(j=>j.esc==="E.G.").map(j=>
              `<option value="${j.abrev}" data-esc="E.G." data-sub="General" ${d.jerarquia===j.abrev?"selected":""}>${j.abrev} — ${j.label}</option>`
            ).join("")}
          </optgroup>
        </select>
      </div>
      <div style="grid-column:1/-1">
        <label class="lbl">Subescalafón (Ley 13982, Art. 27)</label>
        <select id="nef_escalafon" onchange="onEscalafonChange(this)">
          ${ESCALAFONES.map(e=>`<option value="${e.abrev}"
            ${(d.escalafon===e.abrev||d.subescalafon===e.label||d.subescalafon===e.abrev)?"selected":""}
          >${e.abrev} — Sub. ${e.label}</option>`).join("")}
        </select>
      </div>

      <div>
        <label class="lbl">Legajo *</label>
        <input type="text" id="nef_legajo" placeholder="Ej: 430.000" value="${d.legajo||""}">
      </div>

      <div>
        <label class="lbl">Destino</label>
        <input type="text" id="nef_destino" placeholder="Direc. Transp." value="${d.destino||"Direc. Transp."}">
      </div>

      <div style="grid-column:1/-1">
        <label class="lbl">Calle y Número</label>
        <input type="text" id="nef_calle" placeholder="Ej: Av. San Martín 1234" value="${d.calle||d.domicilio||""}">
      </div>

      <div>
        <label class="lbl">Localidad</label>
        <input type="text" id="nef_localidad" placeholder="Ej: Garín" value="${d.localidad||""}">
      </div>

      <div>
        <label class="lbl">Partido</label>
        <input type="text" id="nef_partido" placeholder="Ej: Escobar" value="${d.partido||""}">
      </div>

      <div>
        <label class="lbl">Fecha de nacimiento</label>
        <input type="text" id="nef_fechaNac" placeholder="DD/MM/AAAA" value="${d.fechaNac||""}">
      </div>

      <div>
        <label class="lbl">Fecha de ingreso a la institución</label>
        <input type="text" id="nef_fechaIngreso" placeholder="DD/MM/AAAA" value="${d.fechaIngreso||""}">
      </div>

      <div>
        <div style="display:flex;gap:8px">
          <div style="flex:1">
            <label class="lbl" style="margin-top:0">Grupo sanguíneo</label>
            <select id="nef_grupoSanguineo">
              <option value="—">— Grupo —</option>
              ${["A","B","AB","0"].map(g=>`<option value="${g}" ${(d.grupoSanguineo||"").startsWith(g+" ")||(d.grupoSanguineo||"")===(g)?"selected":""}>${g}</option>`).join("")}
            </select>
          </div>
          <div style="flex:1">
            <label class="lbl" style="margin-top:0">Factor RH</label>
            <select id="nef_factorRh">
              <option value="—">— RH —</option>
              <option value="+" ${(d.factorRh||"")==="+"||/\+/.test(d.grupoSanguineo||"")?"selected":""}>Positivo (+)</option>
              <option value="-" ${(d.factorRh||"")==="−"||(d.factorRh||"")==="−"||(d.grupoSanguineo||"").includes("-")?"selected":""}>Negativo (−)</option>
            </select>
          </div>
        </div>
      </div>



      <div>
        <label class="lbl">Situación de Revista (Ley 13982, Art. 13)</label>
        <select id="nef_situacionRevista">
          <option value="servicio_activo" ${(d.situacionRevista||"servicio_activo")==="servicio_activo"?"selected":""}>Servicio Activo</option>
          <option value="disponibilidad"  ${d.situacionRevista==="disponibilidad"?"selected":""}>Disponibilidad</option>
          <option value="desafectacion"   ${d.situacionRevista==="desafectacion"?"selected":""}>Desafectación</option>
          <option value="inactividad"     ${d.situacionRevista==="inactividad"?"selected":""}>Inactividad</option>
          <option value="act_limitada"    ${d.situacionRevista==="act_limitada"?"selected":""}>Actividad Limitada</option>
          <option value="retiro"          ${d.situacionRevista==="retiro"?"selected":""}>Retiro</option>
        </select>
      </div>

      <div style="grid-column:1/-1">
        <label class="lbl">Vacaciones — fecha hasta</label>
        <input type="date" id="nef_vacHasta" value="${d.vacHasta||""}">
        <div style="font-size:10px;color:var(--muted);margin-top:3px">Completar solo si está de vacaciones. Se refleja en el calendario.</div>
      </div>

      <div>
        <label class="lbl">Celular</label>
        <input type="text" id="nef_cel" placeholder="11-0000-0000" value="${d.cel||""}">
      </div>

      <div>
        <label class="lbl">Email</label>
        <input type="text" id="nef_email" placeholder="correo@ejemplo.com" value="${d.email||""}">
      </div>

      <div style="grid-column:1/-1">
        <label class="lbl">Licencia Habilitante</label>
        <input type="text" id="nef_licHab" placeholder="Ej: A1, B1, C1, D3" value="${d.licHab||""}">
      </div>

      <div>
        <label class="lbl">Armamento</label>
        <input type="text" id="nef_armamento" placeholder="Ej: Bersa 13-F00000" value="${d.armamento||""}">
      </div>

      <div>
        <label class="lbl">N° Chaleco</label>
        <input type="text" id="nef_chaleco" placeholder="Número" value="${d.chaleco||""}">
      </div>

      <div style="grid-column:1/-1">
        <label class="lbl">Cría / Jurisdicción</label>
        <input type="text" id="nef_criaJurisd" placeholder="Ej: Cría 1 · Monte Grande" value="${d.criaJurisd||""}">
      </div>

    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">* Campos obligatorios</div>`;
}

function openNuevoEfModal() {
  editandoEfId = null;
  document.getElementById("nuevoEfTitle").textContent = "➕ Nuevo Efectivo";
  document.getElementById("nuevoEfSaveBtn").textContent = "Agregar efectivo ✓";
  document.getElementById("eliminarEfBtn").style.display = "none";
  document.getElementById("nuevoEfBody").innerHTML = buildNuevoEfForm(null);
  document.getElementById("nuevoEfModal").classList.add("open");
}

function openEditarEfModal(efId) {
  const ef = [...PERSONAL_BASE, ...(state.personalExtra||[])].find(p=>p.id===efId);
  if (!ef) return;
  editandoEfId = efId;
  document.getElementById("nuevoEfTitle").textContent = "✏️ Editar Efectivo";
  document.getElementById("nuevoEfSaveBtn").textContent = "Guardar cambios ✓";
  // Mostrar botón eliminar solo para extras (no para la lista base)
  const esExtra = !!(state.personalExtra||[]).find(p=>p.id===efId);
  document.getElementById("eliminarEfBtn").style.display = esExtra ? "block" : "none";
  document.getElementById("nuevoEfBody").innerHTML = buildNuevoEfForm(ef);
  document.getElementById("nuevoEfModal").classList.add("open");
}

function closeNuevoEfModal() {
  document.getElementById("nuevoEfModal").classList.remove("open");
  editandoEfId = null;
}

function saveNuevoEfectivo() {
  const nombre    = document.getElementById("nef_nombre")?.value.trim();
  const jerarquia = document.getElementById("nef_jerarquia")?.value;
  const legajo    = document.getElementById("nef_legajo")?.value.trim();

  if (!nombre || !jerarquia || !legajo) {
    alert("Completá al menos Nombre, Jerarquía y Legajo.");
    return;
  }

  const jerInfo   = JERARQUIAS_LIST.find(j=>j.abrev===jerarquia);
  const escalafon = jerInfo?.esc || "E.G.";

  const efData = {
    nombre,
    jerarquia,
    escalafon,
    escalafon:    document.getElementById("nef_escalafon")?.value || "",
    subescalafon: (() => {
      const abrev = document.getElementById("nef_escalafon")?.value || "";
      return ESCALAFONES.find(e=>e.abrev===abrev)?.label || abrev;
    })(),
    legajo,
    destino:          document.getElementById("nef_destino")?.value.trim()          || "Direc. Transp.",
    calle:            document.getElementById("nef_calle")?.value.trim()            || "—",
    localidad:        document.getElementById("nef_localidad")?.value.trim()        || "—",
    partido:          document.getElementById("nef_partido")?.value.trim()          || "—",
    fechaNac:         document.getElementById("nef_fechaNac")?.value.trim()         || "—",
    fechaIngreso:     document.getElementById("nef_fechaIngreso")?.value.trim()     || "—",
    grupoSanguineo:   (() => {
      const g = document.getElementById("nef_grupoSanguineo")?.value || "—";
      const r = document.getElementById("nef_factorRh")?.value || "—";
      return (g !== "—" && r !== "—") ? `${g} ${r}` : (g !== "—" ? g : "—");
    })(),
    factorRh: document.getElementById("nef_factorRh")?.value || "—",
    subescalafon: (() => {
      const abrev = document.getElementById("nef_escalafon")?.value || "";
      return ESCALAFONES.find(e=>e.abrev===abrev)?.label || abrev || "General";
    })(),
    situacionRevista: document.getElementById("nef_situacionRevista")?.value        || "servicio_activo",
    vacHasta:         document.getElementById("nef_vacHasta")?.value                || "",
    cel:              document.getElementById("nef_cel")?.value.trim()              || "—",
    email:            document.getElementById("nef_email")?.value.trim()            || "—",
    licHab:           document.getElementById("nef_licHab")?.value.trim()           || "—",
    armamento:        document.getElementById("nef_armamento")?.value.trim()        || "—",
    chaleco:          document.getElementById("nef_chaleco")?.value.trim()          || "—",
    criaJurisd:       document.getElementById("nef_criaJurisd")?.value.trim()       || "—",
    nota:             "",
    funcion_base: "guardia",
  };

  if (editandoEfId) {
    // Editar existente
    const idxBase  = PERSONAL_BASE.findIndex(p=>p.id===editandoEfId);
    const idxExtra = (state.personalExtra||[]).findIndex(p=>p.id===editandoEfId);
    const updated  = { ...efData, id: editandoEfId, ord: idxBase>=0 ? PERSONAL_BASE[idxBase].ord : 99,
                       funcion_fija: idxBase>=0 ? PERSONAL_BASE[idxBase].funcion_fija : false };
    if (idxBase >= 0)  PERSONAL_BASE[idxBase] = updated;
    if (idxExtra >= 0) state.personalExtra[idxExtra] = updated;
    showToast("✓ Efectivo actualizado");
  } else {
    // Nuevo
    const newId = "px_" + Date.now();
    const newEf = { ...efData, id: newId, ord: 99 };
    if (!state.personalExtra) state.personalExtra = [];
    state.personalExtra.push(newEf);
    PERSONAL_BASE.push(newEf);
    showToast("✓ Efectivo agregado");
  }

  saveStorage();
  sincronizarPersonal();
  closeNuevoEfModal();
  renderPersonal(document.getElementById("searchPersonal")?.value||"");
  // Refrescar panel Admin si está visible
  if (document.getElementById("adminPersonalList")) {
    renderAdminPersonal(document.getElementById("adminPersonalSearch")?.value||"");
  }
}

function eliminarEfectivo() {
  if (!editandoEfId) return;
  if (!confirm("¿Eliminar este efectivo del sistema? Esta acción no se puede deshacer.")) return;
  // Quitar de personalExtra
  state.personalExtra = (state.personalExtra||[]).filter(p=>p.id!==editandoEfId);
  // Quitar de PERSONAL_BASE (solo si es extra)
  const idx = PERSONAL_BASE.findIndex(p=>p.id===editandoEfId);
  if (idx >= 0 && PERSONAL_BASE[idx].id.startsWith("px_")) PERSONAL_BASE.splice(idx,1);
  // Quitar datos de estado
  delete state.personal[editandoEfId];
  saveStorage();
  closeNuevoEfModal();
  renderPersonal(document.getElementById("searchPersonal")?.value||"");
  if (document.getElementById("adminPersonalList")) {
    renderAdminPersonal(document.getElementById("adminPersonalSearch")?.value||"");
  }
  showToast("🗑 Efectivo eliminado");
}

function getPersonalStats() {
  const stats = { guardia:0, franco:0, servicio:0, otros:0 };
  const OPERATIVO_SET = new Set(["of_servicio","ayudante","enc_tercio","chofer"]);
  const OTROS_SET     = new Set(["vacaciones","licencia","lic_especial","baja_med","desafect","inactividad","act_limit"]);
  PERSONAL_BASE.forEach(ef => {
    const f = getFuncionEfectiva(ef);
    if      (OPERATIVO_SET.has(f)) stats.guardia++;  // Roles operativos activos
    else if (f === "franco")       stats.franco++;   // Franco de servicio
    else if (f === "disponib")     stats.servicio++; // Disponibilidad / Serv. especial
    else if (OTROS_SET.has(f))     stats.otros++;    // Lic / Vac / Baja / RMH
  });
  return stats;
}

// ════════════════════════════════════════════
//  PERSONAL
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  CALENDARIO DE VACACIONES
// ════════════════════════════════════════════

// Colores por efectivo
const VAC_COLORS = [
  "#003580","#0050b3","#00aec3","#0d6e2f",
  "#92400e","#b91c1c","#7c3aed","#b45309",
  "#0e7490","#166534","#991b1b","#5b21b6",
];

function getVacColor(efId) {
  const idx = PERSONAL_BASE.findIndex(p=>p.id===efId);
  return VAC_COLORS[idx % VAC_COLORS.length] || "#64748b";
}

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based

function toggleCalendario() {
  const wrap  = document.getElementById("calendarioWrap");
  const arrow = document.getElementById("calArrow");
  const open  = wrap.style.display === "none";
  wrap.style.display = open ? "block" : "none";
  arrow.textContent  = open ? "▾" : "▸";
  if (open) renderCalendario();
}

function renderCalendario() {
  const wrap = document.getElementById("calendarioWrap");
  if (!wrap || wrap.style.display === "none") return;

  const hoy          = new Date();
  const hoyStr       = hoy.toISOString().split("T")[0];
  const año          = calYear;
  const mes          = calMonth;
  const primerDia    = new Date(año, mes, 1);
  const ultimoDia    = new Date(año, mes+1, 0);
  const diasEnMes    = ultimoDia.getDate();
  const iniciaSemana = primerDia.getDay(); // 0=Dom

  // Construir mapa de vacaciones: "YYYY-MM-DD" → [efId, ...]
  const vacMap = {};
  PERSONAL_BASE.forEach(ef => {
    const d     = state.personal[ef.id] || {};
    const hasta = d.vacHasta || ef.vacHasta || "";
    if (!hasta) return;
    // Buscar fecha desde: la más temprana entre hoy y fecha del informe
    // para mostrar todo el período aunque sea de días pasados del mes
    const desde = `${año}-${String(mes+1).padStart(2,"0")}-01`;
    if (hasta < desde) return;
    const fin = new Date(hasta + "T00:00:00");
    // Iterar todos los días del mes
    for (let d2 = 1; d2 <= diasEnMes; d2++) {
      const key = `${año}-${String(mes+1).padStart(2,"0")}-${String(d2).padStart(2,"0")}`;
      if (key > hasta) break;
      if (!vacMap[key]) vacMap[key] = [];
      vacMap[key].push(ef.id);
    }
  });

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dias  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  let html = `<div class="cal-wrap">
    <div class="cal-header">
      <button class="cal-nav" onclick="calNavegar(-1)">‹</button>
      <div class="cal-title">${meses[mes]} ${año}</div>
      <button class="cal-nav" onclick="calNavegar(1)">›</button>
    </div>
    <div class="cal-grid">
      ${dias.map(d=>`<div class="cal-dow">${d}</div>`).join("")}`;

  // Celdas vacías al inicio
  for (let i = 0; i < iniciaSemana; i++) {
    html += `<div class="cal-day otro-mes"></div>`;
  }

  // Días del mes
  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fechaKey = `${año}-${String(mes+1).padStart(2,"0")}-${String(dia).padStart(2,"0")}`;
    const esHoy    = fechaKey === hoyStr;
    const vacsHoy  = vacMap[fechaKey] || [];

    // Cada efectivo de vacaciones → una franja de color con iniciales
    const franjas = vacsHoy.map(efId => {
      const ef    = PERSONAL_BASE.find(p=>p.id===efId);
      const color = getVacColor(efId);
      // Iniciales: primera letra del apellido
      const iniciales = ef ? ef.nombre.split(" ")[0].charAt(0) + ef.nombre.split(" ")[1]?.charAt(0) || "" : "?";
      return `<div style="background:${color};color:#fff;font-size:8px;font-weight:800;
        border-radius:2px;padding:0 2px;line-height:11px;letter-spacing:.3px;
        font-family:'Encode Sans',sans-serif;overflow:hidden;white-space:nowrap">${iniciales}</div>`;
    }).join("");

    const borderHoy = esHoy ? "border:2px solid var(--ba-teal);box-sizing:border-box;" : "";
    const bgHoy     = esHoy && vacsHoy.length === 0 ? "background:var(--ba-teal4);" : "";
    const numColor  = esHoy ? "color:var(--blue1);font-weight:900;" : vacsHoy.length > 0 ? "color:var(--text);" : "";

    html += `<div class="cal-day" style="${borderHoy}${bgHoy}">
      <div style="font-size:11px;${numColor}">${dia}</div>
      <div style="display:flex;flex-direction:column;gap:1px;margin-top:2px">${franjas}</div>
    </div>`;
  }

  // Celdas vacías al final
  const celdas = iniciaSemana + diasEnMes;
  const resto  = celdas % 7 === 0 ? 0 : 7 - (celdas % 7);
  for (let i = 0; i < resto; i++) html += `<div class="cal-day otro-mes"></div>`;

  html += `</div>`; // fin cal-grid

  // Leyenda: todos los que tienen vacaciones en algún momento (no solo este mes)
  const conVac = PERSONAL_BASE.filter(ef => {
    const d     = state.personal[ef.id] || {};
    const hasta = d.vacHasta || ef.vacHasta || "";
    return hasta >= hoyStr;
  });

  if (conVac.length > 0) {
    html += `<div class="cal-legend" style="flex-direction:column;gap:6px">`;
    conVac.forEach(ef => {
      const d      = state.personal[ef.id] || {};
      const hasta  = d.vacHasta || ef.vacHasta || "";
      const color  = getVacColor(ef.id);
      const [hy,hm,hd] = hasta.split("-");
      const iniciales  = ef.nombre.split(" ")[0].charAt(0) + (ef.nombre.split(" ")[1]?.charAt(0)||"");
      html += `<div class="cal-leg-item">
        <div style="background:${color};color:#fff;font-size:10px;font-weight:800;
          width:22px;height:16px;border-radius:3px;display:flex;align-items:center;
          justify-content:center;flex-shrink:0;font-family:'Encode Sans',sans-serif">${iniciales}</div>
        <div>
          <span style="font-weight:700">${ef.jerarquia} ${ef.nombre}</span>
          <span style="color:var(--muted);font-size:10px;margin-left:6px">🌴 JPK hasta ${hd}/${hm}/${hy}</span>
        </div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="padding:10px 14px;font-size:12px;color:var(--muted);text-align:center">Sin vacaciones registradas</div>`;
  }

  html += `</div>`; // fin cal-wrap
  wrap.innerHTML = html;
}

function calNavegar(dir) {
  calMonth += dir;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  renderCalendario();
}

function jerarquiaCompleta(abrev) {
  return JERARQUIAS[abrev] || abrev;
}

function renderPersonal(filtro) {
  const q    = (filtro||"").toLowerCase().trim();
  const list = document.getElementById("personalList");
  const stats = { guardia:0, licvac:0, rmh:0 };
  const LICVAC_SET = new Set(["vacaciones","licencia","lic_especial"]);
  const RMH_SET    = new Set(["baja_med","desafect","inactividad","act_limit"]);

  PERSONAL_BASE.forEach(ef => {
    const f = getFuncionEfectiva(ef);
    if      (LICVAC_SET.has(f)) stats.licvac++;
    else if (RMH_SET.has(f))    stats.rmh++;
    else                         stats.guardia++; // operativos + franco
  });

  document.getElementById("p-guardia-n").textContent = stats.guardia;
  document.getElementById("p-franco-n").textContent  = stats.licvac;
  document.getElementById("p-otros-n").textContent   = stats.rmh;

  const filtered = ordenarPersonal(
    PERSONAL_BASE.filter(ef =>
      !q ||
      ef.nombre.toLowerCase().includes(q) ||
      ef.jerarquia.toLowerCase().includes(q) ||
      ef.legajo.includes(q) ||
      (ef.partido||"").toLowerCase().includes(q)
    )
  );

  list.innerHTML = filtered.map(ef => {
    const d        = state.personal[ef.id]||{};
    const func     = getFuncionEfectiva(ef);
    const funcLabel= FUNCIONES.find(f=>f.id===func)?.label || func;
    const icon     = func==="of_servicio"?"🎖️":func==="ayudante"?"👮":func==="enc_tercio"?"⭐":func==="chofer"?"🚗":func==="franco"?"🏠":func==="vacaciones"?"🌴":func==="baja_med"?"🏥":func==="licencia"||func==="lic_especial"?"📋":"📋";
    const jerFull  = jerarquiaCompleta(ef.jerarquia);

    // Calcular antigüedad y días de licencia (Decreto 1050/09 Art. 43)
    const antig    = calcularAntiguedad(ef.fechaIngreso);
    const diasLic  = ef.fechaIngreso && ef.fechaIngreso!=="—" ? calcularDiasLicencia(antig) : null;
    const sitRev   = ef.situacionRevista ? ef.situacionRevista.replace(/_/g," ") : "—";

    const perfilItems = [
      // ── Datos institucionales normativos ─────────────────────
      `<div class="perfil-item full" style="background:var(--ba-teal4);border-color:var(--ba-teal3)">
        <div class="perfil-lbl">Subescalafón — Ley 13982, Art. 27</div>
        <div class="perfil-val"><b>${ef.escalafon||""}</b> · ${ESCALAFONES.find(e=>e.abrev===(ef.escalafon||""))?.label||ef.subescalafon||""}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">Situación de revista: ${sitRev}</div>
      </div>`,
      diasLic ? `<div class="perfil-item full" style="background:var(--ok-bg);border-color:var(--ok)">
        <div class="perfil-lbl">Antigüedad · Licencia anual (Decreto 1050/09, Art. 43)</div>
        <div class="perfil-val">${antig} año${antig!==1?"s":""} de servicio → <b>${diasLic} días corridos</b> de licencia ordinaria</div>
      </div>` : "",
      // ── Datos personales ──────────────────────────────────────
      (ef.calle && ef.calle!=="—") || (ef.domicilio && ef.domicilio!=="—") ? `<div class="perfil-item full"><div class="perfil-lbl">Calle y Número</div><div class="perfil-val">${ef.calle||ef.domicilio||"—"}</div></div>` : "",
      ef.localidad && ef.localidad!=="—" ? `<div class="perfil-item"><div class="perfil-lbl">Localidad</div><div class="perfil-val">${ef.localidad}</div></div>` : "",
      ef.partido   && ef.partido!=="—"   ? `<div class="perfil-item"><div class="perfil-lbl">Partido</div><div class="perfil-val">${ef.partido}</div></div>` : "",
      ef.fechaNac  && ef.fechaNac!=="—"  ? `<div class="perfil-item"><div class="perfil-lbl">Fecha Nac.</div><div class="perfil-val">${ef.fechaNac}</div></div>` : "",
      ef.fechaIngreso && ef.fechaIngreso!=="—" ? `<div class="perfil-item"><div class="perfil-lbl">Ingreso a la institución</div><div class="perfil-val">${ef.fechaIngreso}</div></div>` : "",
      ef.grupoSanguineo && ef.grupoSanguineo!=="—" ? `<div class="perfil-item">
        <div class="perfil-lbl">Grupo sanguíneo / RH</div>
        <div class="perfil-val" style="font-size:16px;font-weight:900;color:var(--no)">
          ${ef.grupoSanguineo}
        </div>
      </div>` : "",
      // ── Datos operativos ─────────────────────────────────────
      ef.criaJurisd && ef.criaJurisd!=="—" ? `<div class="perfil-item full"><div class="perfil-lbl">Cría / Jurisdicción</div><div class="perfil-val">${ef.criaJurisd}</div></div>` : "",
      ef.licHab    && ef.licHab!=="—"    ? `<div class="perfil-item full"><div class="perfil-lbl">Licencia Habilitante</div><div class="perfil-val mono">${ef.licHab}</div></div>` : "",
      ef.armamento && ef.armamento!=="—" ? `<div class="perfil-item"><div class="perfil-lbl">Armamento</div><div class="perfil-val mono">${ef.armamento}</div></div>` : "",
      ef.chaleco   && ef.chaleco!=="—"   ? `<div class="perfil-item"><div class="perfil-lbl">Chaleco</div><div class="perfil-val mono">${ef.chaleco}</div></div>` : "",
      // ── Contacto ─────────────────────────────────────────────
      ef.cel       && ef.cel!=="—"       ? `<div class="perfil-item"><div class="perfil-lbl">Celular</div><div class="perfil-val">📱 ${ef.cel}</div></div>` : "",
      ef.email     && ef.email!=="—"     ? `<div class="perfil-item"><div class="perfil-lbl">Email</div><div class="perfil-val" style="font-size:11px">✉️ ${ef.email}</div></div>` : "",
      ef.nota      && ef.nota!==""       ? `<div class="perfil-item full" style="background:var(--warn-bg);border-color:#fbbf24"><div class="perfil-lbl">Nota</div><div class="perfil-val">${ef.nota}</div></div>` : "",
    ].filter(Boolean).join("");

    return `<div class="efectivo-card${func==="guardia"?" asignado":""}" id="efcard_${ef.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <div class="ef-nombre">${ef.nombre}</div>
            <span class="escalafon-badge">${ef.escalafon||""}</span>
          </div>
          <div style="font-size:12px;color:var(--blue1);font-weight:600;margin-top:2px;font-family:var(--font-display)">
            ${ef.jerarquia} — ${jerFull}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">Leg. ${ef.legajo}</div>
          <div class="ef-funcion ${func}" style="margin-top:6px">${icon} ${funcLabel}</div>
          ${d.obs ? `<div style="font-size:11px;color:var(--muted);margin-top:5px;font-style:italic">${d.obs}</div>` : ""}
          ${perfilItems ? `<span class="ef-toggle" onclick="togglePerfil('${ef.id}')">▸ Ver perfil completo</span>
          <div class="ef-perfil" id="perfil_${ef.id}">
            <div class="perfil-grid">${perfilItems}</div>
            <div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="openEfModal('${ef.id}')" style="margin-bottom:0">✏️ Función del día</button>
              <button class="btn btn-outline btn-sm" onclick="openEditarEfModal('${ef.id}')" style="margin-bottom:0">📋 Editar ficha</button>
            </div>
          </div>` : `<button class="btn btn-outline btn-sm" onclick="openEfModal('${ef.id}')" style="margin-top:8px">✏️ Función del día</button>`}
        </div>
        <div style="font-size:22px;flex-shrink:0;padding-left:8px">${icon}</div>
      </div>
    </div>`;
  }).join("") || `<div class="card"><div style="color:var(--muted);text-align:center;padding:12px">Sin resultados</div></div>`;
}

function togglePerfil(efId) {
  const perfil = document.getElementById("perfil_"+efId);
  const toggle = perfil ? perfil.previousElementSibling : null;
  if (!perfil) return;
  const isOpen = perfil.classList.toggle("open");
  if (toggle) toggle.textContent = isOpen ? "▾ Ocultar perfil" : "▸ Ver perfil completo";
}

const _FUNC_OP    = ["of_servicio","ayudante","enc_tercio","chofer"];
const _FUNC_OP_ICONS = { of_servicio:"🎖️", ayudante:"👮", enc_tercio:"⭐", chofer:"🚗" };

function openEfModal(efId) {
  currentEfId = efId;
  const ef      = PERSONAL_BASE.find(p=>p.id===efId);
  const d       = state.personal[efId]||{};
  const func    = getFuncionEfectiva(ef);
  const jerFull = JERARQUIAS[ef.jerarquia] || ef.jerarquia;

  document.getElementById("efTitle").textContent = ef.nombre;

  const headerHtml = `
    <div style="font-size:13px;color:var(--blue1);font-weight:700;font-family:var(--font-display);margin-bottom:2px">
      ${escapeHTML(ef.jerarquia)} — ${escapeHTML(jerFull)} <span class="escalafon-badge">${escapeHTML(ef.escalafon)}</span>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:14px">
      Leg. ${escapeHTML(ef.legajo)}${ef.cel&&ef.cel!=='—'?' &nbsp;·&nbsp; 📱 '+escapeHTML(ef.cel):''}
    </div>`;

  const funcsOp    = FUNCIONES.filter(f =>  _FUNC_OP.includes(f.id));
  const funcsExtra = FUNCIONES.filter(f => !_FUNC_OP.includes(f.id));
  const esExtra    = !_FUNC_OP.includes(func);
  const extraLabel = esExtra ? (FUNCIONES.find(f=>f.id===func)?.label || "") : "";

  document.getElementById("efBody").innerHTML = headerHtml + `
    <label class="lbl">Función del día</label>
    <div class="funcion-grid funcion-op">
      ${funcsOp.map(f => `
        <button class="fbtn${func===f.id?" active-"+f.id:""}" onclick="setFuncion(this,'${f.id}')">
          <span class="fbtn-icon">${_FUNC_OP_ICONS[f.id]||""}</span>${f.label}
        </button>
      `).join("")}
    </div>

    <div class="funcion-extra-toggle" id="situacionToggle" onclick="toggleSituacionExtra()">
      ${esExtra
        ? `<span style="opacity:.7">▾</span> Otra situación &nbsp;<span class="funcion-extra-badge">${extraLabel}</span>`
        : `<span style="opacity:.5">▸</span> Otra situación <span style="opacity:.45;font-weight:400;text-transform:none;font-size:10px">franco · licencia · baja med. · más…</span>`
      }
    </div>
    <div class="funcion-situacion-wrap" id="situacionWrap" style="display:${esExtra ? 'block' : 'none'}">
      <div class="funcion-grid" style="margin-top:8px">
        ${funcsExtra.map(f => `
          <button class="fbtn${func===f.id?" active-"+f.id:""}" onclick="setFuncion(this,'${f.id}')">${f.label}</button>
        `).join("")}
      </div>
    </div>

    <label class="lbl" style="margin-top:14px">Observaciones</label>
    <textarea id="ef_obs" placeholder="Sin observaciones">${d.obs||""}</textarea>
    <div class="vac-fecha-wrap" id="vacFechaWrap">
      <label class="lbl" style="margin-top:0;color:var(--warn)">🌴 Vacaciones hasta</label>
      <input type="date" id="ef_vacHasta" value="${d.vacHasta||ef.vacHasta||""}">
      <div style="font-size:11px;color:var(--warn);margin-top:4px">Esta fecha se refleja en el calendario del plantel.</div>
    </div>`;

  document.getElementById("efModal").classList.add("open");
  setTimeout(()=>{
    const vacWrap = document.getElementById("vacFechaWrap");
    if (vacWrap) vacWrap.classList.toggle("visible", func==="vacaciones");
  }, 50);
}
function closeEfModal() {
  document.getElementById("efModal").classList.remove("open");
  currentEfId = null;
}
function toggleSituacionExtra() {
  const wrap   = document.getElementById("situacionWrap");
  const toggle = document.getElementById("situacionToggle");
  if (!wrap || !toggle) return;
  const isOpen = wrap.style.display !== "none";
  wrap.style.display = isOpen ? "none" : "block";
  toggle.innerHTML = isOpen
    ? `<span style="opacity:.5">▸</span> Otra situación <span style="opacity:.45;font-weight:400;text-transform:none;font-size:10px">franco · licencia · baja med. · más…</span>`
    : `<span style="opacity:.7">▾</span> Otra situación`;
}
function setFuncion(btn, funcId) {
  document.querySelectorAll(".fbtn").forEach(b => b.className = "fbtn");
  btn.className = "fbtn active-" + funcId;
  const vacWrap = document.getElementById("vacFechaWrap");
  if (vacWrap) vacWrap.classList.toggle("visible", funcId === "vacaciones");
  // Si se selecciona un rol operativo, colapsar el panel de otras situaciones
  if (_FUNC_OP.includes(funcId)) {
    const wrap   = document.getElementById("situacionWrap");
    const toggle = document.getElementById("situacionToggle");
    if (wrap)   wrap.style.display = "none";
    if (toggle) toggle.innerHTML = `<span style="opacity:.5">▸</span> Otra situación <span style="opacity:.45;font-weight:400;text-transform:none;font-size:10px">franco · licencia · baja med. · más…</span>`;
  }
}
function saveEfectivo() {
  if (!currentEfId) return;
  const ef      = PERSONAL_BASE.find(p=>p.id===currentEfId);
  if (!ef) return;
  const activeBtn = document.querySelector("#efModal .fbtn[class*='active-']");
  const func = activeBtn
    ? activeBtn.className.trim().split(" ").find(c => c.startsWith("active-"))?.replace("active-","") || (ef.funcion_base || "chofer")
    : (ef.funcion_base || "chofer");
  // Validar roles únicos (of_servicio, ayudante, enc_tercio) — no vacaciones
  if (!validarRolUnico(currentEfId, func)) return;
  const vacHasta = func === "vacaciones"
    ? (document.getElementById("ef_vacHasta")?.value || "")
    : "";
  state.personal[currentEfId] = {
    funcion:  func,
    obs:      document.getElementById("ef_obs")?.value.trim() || "",
    vacHasta,
  };

  // ── Persistir vacHasta en el perfil permanente para que sobreviva entre sesiones ──
  // saveEfectivo solo actualiza state.personal (datos del turno), pero si no
  // se refleja en PERSONAL_BASE y se sincroniza a Supabase, la próxima sesión
  // lo pierde porque state.personal empieza vacío cada día.
  if (vacHasta) {
    ef.vacHasta = vacHasta;  // actualizar el perfil en memoria
    if (!state.vacaciones) state.vacaciones = {};
    state.vacaciones[currentEfId] = {
      desde: state.fecha || new Date().toISOString().split("T")[0],
      hasta: vacHasta
    };
    renderCalendario();
    sincronizarPersonal();   // persistir vac_hasta en Supabase
  } else if (ef.vacHasta) {
    // Si se cambió la función a algo distinto de vacaciones, limpiar la fecha
    const hoy = new Date().toISOString().split("T")[0];
    if (ef.vacHasta < hoy) {
      ef.vacHasta = "";      // ya venció — limpiar el perfil
      if (state.vacaciones) delete state.vacaciones[currentEfId]; // quitar de dpt_vac
      sincronizarPersonal();
    }
  }

  saveStorage();     // guarda estado del turno (incluye llamada a saveVacaciones)
  if (typeof saveVacaciones === "function") saveVacaciones(); // doble seguro: persiste dpt_vac
  closeEfModal();
  renderPersonal(document.getElementById("searchPersonal")?.value || "");
  showToast("✓ " + ef.nombre.split(" ")[0] + " guardado");
}

