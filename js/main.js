// ═══════════════════════════════════════
//  MODO DEBUG — poner true solo en desarrollo
// ═══════════════════════════════════════
const DEBUG = false;
const dbg  = (...a) => { if (DEBUG) console.log(...a); };
const dbgW = (...a) => { if (DEBUG) console.warn(...a); };

// ═══════════════════════════════════════
//  SUPABASE — configuración
// ═══════════════════════════════════════
// NOTA DE SEGURIDAD — SUPA_KEY (anon key):
// La "anon key" de Supabase está diseñada para ser pública en apps cliente.
// NO otorga acceso irrestricto: toda la seguridad real se aplica mediante
// Row Level Security (RLS) en las tablas de Supabase. Esta key NO debe
// reemplazarse por la "service_role key", que sí tiene acceso sin restricciones.
// Referencia: https://supabase.com/docs/guides/api/api-keys
const SUPA_URL = "https://abmxokahzbxklwyzaiyr.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibXhva2FoemJ4a2x3eXphaXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDczMTQsImV4cCI6MjA5NjAyMzMxNH0.o4qEy0i02dS8P1mTW1Oa8V3JgBnmg9o5vL4E0X-jfK0";
let supaClient = null;

// ════════════════════════════════════════════
//  HELPER ANTI-XSS
// ════════════════════════════════════════════
function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setNubeStatus(estado, texto) {
  const dot = document.getElementById("nubeDot");
  const txt = document.getElementById("nubeStatusTxt");
  if (dot) dot.className = "nube-dot " + estado;
  if (txt) txt.textContent = texto;
}

function initSupabase() {
  if (!window.supabase) {
    setNubeStatus("error","SDK no disponible");
    console.error("[DI.PRO.TRAN] SDK de Supabase no disponible — verificar que cdn.jsdelivr.net cargó correctamente.");
    return;
  }
  try {
    supaClient = window.supabase.createClient(SUPA_URL, SUPA_KEY);
    setNubeStatus("online", "Conectado");
  } catch(e) {
    setNubeStatus("error", "Error de conexión");
    console.error("[DI.PRO.TRAN] Error al crear Supabase client:", e);
  }
}

// ── Payload compartido para guardar en nube ───────────────────────────────
function buildPayload() {
  return {
    fecha:      state.fecha,
    oficial:    state.oficial,
    ayudante:   state.ayudante,
    vehicles:   state.vehicles,
    personal:   state.personal,
    extras:     state.extras     || [],
    vacaciones: state.vacaciones || {},
    eliminados: state.eliminados || [],
  };
}

// ── Auto-guardado en nube (debounce 30 s) ─────────────────────────────────
// QA-009: guarda en localStorage siempre; va a nube solo si hay encabezado completo.
// QA-016: ventana anti-spam reducida de 5 min a 90 s para no perder cambios menores.
let _autoSaveTimer = null;
let _lastAutoSave  = 0;

function scheduleAutoSave() {
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(async () => {
    // Siempre persistir en localStorage (aunque falte oficial/ayudante)
    saveStorage();

    // Solo subir a nube si hay encabezado completo y hay cliente Supabase
    if (!supaClient || !state.fecha || !state.oficial || !state.ayudante) return;
    const now = Date.now();
    if (now - _lastAutoSave < 90 * 1000) return; // evitar spam (90 s en lugar de 5 min)
    _lastAutoSave = now;
    setNubeStatus("saving", "Auto-guardando...");
    try {
      const payload = buildPayload();
      const { data: existing } = await supaClient
        .from("informes").select("id").eq("fecha", state.fecha).limit(1);
      if (existing && existing.length > 0) {
        await supaClient.from("informes").update(payload).eq("id", existing[0].id);
      } else {
        await supaClient.from("informes").insert([payload]);
      }
      await sincronizarPersonal();
      setNubeStatus("online", "Auto-guardado ✓");
      setTimeout(() => setNubeStatus("online", "Conectado"), 2500);
    } catch(e) {
      setNubeStatus("online", "Conectado"); // no molestar con error silencioso
      dbgW("Auto-guardado falló:", e);
    }
  }, 30000); // 30 segundos de inactividad
}

const VAC_KEY = "dpt_vac"; // clave independiente del turno — vacaciones persisten entre días

// ── Titulares fijos del turno — fallback para aplicarDefaultsGuardia() ───────
// NOTA: No se puede referenciar PERSONAL_BASE aquí (declarada más abajo).
// Los valores se derivan de los nombres reales de los titulares habituales.
const DEFAULT_OFICIAL_NOMBRE  = "VILLALBA LUCAS";
const DEFAULT_AYUDANTE_NOMBRE = "CABRAL BLANCO CRISTIAN";

// → Ver js/offline.js (COLA_KEY, FOTO_COLA_KEY, procesarColaOffline, procesarColaFotos, ...)
async function guardarEnNube() {
  if (!supaClient) { showToast("⚠️ Sin conexión a la nube"); return; }
  if (!validateResponsables()) return;
  const btn = document.getElementById("btnGuardarNube");
  btn.disabled = true;
  setNubeStatus("saving", "Verificando...");
  // ── Confirmar sobreescritura si ya existe informe para esta fecha ─────────
  try {
    const { data: existing } = await supaClient
      .from("informes").select("id,fecha").eq("fecha", state.fecha).limit(1);
    if (existing && existing.length > 0) {
      const continuar = confirm(
        `⚠️ Ya existe un informe guardado para el ${state.fecha}.\n\n` +
        `Si continuás, el informe anterior será sobreescrito.\n\n` +
        `¿Confirmás la sobreescritura?`
      );
      if (!continuar) {
        btn.disabled = false;
        setNubeStatus("online", "Conectado");
        return;
      }
    }
  } catch(e) {
    // Si falla la verificación (offline), continuar de todos modos — el catch de abajo lo maneja
  }
  setNubeStatus("saving", "Guardando...");
  const payload = buildPayload();
  try {
    await _upsertInforme(payload);
    // Sincronizar perfiles del personal (permanentes)
    await sincronizarPersonal();
    setNubeStatus("online", "Guardado ✓");
    showToast("☁️ Informe guardado en la nube");
    // Si había items en cola, intentar procesarlos ahora que hay conexión
    if (getColaOffline().length > 0) procesarColaOffline();
  } catch(e) {
    // Sin conexión o error de red → encolar
    if (!navigator.onLine || e.message?.includes("fetch") || e.message?.includes("network") || e.message?.includes("Failed")) {
      encolarPayload(payload);
      setNubeStatus("offline", "Sin conexión — en cola");
      showToast("⏳ Sin red — guardado en cola local");
    } else {
      setNubeStatus("error", "Error al guardar");
      showToast("❌ " + (e.message||"Error al guardar"));
      dbgW("guardarEnNube error:", e);
    }
  } finally {
    btn.disabled = false;
    setTimeout(() => {
      const cola = getColaOffline();
      if (cola.length > 0) setNubeStatus("offline", `En cola (${cola.length})`);
      else setNubeStatus("online", "Conectado");
    }, 3000);
  }
}

async function sincronizarPersonal() {
  if (!supaClient) return;
  try {
    // Upsert de toda la lista de personal.
    // Deduplicar por id porque los nuevos están en PERSONAL_BASE Y en state.personalExtra.
    const todosRaw = [...PERSONAL_BASE, ...(state.personalExtra||[])];
    const todos = [...new Map(todosRaw.map(p => [p.id, p])).values()];
    // Corregir datos históricos incorrectos antes de sincronizar
    todos.forEach(ef => {
      if (ef.id === "p07") {
        ef.escalafon    = "S.G.";
        ef.subescalafon = "Servicios Generales";
      }
    });
    const rows = todos.map(ef => ({
      id:               ef.id,
      nombre:           ef.nombre,
      jerarquia:        ef.jerarquia,
      escalafon:        ef.escalafon,
      subescalafon:     ef.subescalafon,
      legajo:           ef.legajo,
      destino:          ef.destino,
      calle:            ef.calle || ef.domicilio || "—",
      localidad:        ef.localidad || "—",
      partido:          ef.partido || "—",
      fecha_nac:        ef.fechaNac,
      fecha_ingreso:    ef.fechaIngreso,
      cel:              ef.cel,
      email:            ef.email,
      lic_hab:          ef.licHab,
      armamento:        ef.armamento,
      chaleco:          ef.chaleco,
      cria_jurisd:      ef.criaJurisd,
      grupo_sanguineo:  ef.grupoSanguineo,
      factor_rh:        ef.factorRh || "—",
      situacion_revista:ef.situacionRevista,
      vac_hasta:        ef.vacHasta || "",
      nota:             ef.nota || "",
      funcion_base:     ef.funcion_base,
      funcion_fija:     ef.funcion_fija || false,
      ord:              ef.ord || 99,
    }));
    const { error } = await supaClient
      .from("personal")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      dbgW("Sync personal:", error.message, error.code);
      showToast("⚠️ No se pudo guardar el personal en la nube");
    } else {
      dbg("Personal sincronizado OK");
    }
  } catch(e) {
    dbgW("Error sincronizando personal:", e);
    showToast("⚠️ Sin conexión — el personal no fue sincronizado");
  }
}

async function cargarPersonalDesdeNube() {
  if (!supaClient) return false;
  // Flag para evitar re-procesar datos ya cargados en esta sesión
  if (cargarPersonalDesdeNube._cargado) {
    return true; // ya fue cargado — solo refrescar si fue llamado explícitamente
  }
  try {
    const { data, error } = await supaClient
      .from("personal")
      .select("*")
      .order("ord", { ascending: true })
      .limit(200);
    if (error || !data || !data.length) return false;
    // H-02: excluir personal dado de baja (activo === false) y removerlo de las
    // listas locales si quedó de una sesión anterior. NULL se trata como activo
    // para no perder registros base sin la columna seteada.
    data.filter(row => row.activo === false).forEach(row => {
      const i = PERSONAL_BASE.findIndex(p => p.id === row.id);
      if (i >= 0) PERSONAL_BASE.splice(i, 1);
      if (state.personalExtra) {
        const j = state.personalExtra.findIndex(p => p.id === row.id);
        if (j >= 0) state.personalExtra.splice(j, 1);
      }
    });
    const activos = data.filter(row => row.activo !== false);
    // Actualizar PERSONAL_BASE con todos los efectivos de la nube.
    // No hay distinción "base vs extra" — la tabla personal ES la lista de la sección.
    activos.forEach(row => {
      const idx = PERSONAL_BASE.findIndex(p=>p.id===row.id);
      const ef = {
        id: row.id, ord: row.ord || 99,
        nombre: row.nombre, jerarquia: row.jerarquia,
        escalafon: row.escalafon, subescalafon: row.subescalafon,
        legajo: row.legajo, destino: row.destino,
        calle: row.calle, localidad: row.localidad, partido: row.partido,
        fechaNac: row.fecha_nac, fechaIngreso: row.fecha_ingreso,
        cel: row.cel, email: row.email, licHab: row.lic_hab,
        armamento: row.armamento, chaleco: row.chaleco,
        criaJurisd: row.cria_jurisd, grupoSanguineo: row.grupo_sanguineo,
        factorRh: row.factor_rh,
        situacionRevista: row.situacion_revista, vacHasta: row.vac_hasta,
        nota: row.nota, funcion_base: row.funcion_base,
        funcion_fija: row.funcion_fija, domicilio: row.calle,
        activo: row.activo !== false,
      };
      if (idx >= 0) {
        // Actualizar efectivo existente con datos completos de la nube
        PERSONAL_BASE[idx] = { ...PERSONAL_BASE[idx], ...ef };
      } else {
        // Persona nueva en la nube (alta via admin desde otro dispositivo, o personal base
        // cuyo id no está en el fallback hardcodeado) — agregarla a la lista
        if (!PERSONAL_BASE.find(p => p.id === row.id)) {
          PERSONAL_BASE.push(ef);
        }
        // Marcar como "agregado" en state.personalExtra para que persista localmente
        if (!state.personalExtra) state.personalExtra = [];
        if (!state.personalExtra.find(p => p.id === row.id)) state.personalExtra.push(ef);
      }
    });
    cargarPersonalDesdeNube._cargado = true; // marcar como cargado
    return true;
  } catch(e) {
    dbgW("Error cargando personal:", e);
    return false;
  }
}

// ════════════════════════════════════════════
//  FLOTA DESDE SUPABASE
// ════════════════════════════════════════════
async function cargarFlotaDesdeNube() {
  if (!supaClient) return false;
  try {
    const [{ data: secciones, error: errSec }, { data: vehiculos, error: errVeh }] = await Promise.all([
      supaClient.from("secciones").select("*").order("ord").limit(200),
      supaClient.from("vehiculos").select("*").eq("activo", true).order("ord").limit(500),
    ]);
    if (errSec || !secciones?.length) return false;
    if (errVeh) return false;

    // Reconstruir SECTIONS desde Supabase, conservando los _extra agregados en el turno
    const extras = [];
    SECTIONS.forEach(sec => sec.vehicles.forEach(v => { if (v._extra) extras.push({ secId: sec.id, v }); }));

    SECTIONS = secciones.map(sec => ({
      id:       sec.id,
      label:    sec.label,
      type:     sec.type,
      vehicles: (vehiculos || [])
        .filter(v => v.seccion_id === sec.id)
        .map(v => ({
          ro:      v.ro,
          ...(v.marca  ? { marca:   v.marca  } : {}),
          ...(v.modelo ? { modelo:  v.modelo } : {}),
          ...(v.dominio? { dominio: v.dominio} : {}),
          _dbId: v.id,
        })),
    }));

    // Re-inyectar los _extra del turno en curso
    extras.forEach(({ secId, v }) => {
      const sec = SECTIONS.find(s => s.id === secId);
      if (sec && !sec.vehicles.find(x => x.ro === v.ro)) sec.vehicles.push(v);
    });

    return true;
  } catch(e) {
    dbgW("cargarFlotaDesdeNube error:", e);
    return false;
  }
}

async function cargarUltimoInforme() {
  if (!supaClient) return;
  try {
    const { data, error } = await supaClient
      .from("informes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data || !data.length) return;
    cargarDesdeNube(data[0]);
  } catch(e) {
    dbgW("Error cargando último informe:", e);
  }
}

function cargarDesdeNube(inf) {
  state.fecha      = inf.fecha      || state.fecha;
  state.oficial    = inf.oficial    || state.oficial;
  state.ayudante   = inf.ayudante   || state.ayudante;
  state.vehicles   = inf.vehicles   || {};
  state.personal   = inf.personal   || {};
  state.extras     = inf.extras     || [];
  // Merge: la nube llena los huecos pero no pisa datos locales ya definidos
  state.vacaciones = { ...(inf.vacaciones || {}), ...state.vacaciones };
  // Eliminados: fusionar con los locales (no reemplazar)
  const eliminadosInf = inf.eliminados || [];
  const eliminadosActuales = state.eliminados || [];
  state.eliminados = [...new Set([...eliminadosActuales, ...eliminadosInf])];
  saveEliminados();
  if (state.fecha)    document.getElementById("inpFecha").value    = state.fecha;
  if (state.oficial)  document.getElementById("inpOficial").value  = state.oficial;
  if (state.ayudante) document.getElementById("inpAyudante").value = state.ayudante;
  if (state.extras.length) {
    state.extras.forEach(e => {
      const sec = SECTIONS.find(s=>s.id===e.secId);
      if (sec && !sec.vehicles.find(v=>v.ro===e.v.ro)) sec.vehicles.push({...e.v});
    });
  }
  saveStorage();
  buildSecNav();
  renderList(activeSec);
  updateProgress();
  updateSummary();
  updateHeaderDate();
  renderCalendario();
}

// → Ver js/historial.js (cargarInformeHistorial, renderHistorialTab)
function aplicarRestriccionesRol() {
  const esJefe = currentUserRol === "jefe";

  // Nav Admin (tab 6): solo visible para jefes
  const nav6 = document.getElementById("nav6");
  if (nav6) nav6.style.display = esJefe ? "" : "none";

  // Indicador visual del rol en la barra superior
  let rolBadge = document.getElementById("rolBadge");
  if (!rolBadge) {
    rolBadge = document.createElement("span");
    rolBadge.id = "rolBadge";
    rolBadge.style.cssText = "font-size:10px;font-weight:700;font-family:var(--font-display);padding:2px 8px;border-radius:10px;margin-left:6px";
    const nubeStatus = document.getElementById("nubeStatus");
    if (nubeStatus) nubeStatus.appendChild(rolBadge);
  }
  if (esJefe) {
    rolBadge.textContent = "JEFE";
    rolBadge.style.background = "var(--ba-teal4)";
    rolBadge.style.color = "var(--blue1)";
  } else {
    rolBadge.textContent = "OFICIAL";
    rolBadge.style.background = "var(--blue5)";
    rolBadge.style.color = "var(--blue2)";
  }
}

function togglePassVis() {
  const inp = document.getElementById("loginPass");
  const btn = document.getElementById("btnTogglePass");
  if (inp.type === "password") {
    inp.type = "text";
    btn.textContent = "🙈";
    btn.setAttribute("aria-label", "Ocultar contraseña");
  } else {
    inp.type = "password";
    btn.textContent = "👁";
    btn.setAttribute("aria-label", "Mostrar contraseña");
  }
  inp.focus();
}

async function doLogin() {
  const user  = (document.getElementById("loginUser")?.value||"").trim().toLowerCase();
  const pass  = document.getElementById("loginPass")?.value||"";
  const errEl = document.getElementById("loginError");
  const btn   = document.querySelector("#loginScreen .btn-gold");
  if (!user || !pass) {
    errEl.textContent = "Ingresá usuario y contraseña";
    errEl.style.display = "block";
    return;
  }
  // Los usuarios en Supabase Auth tienen email <usuario>@diprotran.internal
  const email = user + "@diprotran.internal";
  if (btn) { btn.disabled = true; btn.textContent = "Ingresando..."; }
  errEl.style.display = "none";
  try {
    const { error } = await supaClient.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    // onAuthStateChange (en window.load) maneja la transición al app
  } catch(e) {
    errEl.textContent = "Usuario o contraseña incorrectos";
    errEl.style.display = "block";
    document.getElementById("loginPass").value = "";
    document.getElementById("loginPass").focus();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Ingresar →"; }
  }
}

async function doLogout() {
  try {
    if (supaClient) {
      // Timeout 4s: si signOut no responde, igual mostramos login
      await Promise.race([
        supaClient.auth.signOut(),
        new Promise((_,rej) => setTimeout(() => rej(new Error("timeout")), 4000))
      ]);
    }
  } catch(e) {
    dbgW("signOut error/timeout (ignorado):", e);
  } finally {
    // Siempre volver al login, aunque falle la red
    appInited = false;
    cargarPersonalDesdeNube._cargado = false; // permitir re-carga en próximo login
    if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }
    document.getElementById("loginScreen").style.display = "";
    document.getElementById("loginUser").value  = "";
    document.getElementById("loginPass").value  = "";
    document.getElementById("loginPass").focus();
  }
}

// Retorna true si hay sesión activa; la gestión real la hace onAuthStateChange
function checkAuth() {
  return !!(supaClient && currentUserEmail);
}

// ════════════════════════════════════════════
//  NAVEGACIÓN POR TECLADO
// ════════════════════════════════════════════
document.addEventListener("keydown", function(e) {
  const key = e.key;
  const tag = document.activeElement?.tagName?.toLowerCase();
  const isTextArea = tag === "textarea";
  const isInput    = tag === "input" || tag === "select";

  // ESC: cerrar cualquier modal abierto
  if (key === "Escape") {
    const modales = [
      "vModal","efModal","nuevoEfModal","newRoModal",
      "flotaModal","compModal","actaModal","countModal"
    ];
    for (const id of modales) {
      const el = document.getElementById(id);
      if (el && el.classList.contains("open")) {
        el.classList.remove("open");
        return;
      }
    }
    // Si el login está abierto, no hacer nada
    return;
  }

  // ENTER: comportamiento contextual
  if (key === "Enter" && !isTextArea) {
    // Login
    if (document.getElementById("loginScreen")?.style.display !== "none") {
      if (document.getElementById("loginUser") === document.activeElement ||
          document.getElementById("loginPass") === document.activeElement) {
        doLogin(); e.preventDefault(); return;
      }
    }

    // Modal de vehículo abierto → Guardar
    if (document.getElementById("vModal")?.classList.contains("open")) {
      saveVehicle(); e.preventDefault(); return;
    }

    // Modal de efectivo abierto → Guardar
    if (document.getElementById("efModal")?.classList.contains("open")) {
      saveEfectivo(); e.preventDefault(); return;
    }

    // Modal nuevo efectivo → Guardar
    if (document.getElementById("nuevoEfModal")?.classList.contains("open")) {
      saveNuevoEfectivo(); e.preventDefault(); return;
    }

    // Buscador de RO activo → buscar
    if (document.getElementById("searchRO") === document.activeElement) {
      doSearch(); e.preventDefault(); return;
    }

    // Encabezado: Enter en fecha → foco en oficial
    if (document.getElementById("inpFecha") === document.activeElement) {
      document.getElementById("inpOficial")?.focus();
      e.preventDefault(); return;
    }
    // Encabezado: Enter en oficial → foco en ayudante
    if (document.getElementById("inpOficial") === document.activeElement) {
      document.getElementById("inpAyudante")?.focus();
      e.preventDefault(); return;
    }
    // Encabezado: Enter en ayudante → continuar a móviles
    if (document.getElementById("inpAyudante") === document.activeElement) {
      goTab(2); e.preventDefault(); return;
    }
  }

  // TAB: en login, moverse entre usuario y contraseña
  if (key === "Tab") {
    if (document.getElementById("loginScreen")?.style.display !== "none") {
      // dejar comportamiento nativo del tab en el login
      return;
    }
  }
});

// ════════════════════════════════════════════
//  CONSTANTES
// ════════════════════════════════════════════
const OPTS = ["OK","NO","Roto","N/A"];
const OPT_COLORS = { OK:"#0d6e2f", NO:"#b91c1c", Roto:"#92400e", "N/A":"#64748b" };

// ════════════════════════════════════════════
//  TABLA DE JERARQUÍAS (CDO. y E.G.)
// ════════════════════════════════════════════
// ── Jerarquías según Ley 13982, Art. 29 ──────────────────────
// Subescalafón Comando (CDO.) — Art. 29 inc. a)
// Oficiales de Conducción: Comisario General / Comisario Mayor
// Oficiales de Supervisión: Comisario Inspector
// Oficiales Jefes: Comisario / Subcomisario
// Oficiales Subalternos: Oficial Principal / Oficial Inspector /
//   Oficial Subinspector / Oficial Ayudante / Oficial Subayudante
// Subescalafón General (E.G.) — Art. 29 inc. b)
// Oficiales Superiores: Mayor / Capitán / Teniente 1°
// Oficiales Subalternos: Teniente / Subteniente / Sargento / Oficial
const JERARQUIAS = {
  // ── Subescalafón Comando (CDO.) ─────────────────
  // Oficiales de Conducción
  "CRIO GRAL":  "Comisario General",
  "CRIO MAYOR": "Comisario Mayor",
  // Oficial de Supervisión
  "CRIO INSP":  "Comisario Inspector",
  // Oficiales Jefes
  "CRIO":       "Comisario",
  "SUBCRIO":    "Subcomisario",
  // Oficiales Subalternos CDO.
  "OF PPAL":    "Oficial Principal",
  "OI":         "Oficial Inspector",
  "OSI":        "Oficial Subinspector",   // corregido: Subinspector (no "Sub Inspector")
  "OA":         "Oficial Ayudante",
  "OSA":        "Oficial Subayudante",
  // ── Subescalafón General (E.G.) ─────────────────
  // Oficiales Superiores
  "MYR":        "Mayor",                  // corregido: Mayor (no "Suboficial Mayor")
  "CAP":        "Capitán",
  "TTE 1°":     "Teniente 1°",            // corregido: "1°" en lugar de "Primero"
  // Oficiales Subalternos E.G.
  "TTE":        "Teniente",
  "SUBTE":      "Subteniente",
  "SGTO":       "Sargento",
  "OFL":        "Oficial",               // corregido: "Oficial" (la ley dice "Oficial", no "de Policía")
};

const FUNCIONES = [
  // ── Roles principales (orden de importancia) ──
  { id:"of_servicio", label:"Oficial de Servicio",      unico:true,  grupo:"operativo" },
  { id:"ayudante",    label:"Ayudante de Guardia",       unico:true,  grupo:"operativo" },
  { id:"enc_tercio",  label:"Encargado de Tercio",       unico:true,  grupo:"operativo" },
  { id:"chofer",      label:"Chofer / Disponible",       unico:false, grupo:"operativo" },
  // ── Situaciones de revista (Ley 13982, Art. 13) ──
  { id:"franco",      label:"Franco",                    unico:false, grupo:"revista"   },
  { id:"disponib",    label:"Disponibilidad",            unico:false, grupo:"revista"   },
  { id:"licencia",    label:"Lic. Ordinaria",            unico:false, grupo:"licencia"  },
  { id:"lic_especial",label:"Lic. Especial (Dcr. 1050)",  unico:false, grupo:"licencia"  },
  { id:"vacaciones",  label:"Vacaciones (JPK)",          unico:false, grupo:"licencia"  },
  { id:"baja_med",    label:"Baja Médica (RMH)",         unico:false, grupo:"salud"     },
  { id:"desafect",    label:"Desafectado",               unico:false, grupo:"revista"   },
  { id:"inactividad", label:"Inactividad",               unico:false, grupo:"revista"   },
  { id:"act_limit",   label:"Actividad Limitada",        unico:false, grupo:"revista"   },
];

// Días de licencia anual por antigüedad (Decreto 1050/09, Art. 43)
const LICENCIA_ESCALA = [
  { desde:1,  hasta:5,  dias:20 },
  { desde:6,  hasta:10, dias:26 },
  { desde:11, hasta:15, dias:32 },
  { desde:16, hasta:20, dias:38 },
  { desde:21, hasta:99, dias:45 },
];

function calcularDiasLicencia(antiguedad) {
  const escala = LICENCIA_ESCALA.find(e => antiguedad >= e.desde && antiguedad <= e.hasta);
  return escala ? escala.dias : 0;
}

function calcularAntiguedad(fechaIngreso) {
  if (!fechaIngreso) return 0;
  const hoy    = new Date();
  const ingreso = new Date(fechaIngreso);
  return Math.floor((hoy - ingreso) / (1000 * 60 * 60 * 24 * 365.25));
}

// ════════════════════════════════════════════
//  PERSONAL — 2ª Sección · Di.Pro.Tran.
//  Base normativa: Ley 13982 y Decreto 1050/09
// ════════════════════════════════════════════
// Campos normativos según Ley 13982 y Decreto 1050/09:
// - subescalafon: "Comando" | "General" (Art. 27 y 29)
// - situacionRevista: según Art. 13 (servicio_activo, disponibilidad, etc.)
// - fechaIngreso: para calcular antigüedad y días de licencia (Decreto Art. 43)
// - grupoSanguineo: dato de legajo recomendado por el sistema
// Personal hardcodeado como fallback — se actualiza desde Supabase en cargarPersonalDesdeNube()
// ── PERSONAL_BASE — fallback mínimo offline ───────────────────────────────
// Solo contiene los campos imprescindibles para que la app arranque sin red.
// Los datos completos (legajo, domicilio, tel, email, armamento, etc.)
// viven en Supabase y se cargan en cargarPersonalDesdeNube().
// Ver SETUP_PERSONAL_PII.sql para migrar los datos a la nube.
let PERSONAL_BASE = [
  { id:"p01", ord:1,  jerarquia:"OA",   escalafon:"CDO.", subescalafon:"Comando",           nombre:"Villalba Lucas Iván",      funcion_base:"of_servicio", funcion_fija:false, situacionRevista:"servicio_activo", destino:"Direc. Prov. Transp.", nota:"Oficial de Servicio. Ante JPK (vacaciones), Ayala José asciende automáticamente." },
  { id:"p02", ord:3,  jerarquia:"SGTO", escalafon:"E.G.", subescalafon:"General",            nombre:"Ayala José",               funcion_base:"enc_tercio",  funcion_fija:false, situacionRevista:"servicio_activo", destino:"Direc. Prov. Transp.", nota:"Encargado de Tercio. Asciende a Oficial de Servicio ante JPK de Villalba (vacaciones)" },
  { id:"p03", ord:7,  jerarquia:"OFL",  escalafon:"E.G.", subescalafon:"General",            nombre:"Miller Gustavo Daniel",    funcion_base:"chofer",      funcion_fija:false, situacionRevista:"servicio_activo", destino:"Direc. Transp.",        nota:"" },
  { id:"p04", ord:11, jerarquia:"OFL",  escalafon:"E.G.", subescalafon:"General",            nombre:"Fink Nicolás Ezequiel",    funcion_base:"chofer",      funcion_fija:false, situacionRevista:"servicio_activo", destino:"Direc. Transp.",        nota:"" },
  { id:"p05", ord:12, jerarquia:"OFL",  escalafon:"E.G.", subescalafon:"General",            nombre:"Galigniana Víctor Camilo", funcion_base:"chofer",      funcion_fija:false, situacionRevista:"servicio_activo", destino:"Direc. Transp.",        nota:"" },
  { id:"p06", ord:16, jerarquia:"OFL",  escalafon:"E.G.", subescalafon:"General",            nombre:"Mangini Nahuel Elías",     funcion_base:"chofer",      funcion_fija:false, situacionRevista:"servicio_activo", destino:"Direc. Transp.",        nota:"" },
  { id:"p07", ord:17, jerarquia:"OFL",  escalafon:"S.G.", subescalafon:"Servicios Generales",nombre:"Cabral Blanco Cristian",   funcion_base:"ayudante",    funcion_fija:false, situacionRevista:"servicio_activo", destino:"Direc. Prov. Transp.", nota:"Ayudante de Guardia habitual" },
];

// ════════════════════════════════════════════
//  CAMPOS POR TIPO DE VEHÍCULO
// ════════════════════════════════════════════
const FIELDS = {
  movil_std: [
    { id:"stereo",    label:"Stereo" },
    { id:"bateria",   label:"Batería" },
    { id:"tapaComb",  label:"Tapa comb." },
    { id:"matafuego", label:"Matafuego" },
    { id:"auxilio",   label:"Auxilio" },
    { id:"ac",        label:"Aire AC" },
    { id:"puerta",    label:"Puerta" },
    { id:"espejos",   label:"Espejos" },
  ],
  iveco_cursor: [
    { id:"bateria",     label:"Batería" },
    { id:"tapaCombUrea",label:"Tapa comb./urea" },
    { id:"matafuego",   label:"Matafuego" },
    { id:"auxilio",     label:"Auxilio" },
    { id:"hidraulico",  label:"Hidráulico" },
    { id:"espejos",     label:"Espejos" },
  ],
  iveco_tector: [
    { id:"bateria",     label:"Batería" },
    { id:"stereo",      label:"Stereo" },
    { id:"tapaCombUrea",label:"Tapa comb./urea" },
    { id:"auxilio",     label:"Auxilio" },
    { id:"lona",        label:"Lona" },
    { id:"estructura",  label:"Estructura" },
    { id:"espejos",     label:"Espejos" },
  ],
  taller: [
    { id:"bateria",   label:"Batería" },
    { id:"auxilio",   label:"Auxilio" },
    { id:"matafuego", label:"Matafuego" },
    { id:"tapaComb",  label:"Tapa comb." },
    { id:"espejos",   label:"Espejos" },
  ],
  camioneta: [
    { id:"auxilio",   label:"Auxilio" },
    { id:"matafuego", label:"Matafuego" },
    { id:"tapaComb",  label:"Tapa comb." },
    { id:"rejas",     label:"Rejas" },
    { id:"patente",   label:"Patentes" },
    { id:"espejos",   label:"Espejos" },
  ],
  transit: [
    { id:"matafuego", label:"Matafuego" },
    { id:"auxilio",   label:"Auxilio" },
    { id:"tapaComb",  label:"Tapa comb." },
    { id:"identif",   label:"Identificable" },
    { id:"espejos",   label:"Espejos" },
  ],
  carretonable: [
    { id:"ruedas",    label:"Ruedas" },
    { id:"matafuego", label:"Matafuego" },
    { id:"dominio",   label:"Dominio" },
  ],
  moto: [
    { id:"bateria",  label:"Batería" },
    { id:"patente",  label:"Patentes" },
    { id:"cadena",   label:"Cadena" },
    { id:"matafuego",label:"Matafuego" },
    { id:"espejos",  label:"Espejos/Cachas" },
  ],
  iveco_nuevo: [
    { id:"bateria",     label:"Batería" },
    { id:"tapaCombUrea",label:"Tapa comb./urea" },
    { id:"auxilio",     label:"Auxilio" },
    { id:"matafuego",   label:"Matafuego" },
    { id:"luces",       label:"Luces" },
    { id:"espejos",     label:"Espejos" },
  ],
  container: [
    { id:"bombaAgua", label:"Bomba agua" },
    { id:"ac",        label:"Aire AC" },
    { id:"reflector", label:"Reflectores" },
    { id:"balizas",   label:"Balizas" },
  ],
  no_ident: [],
};

const FIELD_ICONS = {
  stereo:"🔊", bateria:"🔋", tapaComb:"⛽", tapaCombUrea:"⛽",
  matafuego:"🧯", auxilio:"🔧", ac:"❄️", puerta:"🚪",
  espejos:"🪟", hidraulico:"💧", lona:"🧻", estructura:"🏗️",
  rejas:"⬜", patente:"🔖", identif:"🏷️", ruedas:"⚙️",
  dominio:"📋", cadena:"⛓️", luces:"💡", bombaAgua:"🪣",
  reflector:"🔦", balizas:"🚨"
};

// ════════════════════════════════════════════
//  SECCIONES Y VEHÍCULOS
// ════════════════════════════════════════════
// Flota hardcodeada como fallback offline — se sobreescribe con datos de Supabase en initApp()
const SECTIONS_FALLBACK = [
  { id:"sec1",    label:"1ª Sección",    type:"movil_std",    vehicles:[
    {ro:"28425"},{ro:"28455"},{ro:"28459"},{ro:"28460"},
    {ro:"28512"},{ro:"28538"},{ro:"28541"},{ro:"28544"}
  ]},
  { id:"sec2",    label:"2ª Sección",    type:"movil_std",    vehicles:[
    {ro:"28521"},{ro:"28524"},{ro:"28526"},{ro:"28533"},
    {ro:"28535"},{ro:"28543"},{ro:"28545"},{ro:"28547"},{ro:"28550"}
  ]},
  { id:"sec3",    label:"3ª Sección",    type:"movil_std",    vehicles:[
    {ro:"28427"},{ro:"28437"},{ro:"28457"},{ro:"28525"},
    {ro:"28527"},{ro:"28529"},{ro:"28540"},{ro:"28549"}
  ]},
  { id:"secSin",  label:"Sin Sección",   type:"movil_std",    vehicles:[
    {ro:"28423"},{ro:"28430"},{ro:"28436"},{ro:"28453"},
    {ro:"28537"},{ro:"28542"},{ro:"28546"},{ro:"28551"}
  ]},
  { id:"secIC",   label:"IVECO Cursor",  type:"iveco_cursor", vehicles:[
    {ro:"28496"},{ro:"28501"},{ro:"29498"}
  ]},
  { id:"secIT",   label:"IVECO Tector",  type:"iveco_tector", vehicles:[
    {ro:"28463"},{ro:"28464"},{ro:"28465"},{ro:"28466"},{ro:"28467"},
    {ro:"28468"},{ro:"28556"},{ro:"28557"},{ro:"28558"},{ro:"28480"}
  ]},
  { id:"secIN",   label:"IVECO Nuevos",  type:"iveco_nuevo",  vehicles:[
    {ro:"33019",modelo:"Cursor"},{ro:"33020",modelo:"Cursor"},
    {ro:"33022",modelo:"Cursor"},{ro:"33023",modelo:"Cursor"},
    {ro:"33024",modelo:"Cursor"},{ro:"33037",modelo:"Cursor"},
    {ro:"33038",modelo:"Tector"},{ro:"33055",modelo:"Tector"}
  ]},
  { id:"secTall", label:"Talleres",      type:"taller",       vehicles:[
    {ro:"28552",modelo:"IVECO Furgón"},{ro:"33071",modelo:"Tector"}
  ]},
  { id:"secCam",  label:"Camionetas",    type:"camioneta",    vehicles:[
    {ro:"26583",modelo:"Hilux"},{ro:"30720",modelo:"Hilux"},
    {ro:"33447",modelo:"Nissan"},{ro:"33483",modelo:"Nissan"},{ro:"45732",modelo:"Hilux"}
  ]},
  { id:"secTrans",label:"Transit",       type:"transit",      vehicles:[
    {ro:"34829",modelo:"Ford Transit"},{ro:"34831",modelo:"Ford Transit"},
    {ro:"34832",modelo:"Ford Transit"},{ro:"33029",modelo:"Ford Transit"}
  ]},
  { id:"secCar",  label:"Carretones",    type:"carretonable", vehicles:[
    {ro:"28590",marca:"COMETO",dominio:"AF066GC"},
    {ro:"CHASIS 0162",marca:"VIAL ERG",dominio:""}
  ]},
  { id:"secMoto", label:"Motos",         type:"moto",         vehicles:[
    {ro:"24153",modelo:"Corven Triax negra"},{ro:"28640",modelo:"Corven Triax blanca"}
  ]},
  { id:"secCont", label:"Containers",    type:"container",    vehicles:[
    {ro:"0004",  marca:"CSB",              modelo:"Simple"},
    {ro:"0012",  marca:"CSB",              modelo:"Simple"},
    {ro:"0062",  marca:"CSB",              modelo:"Blindado"},
    {ro:"MANT",  marca:"CSB",              modelo:"Blindado"},
    {ro:"AG257DM",marca:"American Trailers",modelo:"Unidad ministro"},
    {ro:"61878", marca:"Basani",           modelo:"Oficina móvil"},
    {ro:"61879", marca:"Basani",           modelo:"Oficina móvil"}
  ]},
  { id:"secNoId", label:"No Identific.", type:"no_ident",     vehicles:[
    {ro:"NDA061",  marca:"FORD",       modelo:"Ranger"},
    {ro:"MDH684",  marca:"FORD",       modelo:"Mondeo"},
    {ro:"AD419LC", marca:"FORD",       modelo:"Focus"},
    {ro:"AD419LV", marca:"FORD",       modelo:"Focus"},
    {ro:"AD444NB", marca:"FORD",       modelo:"Focus"},
    {ro:"AE493SH", marca:"FORD",       modelo:"Ranger Limited"},
    {ro:"AA584PL", marca:"TOYOTA",     modelo:"Camry"},
    {ro:"AC385YP", marca:"TOYOTA",     modelo:"Camry"},
    {ro:"AC419OE", marca:"TOYOTA",     modelo:"Camry"},
    {ro:"AC419OD", marca:"TOYOTA",     modelo:"Camry"},
    {ro:"AA827VK", marca:"TOYOTA",     modelo:"Camry"},
    {ro:"AA584PR", marca:"TOYOTA",     modelo:"Camry"},
    {ro:"AA723IA", marca:"TOYOTA",     modelo:"Camry"},
    {ro:"JNM903",  marca:"TOYOTA",     modelo:"Corolla"},
    {ro:"AA717ZA", marca:"TOYOTA",     modelo:"SW4"},
    {ro:"AA717B",  marca:"TOYOTA",     modelo:"SW4"},
    {ro:"AD075ZD", marca:"TOYOTA",     modelo:"Hilux"},
    {ro:"NDA218",  marca:"TOYOTA",     modelo:"Hilux"},
    {ro:"AC155IJ", marca:"RAM",        modelo:"Ram"},
    {ro:"AA053QB", marca:"RENAULT",    modelo:"Kangoo"},
    {ro:"AH964BI", marca:"RENAULT",    modelo:"Duster"},
    {ro:"AH160WP", marca:"VOLKSWAGEN", modelo:"Amarok"},
    {ro:"AH199HF", marca:"VOLKSWAGEN", modelo:"Amarok"},
    {ro:"AH202FH", marca:"VOLKSWAGEN", modelo:"Amarok"},
    {ro:"AH202GO", marca:"VOLKSWAGEN", modelo:"Amarok"},
    {ro:"AG110SH", marca:"VOLKSWAGEN", modelo:"Amarok"},
    {ro:"AA778GU", marca:"VOLKSWAGEN", modelo:"Up"},
    {ro:"AH166UO", marca:"PEUGEOT",    modelo:"208"},
    {ro:"AE129OY", marca:"AGRALE",     modelo:"4x4"},
    {ro:"A080NZR", marca:"BMW",        modelo:"Moto"},
    {ro:"A109TWC", marca:"BMW",        modelo:"Moto"},
  ]},
];

// Copia mutable que se sobreescribe con datos de Supabase — fallback al hardcode si offline
let SECTIONS = SECTIONS_FALLBACK.map(s => ({ ...s, vehicles: [...s.vehicles] }));

// ════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════
let state = { fecha:"", oficial:"", ayudante:"", vehicles:{}, personal:{}, extras:[], vacaciones:{}, eliminados:[] };
let activeSec   = SECTIONS[0].id;
let currentKey  = null;
let currentEfId = null;
let currentTab  = 1;

// ════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════
async function initApp() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("inpFecha").value = today;
  loadEliminados();  // cargar bajas persistentes ANTES de loadStorage
  loadStorage();     // si hay datos de hoy, los carga; si son de ayer, los ignora

  // ── Cargar flota desde Supabase — timeout 6 s ────────────────
  setNubeStatus("saving", "Cargando flota...");
  let flotaOffline = false;
  try {
    const withTimeout6 = p => Promise.race([p, new Promise((_,rej) => setTimeout(()=>rej(new Error("timeout")),6000))]);
    await withTimeout6(cargarFlotaDesdeNube());
  } catch(e) {
    console.error("[DI.PRO.TRAN] cargarFlota timeout/error:", e?.message || e);
    flotaOffline = true;
  }

  buildSecNav();
  renderList(activeSec);
  updateProgress();
  updateSummary();
  updateHeaderDate();
  poblarSelectOficial();
  poblarSelectAyudante();
  poblarSelectJerarquias();
  renderPersonal("");
  // Cargar perfiles de personal desde la nube — timeout 8 s
  setNubeStatus("saving", "Cargando personal...");
  const TIMEOUT_MS = 8000;
  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise((_,rej) => setTimeout(()=>rej(new Error("timeout")), ms))]);

  let personalOffline = false;
  try {
    await withTimeout(cargarPersonalDesdeNube(), TIMEOUT_MS);
  } catch(e) {
    console.error("[DI.PRO.TRAN] cargarPersonal timeout/error:", e?.message || e);
    personalOffline = true;
  }
  poblarSelectOficial();
  poblarSelectAyudante();

  // ── Restaurar vacaciones vigentes desde perfiles de Supabase ──────────────
  // DEBE ejecutarse ANTES de aplicarDefaultsGuardia() para que los titulares
  // ausentes (JPK/vacaciones) no se seleccionen como default.
  // state.personal arranca vacío cada día, pero los perfiles de PERSONAL_BASE
  // tienen vacHasta (sincronizado por saveEfectivo). Si la fecha sigue vigente,
  // restaurar la función para que el calendario, el dashboard y el modal
  // muestren JPK correctamente sin necesidad de cargar el informe anterior.
  const hoyInit = new Date().toISOString().split("T")[0];
  PERSONAL_BASE.forEach(ef => {
    if (ef.vacHasta && ef.vacHasta >= hoyInit) {
      if (!state.personal[ef.id]) state.personal[ef.id] = {};
      // Solo restaurar si no hay asignación manual del día
      if (!state.personal[ef.id].funcion) {
        state.personal[ef.id].funcion   = "vacaciones";
        state.personal[ef.id].vacHasta  = ef.vacHasta;
      }
    }
  });

  aplicarDefaultsGuardia(); // auto-completar titular o suplente si están vacíos

  renderPersonal("");
  // NO se carga el último informe automáticamente —
  // el usuario puede hacerlo desde "Cargar informe anterior" en el Tab 1
  if (flotaOffline && personalOffline) {
    setNubeStatus("error", "⚠ Modo offline");
  } else if (flotaOffline || personalOffline) {
    setNubeStatus("saving", "⚠ Conexión parcial");
  } else {
    setNubeStatus("online", "Conectado");
  }
  renderCalendario();
  // Mostrar badge si hay items en cola + intentar sincronizar
  actualizarIndicadorCola();
  if (getColaOffline().length > 0 && navigator.onLine) procesarColaOffline();
  updateStepIndicator(1);
  renderGuardiaBanner();
}

window.addEventListener("load", () => {
  initSupabase();
  // Guard: si el SDK no cargó, supaClient es null y llamar .auth crashea silenciosamente
  if (!supaClient) {
    console.error("[DI.PRO.TRAN] supaClient es null después de initSupabase() — el SDK de Supabase no cargó correctamente.");
    // La pantalla de login ya está visible por defecto; el usuario verá el status "SDK no disponible"
    return;
  }
  // Escuchar cambios de sesión de Supabase Auth
  supaClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      // Leer rol y email del usuario autenticado
      currentUserEmail = session.user.email || "";
      currentUserRol   = session.user.user_metadata?.rol || "oficial";
      aplicarRestriccionesRol();

      // Usuario autenticado: ocultar login y lanzar la app (solo una vez)
      document.getElementById("loginScreen").style.display = "none";
      if (!appInited) {
        appInited = true;
        await initApp();
      }
    } else {
      // Sin sesión: mostrar login, resetear flag
      currentUserRol   = "oficial";
      currentUserEmail = "";
      appInited = false;
      document.getElementById("loginScreen").style.display = "";
    }
  });
});

// ── Ayudante de guardia: desplegable dinámico ──────────────────
function poblarSelectAyudante() {
  const sel = document.getElementById("inpAyudante");
  if (!sel) return;

  // Limpiar opciones excepto el placeholder
  while (sel.options.length > 1) sel.remove(1);

  // Agregar todos los efectivos del personal base
  const todos = [...PERSONAL_BASE, ...(state.personalExtra||[])];
  todos.forEach(ef => {
    if (ef.funcion_base === "of_servicio") return; // El Oficial de Servicio titular no actúa como ayudante
    const opt = document.createElement("option");
    opt.value = `${ef.jerarquia} ${ef.nombre}`;
    opt.textContent = `${ef.jerarquia} ${ef.nombre}`;
    if (state.ayudante === opt.value) opt.selected = true;
    sel.appendChild(opt);
  });

  // Opción de agregar nuevo
  const optNuevo = document.createElement("option");
  optNuevo.value = "__nuevo__";
  optNuevo.textContent = "➕ Agregar nuevo ayudante...";
  sel.appendChild(optNuevo);

  // Si hay un ayudante guardado que no está en la lista, agregarlo
  if (state.ayudante && state.ayudante !== "__nuevo__") {
    const existe = [...sel.options].some(o => o.value === state.ayudante);
    if (!existe) {
      const opt = document.createElement("option");
      opt.value = state.ayudante;
      opt.textContent = state.ayudante;
      opt.selected = true;
      sel.insertBefore(opt, sel.lastChild);
    }
  }
}

// ── Auto-completar titulares fijos cuando el state no tiene valor ────────────
// Lógica:
//  1. Si el titular (Villalba / Cabral) está presente (sin función de ausencia), usarlo.
//  2. Si el titular está ausente, buscar quién tiene of_servicio / ayudante en state.personal.
//  3. Si nadie tiene el rol asignado explícitamente, dejar vacío para que el usuario elija.
// Solo actúa si el campo está vacío (no pisa una elección manual ya guardada).
const _AUSENTES_SET = new Set(["vacaciones","licencia","lic_especial","baja_med","desafect","inactividad","franco","disponib","act_limit"]);

function _efEstaAusente(efId) {
  const d = state.personal[efId] || {};
  const func = d.funcion;
  if (func && _AUSENTES_SET.has(func)) return true;
  // También chequear vacHasta vigente en state o perfil base (como villalbaAusente)
  const hoy = new Date().toISOString().split("T")[0];
  const ef  = PERSONAL_BASE.find(p => p.id === efId);
  const vacHasta = d.vacHasta || ef?.vacHasta || "";
  return vacHasta && vacHasta >= hoy;
}

function aplicarDefaultsGuardia() {
  const todos = [...PERSONAL_BASE, ...(state.personalExtra||[])];

  if (!state.oficial) {
    // Buscar el titular por nombre
    const palabrasOf = DEFAULT_OFICIAL_NOMBRE.toUpperCase().split(" ");
    const titularOf  = todos.find(e => palabrasOf.every(p => e.nombre.toUpperCase().includes(p)));

    if (titularOf && !_efEstaAusente(titularOf.id)) {
      // Titular disponible → usarlo
      state.oficial = `${titularOf.jerarquia}. ${titularOf.nombre}`;
    } else {
      // Titular ausente → cadena de suplencia:
      // 1. Alguien con of_servicio asignado explícitamente hoy
      // 2. El enc_tercio (Ayala) si está disponible — suplente natural
      const suplente = todos.find(e => state.personal[e.id]?.funcion === "of_servicio")
                    || todos.find(e => e.funcion_base === "enc_tercio" && !_efEstaAusente(e.id));
      if (suplente) state.oficial = `${suplente.jerarquia}. ${suplente.nombre}`;
      // Si nadie está disponible, dejar vacío — el usuario deberá elegir
    }
    const selOf = document.getElementById("inpOficial");
    if (selOf && state.oficial) selOf.value = state.oficial;
  }

  if (!state.ayudante) {
    const palabrasAy = DEFAULT_AYUDANTE_NOMBRE.toUpperCase().split(" ");
    const titularAy  = todos.find(e => palabrasAy.every(p => e.nombre.toUpperCase().includes(p)));

    if (titularAy && !_efEstaAusente(titularAy.id)) {
      state.ayudante = `${titularAy.jerarquia} ${titularAy.nombre}`;
    } else {
      const suplente = todos.find(e => state.personal[e.id]?.funcion === "ayudante");
      if (suplente) state.ayudante = `${suplente.jerarquia} ${suplente.nombre}`;
    }
    const selAy = document.getElementById("inpAyudante");
    if (selAy && state.ayudante) selAy.value = state.ayudante;
  }
}

// ── Oficial de Servicio: desplegable dinámico ────────────────
function poblarSelectOficial() {
  const sel = document.getElementById("inpOficial");
  if (!sel) return;

  // Mantener solo el placeholder
  while (sel.options.length > 1) sel.remove(1);

  // Mostrar TODO el personal — cualquiera puede cubrir el rol ante una ausencia
  const todos = [...PERSONAL_BASE, ...(state.personalExtra||[])];
  todos.forEach(ef => {
    const opt = document.createElement("option");
    opt.value = `${ef.jerarquia}. ${ef.nombre}`;
    opt.textContent = `${ef.jerarquia}. ${ef.nombre}`;
    if (state.oficial === opt.value) opt.selected = true;
    sel.appendChild(opt);
  });

  // Si el valor guardado no está en la lista (ej: efectivo dado de baja), agregarlo igual
  if (state.oficial) {
    const existe = [...sel.options].some(o => o.value === state.oficial);
    if (!existe) {
      const opt = document.createElement("option");
      opt.value = state.oficial;
      opt.textContent = state.oficial;
      opt.selected = true;
      sel.insertBefore(opt, sel.options[1]);
    }
  }
}

function poblarSelectJerarquias() {
  const sel = document.getElementById("nuevoAyJerarquia");
  if (!sel) return;
  JERARQUIAS_LIST.forEach(j => {
    const opt = document.createElement("option");
    opt.value = j.abrev;
    opt.textContent = `${j.abrev} — ${j.label}`;
    sel.appendChild(opt);
  });
  const selEsc = document.getElementById("nuevoAyEscalafon");
  if (!selEsc) return;
  ESCALAFONES.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.abrev;
    opt.textContent = `${e.abrev} ${e.label}`;
    selEsc.appendChild(opt);
  });
}

function onAyudanteChange(sel) {
  if (sel.value === "__nuevo__") {
    document.getElementById("nuevoAyudanteForm").style.display = "block";
    sel.value = "";
  } else {
    document.getElementById("nuevoAyudanteForm").style.display = "none";
    state.ayudante = sel.value;
    saveStorage();
    updateHeaderDate();
  }
}

function guardarNuevoAyudante() {
  const jer    = document.getElementById("nuevoAyJerarquia")?.value;
  const esc    = document.getElementById("nuevoAyEscalafon")?.value;
  const legajo = document.getElementById("nuevoAyLegajo")?.value.trim();
  const nombre = document.getElementById("nuevoAyNombre")?.value.trim();
  if (!jer || !nombre || !legajo) { alert("Completá jerarquía, legajo y nombre."); return; }
  const jerInfo  = JERARQUIAS_LIST.find(j=>j.abrev===jer);
  const newEf = {
    id: "px_ay_"+Date.now(), ord:99,
    jerarquia:jer, escalafon:esc||jerInfo?.esc||"E.G.",
    subescalafon: esc==="CDO."?"Comando":"General",
    legajo, nombre,
    destino:"Direc. Prov. Transp.",
    calle:"—", localidad:"—", partido:"—", fechaNac:"—", fechaIngreso:"—",
    licHab:"—", armamento:"—", chaleco:"—", criaJurisd:"—",
    grupoSanguineo:"—", cel:"—", email:"—",
    situacionRevista:"servicio_activo", nota:"",
    funcion_base:"ayudante",
  };
  if (!state.personalExtra) state.personalExtra = [];
  state.personalExtra.push(newEf);
  PERSONAL_BASE.push(newEf);
  saveStorage();
  state.ayudante = `${jer} ${nombre}`;
  document.getElementById("nuevoAyudanteForm").style.display = "none";
  poblarSelectAyudante();
  document.getElementById("inpAyudante").value = state.ayudante;
  showToast("✓ Ayudante agregado");
}

function cancelarNuevoAyudante() {
  document.getElementById("nuevoAyudanteForm").style.display = "none";
  poblarSelectAyudante();
}

// ── Validación de roles únicos ─────────────────────────────────
function validarRolUnico(efId, rolId) {
  // Si el rol es único, verificar que nadie más lo tenga
  const rolDef = FUNCIONES.find(f=>f.id===rolId);
  if (!rolDef || !rolDef.unico) return true; // no es único, OK
  const todos = [...PERSONAL_BASE, ...(state.personalExtra||[])];
  const conflicto = todos.find(ef => {
    if (ef.id === efId) return false;
    const d = state.personal[ef.id]||{};
    const f = d.funcion || ef.funcion_base || "chofer";
    return f === rolId;
  });
  if (conflicto) {
    alert(`⚠️ El rol "${rolDef.label}" ya está asignado a ${conflicto.nombre}.\nSolo puede haber uno por guardia.`);
    return false;
  }
  return true;
}

// ── Ordenamiento del personal por rol y antigüedad ─────────────
// Detectar si el Oficial de Servicio titular está ausente (JPK/vacaciones)
// Genérico: busca por funcion_base='of_servicio' en PERSONAL_BASE, no por ID hardcodeado
function villalbaAusente() {
  const ef = PERSONAL_BASE.find(p => p.funcion_base === "of_servicio");
  if (!ef) return false;
  const d   = state.personal[ef.id] || {};
  const hoy = new Date().toISOString().split("T")[0];
  const vacHasta = d.vacHasta || ef?.vacHasta || "";
  if (vacHasta && vacHasta >= hoy) return true;
  return (d.funcion || ef?.funcion_base || "") === "vacaciones";
}
// Alias semántico para claridad en el código
const oficialTitularAusente = villalbaAusente;

// Obtener función efectiva de un efectivo (considera ascenso automático)
function getFuncionEfectiva(ef) {
  const d = state.personal[ef.id] || {};
  let func = d.funcion || ef.funcion_base || "chofer";

  // Si tiene vacHasta vigente en el perfil → siempre JPK hasta esa fecha
  const hoy = new Date().toISOString().split("T")[0];
  const vacHasta = d.vacHasta || ef.vacHasta || "";
  if (vacHasta && vacHasta >= hoy) {
    func = "vacaciones";
  }

  // Normalizar valores viejos o desconocidos → chofer (disponible por defecto)
  const validos = FUNCIONES.map(f => f.id);
  if (!validos.includes(func)) func = "chofer";

  // Si el Oficial titular está ausente (JPK), el siguiente enc_tercio asciende a Oficial de Servicio
  if (ef.funcion_base === "enc_tercio" && villalbaAusente()) {
    func = "of_servicio";
  }
  return func;
}

function ordenarPersonal(lista) {
  const orden = { of_servicio:0, ayudante:1, enc_tercio:2, chofer:3 };
  return lista.slice().sort((a, b) => {
    const fa = getFuncionEfectiva(a);
    const fb = getFuncionEfectiva(b);
    const oa = orden[fa] ?? 10;
    const ob = orden[fb] ?? 10;
    if (oa !== ob) return oa - ob;
    const la = parseInt((a.legajo||"").replace(/[^0-9]/g,""))||999999;
    const lb = parseInt((b.legajo||"").replace(/[^0-9]/g,""))||999999;
    return la - lb;
  });
}

// ── Eliminados: persistencia propia (independiente del turno) ──────────────
function loadEliminados() {
  try {
    const s = localStorage.getItem("dpt_eliminados");
    state.eliminados = s ? JSON.parse(s) : [];
  } catch(e) { state.eliminados = []; }
}
function saveEliminados() {
  try {
    localStorage.setItem("dpt_eliminados", JSON.stringify(state.eliminados || []));
  } catch(e) {}
}

function _loadVacaciones() {
  // Carga vacaciones desde clave independiente — sobrevive al cambio de día
  try {
    const vac = localStorage.getItem(VAC_KEY);
    if (!vac) return;
    const parsed = JSON.parse(vac);
    if (parsed && typeof parsed === "object") {
      // Merge: dpt_vac tiene prioridad sobre lo que ya esté en state.vacaciones
      state.vacaciones = { ...state.vacaciones, ...parsed };
    }
  } catch(e) {}
}
function loadStorage() {
  try {
    const s = localStorage.getItem("dpt_v4");
    if (!s) {
      _loadVacaciones(); // aunque no haya estado diario, restaurar vacaciones
      return;
    }
    const p = JSON.parse(s);
    // Si los datos guardados son de un día distinto, ignorar (arranque limpio)
    const today = new Date().toISOString().split("T")[0];
    if (p.fecha && p.fecha !== today) {
      dbg("Datos de día anterior detectados — iniciando guardia limpia");
      _loadVacaciones(); // restaurar vacaciones incluso al descartar el estado viejo
      return;
    }
    state = { ...state, ...p };
    _loadVacaciones(); // dpt_vac prevalece sobre lo guardado en dpt_v4
    if (state.fecha)    document.getElementById("inpFecha").value    = state.fecha;
    if (state.oficial)  document.getElementById("inpOficial").value  = state.oficial;
    if (state.ayudante) document.getElementById("inpAyudante").value = state.ayudante;
    if (state.extras && state.extras.length) {
      state.extras.forEach(e => {
        const sec = SECTIONS.find(s=>s.id===e.secId);
        if (sec && !sec.vehicles.find(v=>v.ro===e.v.ro)) sec.vehicles.push({...e.v});
      });
    }
    // personalExtra ya no se persiste en localStorage (viene de Supabase al loguearse)
  } catch(e){}
}
function saveVacaciones() {
  // Persiste vacaciones en clave propia — sobrevive al reset diario de dpt_v4
  try {
    if (state.vacaciones && Object.keys(state.vacaciones).length > 0) {
      localStorage.setItem(VAC_KEY, JSON.stringify(state.vacaciones));
    }
  } catch(e) {}
}
function saveStorage() {
  try {
    // Guardar solo datos operativos del turno — NO datos permanentes del personal ni eliminados
    const { personalExtra: _pe, eliminados: _el, ...draftState } = state;
    localStorage.setItem("dpt_v4", JSON.stringify(draftState));
  } catch(e) {
    dbgW("Error al guardar en localStorage (cuota llena?):", e);
    if (typeof showToast === "function") showToast("⚠️ No se pudo guardar el borrador localmente");
  }
  saveVacaciones(); // siempre persistir vacaciones por separado
  scheduleAutoSave();
}

function updateHeaderDate() {
  // Siempre mostrar la fecha y hora actual del sistema
  const ahora = new Date();
  const d = String(ahora.getDate()).padStart(2,"0");
  const m = String(ahora.getMonth()+1).padStart(2,"0");
  const y = ahora.getFullYear();
  const hh = String(ahora.getHours()).padStart(2,"0");
  const mm = String(ahora.getMinutes()).padStart(2,"0");
  document.getElementById("headerDate").textContent = `${d}/${m}/${y} ${hh}:${mm} — Guardia`;
}

// Actualizar el reloj cada minuto
setInterval(updateHeaderDate, 60000);

// ════════════════════════════════════════════
//  NAVEGACIÓN POR TABS
// ════════════════════════════════════════════
function goTab(n) {
  // Tab Admin solo para jefes
  if (n === 6 && currentUserRol !== "jefe") {
    showToast("⛔ Acceso restringido — solo Jefes");
    return;
  }
  // Sincronizar encabezado sin bloquear navegación
  syncStep1();
  currentTab = n;
  cerrarDetalleHistorial(); // cerrar overlay de detalle al cambiar de tab
  document.querySelectorAll(".step").forEach((el,i)    => el.classList.toggle("active", i+1===n));
  document.querySelectorAll(".nav-item").forEach((el,i) => el.classList.toggle("active", i+1===n));
  if (n===1) renderGuardiaBanner();
  if (n===3) fillPreview();
  if (n===4) renderDashboard();
  if (n===5) renderPersonal(document.getElementById("searchPersonal")?.value||"");
  if (n===6) renderAdminFlota();
  if (n===7) renderHistorialTab();
  // QA-010: mostrar barra de progreso solo en tabs de relevamiento (1-4)
  const progWrap = document.getElementById("progWrap");
  if (progWrap) progWrap.style.display = (n <= 4) ? "" : "none";
  // Actualizar step indicator
  updateStepIndicator(n);
  window.scrollTo(0,0);
}

// Sincroniza los campos del encabezado con el state (sin bloquear)
function syncStep1() {
  const f = document.getElementById("inpFecha").value;
  const o = document.getElementById("inpOficial").value;
  const a = document.getElementById("inpAyudante").value.trim();
  if (f) state.fecha    = f;
  if (o) state.oficial  = o;
  if (a) state.ayudante = a;
  saveStorage();
  renderGuardiaBanner();
}

// Valida que los responsables estén completos (para generar informe)
function validateResponsables() {
  const f = state.fecha    || document.getElementById("inpFecha").value;
  const o = state.oficial  || document.getElementById("inpOficial").value;
  const a = (state.ayudante || document.getElementById("inpAyudante").value || "").trim();
  if (!f||!o||!a) {
    alert("Para generar el informe completá: fecha, oficial de servicio y ayudante de guardia.");
    goTab(1);
    return false;
  }
  return true;
}

function renderGuardiaBanner() {
  const banner = document.getElementById("guardiaStatusBanner");
  if (!banner) return;

  const oficial  = state.oficial  || "";
  const ayudante = state.ayudante || "";
  const fecha    = state.fecha    || "";
  const iniciada = oficial && ayudante && fecha;

  const total = countTotal ? countTotal() : 0;
  const done  = countDone  ? countDone()  : 0;
  const pend  = total - done;

  if (!iniciada) {
    // Sin datos: guardia no iniciada
    banner.className = "rounded-xl p-3 mb-3 mt-2 flex items-center gap-2.5 bg-green-50 border border-green-200";
    banner.innerHTML = `
      <span class="text-[18px] leading-none">🟢</span>
      <div>
        <div class="font-display text-[9px] font-bold uppercase tracking-wider text-green-700">Guardia no iniciada</div>
        <div class="text-[10px] text-green-800 mt-0.5">Completá oficial, ayudante y fecha para comenzar</div>
      </div>`;
  } else {
    // Guardia activa: mostrar estado
    const nombreCorto = oficial.split(" ").slice(0,3).join(" ");
    banner.className = "rounded-xl p-3 mb-3 mt-2 flex items-center justify-between gap-2";
    banner.style.background = "linear-gradient(135deg, #003580, #0050b3)";
    banner.innerHTML = `
      <div>
        <div class="font-display text-[9px] font-bold uppercase tracking-wider" style="color:rgba(255,255,255,.55)">🟢 Guardia activa</div>
        <div class="font-strong text-[12px] font-bold text-white mt-0.5">${escapeHTML(nombreCorto)}</div>
        <div class="text-[9px] mt-1" style="color:rgba(255,255,255,.55)">Ay: ${escapeHTML(ayudante.split(" ").slice(0,3).join(" "))} · ${escapeHTML(fecha)}</div>
      </div>
      <div class="text-right flex-shrink-0">
        <div class="font-display text-[8px] uppercase tracking-wider" style="color:rgba(255,255,255,.5)">Móviles</div>
        <div class="font-display text-[22px] font-black leading-none" style="color:${pend > 0 ? "#86efac" : "#4ade80"}">${done}/${total}</div>
        <div class="text-[8px] mt-0.5" style="color:rgba(255,255,255,.4)">${pend > 0 ? pend + " pendientes" : "✓ Completo"}</div>
      </div>`;
  }

  // Mostrar/ocultar CTA de continuar
  const btnContinuar = document.getElementById("btnContinuarMoviles");
  const btnSub       = document.getElementById("btnContinuarSub");
  if (btnContinuar) {
    if (iniciada && pend > 0) {
      btnContinuar.style.display = "flex";
      if (btnSub) btnSub.textContent = `Quedan ${pend} móviles sin relevar`;
    } else {
      btnContinuar.style.display = "none";
    }
  }
}

function updateStepIndicator(n) {
  // Solo visible en tabs 1, 2 y 3
  const el = document.getElementById("stepIndicator");
  if (!el) return;
  el.style.display = (n >= 1 && n <= 3) ? "flex" : "none";

  const steps = [1, 2, 3];
  steps.forEach(i => {
    const pip  = document.getElementById(`stepPip${i}`);
    const lbl  = document.getElementById(`stepLbl${i}`);
    const line = document.getElementById(`stepLine${i}`);
    if (!pip) return;

    if (i < n) {
      // Completado
      pip.className  = "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black font-display bg-green-600 text-white";
      pip.textContent = "✓";
      lbl.className  = "text-[8px] font-display font-bold uppercase tracking-wider text-green-600";
      if (line) line.className = "flex-1 h-px bg-green-600 mx-1.5";
    } else if (i === n) {
      // Activo
      pip.className  = "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black font-display bg-pba-blue text-white";
      pip.textContent = String(i);
      lbl.className  = "text-[8px] font-display font-bold uppercase tracking-wider text-pba-blue";
      if (line) line.className = "flex-1 h-px bg-gray-200 mx-1.5";
    } else {
      // Pendiente
      pip.className  = "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black font-display bg-gray-200 text-pba-grey";
      pip.textContent = String(i);
      lbl.className  = "text-[8px] font-display font-bold uppercase tracking-wider text-pba-grey";
      if (line) line.className = "flex-1 h-px bg-gray-200 mx-1.5";
    }
  });
}

function updateProgress() {
  const total = countTotal(), done = countDone();
  const pct = total > 0 ? Math.round(done/total*100) : 0;
  document.getElementById("progLabel").textContent = `Flota: ${done}/${total}`;
  document.getElementById("progPct").textContent   = pct+"%";
  document.getElementById("progFill").style.width  = pct+"%";
}

// ════════════════════════════════════════════
//  SECTION NAV
// ════════════════════════════════════════════
function buildSecNav() {
  const nav = document.getElementById("secNav");
  nav.innerHTML = "";
  SECTIONS.forEach(sec => {
    const btn = document.createElement("button");
    btn.className = "sec-btn"+(sec.id===activeSec?" active":"");
    btn.textContent = sec.label;
    btn.onclick = () => {
      document.querySelectorAll(".sec-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      activeSec = sec.id;
      renderList(sec.id);
    };
    nav.appendChild(btn);
  });
}

// ════════════════════════════════════════════
//  VEHICLE LIST
// ════════════════════════════════════════════
function renderList(secId) {
  const sec  = SECTIONS.find(s=>s.id===secId);
  const elim = state.eliminados || [];
  const activos = sec.vehicles.filter(v => !elim.includes(secId+"_"+v.ro));
  const bajaCnt = sec.vehicles.length - activos.length;
  const wrap = document.getElementById("vListWrap");
  wrap.innerHTML = `<div class="card">
    <div class="card-title">${sec.label} <span class="badge">${activos.length}</span>${bajaCnt>0?` <span class="v-baja-tag">🚫 ${bajaCnt} de baja</span>`:""}
    </div>
    <div class="vehicle-list" id="vlist"></div>
  </div>`;
  const list = document.getElementById("vlist");
  activos.forEach(v => {
    const key  = secId+"_"+v.ro;
    const d    = state.vehicles[key]||{};
    const done = !!d._done;
    const fields = FIELDS[sec.type]||[];
    let chips = "";
    if (done) {
      if (fields.length > 0) {
        chips = fields.slice(0,3).map(f => {
          const val = d[f.id]||"—";
          const col = OPT_COLORS[val]||"#888";
          return `<span style="color:${col};font-size:10px;font-weight:700">${f.label.split(" ")[0]}:${escapeHTML(val)}</span>`;
        }).join(" · ");
      } else {
        chips = d.obs ? escapeHTML(d.obs.slice(0,45))+(d.obs.length>45?"…":"") : "Sin obs.";
      }
    }
    const subtitle = v.marca ? escapeHTML(`${v.marca} ${v.modelo||""}`.trim()) : escapeHTML(v.modelo||"");
    const item = document.createElement("div");
    item.className = "vehicle-item"+(done?" done":"");
    item.innerHTML = `
      <div>
        <div class="v-ro">${sec.type==="no_ident"?"Dom. ":"RO "}${escapeHTML(v.ro)}${subtitle?" — "+subtitle:""}</div>
        <div class="v-sub">${done ? (chips||"Guardado") : "Sin datos"}</div>
      </div>
      <div class="v-ico">${done?"✅":"⬜"}</div>`;
    item.onclick = () => openModal(secId, v);
    list.appendChild(item);
  });
  updateSummary();
}

// ════════════════════════════════════════════
//  MODAL VEHÍCULO
// ════════════════════════════════════════════
function openModal(secId, v) {
  currentKey = secId+"_"+v.ro;
  const sec  = SECTIONS.find(s=>s.id===secId);
  const d    = state.vehicles[currentKey]||{};
  const sub  = v.marca ? `${v.marca} ${v.modelo||""}`.trim() : (v.modelo||"");
  document.getElementById("mTitle").textContent = `${sec.type==="no_ident"?"Dom.":"RO"} ${v.ro}${sub?" · "+sub:""}`;
  document.getElementById("mBody").innerHTML    = buildFields(sec.type, d);
  document.getElementById("vModal").classList.add("open");
}
function closeModal() {
  document.getElementById("vModal").classList.remove("open");
  currentKey = null;
}

function buildFotoSection(d) {
  let html = `<label class="lbl" style="margin-top:14px">Foto de daño</label><div id="fotoWrap">`;
  if (d.fotoUrl) {
    html += `<img src="${escapeHTML(d.fotoUrl)}" class="foto-preview-img">
    <button class="btn btn-danger btn-sm" onclick="eliminarFotoMovil()">🗑 Quitar foto</button>`;
  } else {
    html += `<div class="foto-upload-area" id="fotoUploadArea" onclick="document.getElementById('fotoInput').click()">
        📷 Tocar para adjuntar foto
      </div>
      <input type="file" id="fotoInput" accept="image/*" capture="environment" style="display:none" onchange="uploadFotoMovil(this)">`;
  }
  return html + `</div>`;
}

function buildFields(type, d) {
  const fields = FIELDS[type]||[];

  if (fields.length === 0) {
    return `<div class="info-box">Este vehículo solo requiere observaciones.</div>
    <label class="lbl" style="margin-top:14px">Observaciones</label>
    <textarea id="f_obs" placeholder="Sin observaciones">${escapeHTML(d.obs||"")}</textarea>
    ${buildFotoSection(d)}`;
  }

  // Barra de progreso (campos ya completados)
  const doneCnt = fields.filter(f => d[f.id] && d[f.id] !== "").length;
  const pct     = Math.round(doneCnt / fields.length * 100);

  let html = `
  <div class="v-prog-wrap">
    <div class="v-prog-track"><div class="v-prog-fill" id="vProgFill" style="width:${pct}%"></div></div>
    <div class="v-prog-txt" id="vProgTxt">${doneCnt}/${fields.length}</div>
  </div>
  <button class="todo-ok-btn" onclick="todoOkMovil()">✓ &nbsp;Todo OK — marcar todo</button>
  <div class="v-divider-lbl">o revisá ítem por ítem</div>
  <div class="v-item-grid">`;

  fields.forEach(f => {
    const cur     = d[f.id]||"";
    const cardCls = cur ? `s-${cur==="N/A"?"na":cur.toLowerCase()}` : "";
    const icon    = FIELD_ICONS[f.id]||"";
    html += `<div class="v-item-card ${cardCls}" id="vc-${f.id}">
      <div class="v-item-name"><span class="v-item-icon" aria-hidden="true">${icon}</span>${escapeHTML(f.label)}</div>
      <div class="v-state-grid">
        ${["OK","NO","Roto","N/A"].map(opt => {
          const key = opt==="N/A"?"na":opt.toLowerCase();
          let cls = `v-sbtn v-sbtn-${key}`;
          if (cur===opt)       cls += " sel";
          else if (cur && cur!==opt) cls += " dim";
          return `<button class="${cls}" onclick="setField(this,'${f.id}','${escapeHTML(opt)}')">${opt}</button>`;
        }).join("")}
      </div>
    </div>`;
  });

  html += `</div>
  <label class="lbl" style="margin-top:4px">Observaciones</label>
  <textarea id="f_obs" placeholder="Sin observaciones">${escapeHTML(d.obs||"")}</textarea>
  ${buildFotoSection(d)}`;

  return html;
}

function setField(btn, fieldId, val) {
  const card = document.getElementById("vc-"+fieldId);
  if (card) {
    // Nueva UI: actualizar botones y color de tarjeta
    card.querySelectorAll(".v-sbtn").forEach(b => {
      b.classList.remove("sel","dim");
      if (b.textContent.trim()===val) b.classList.add("sel");
      else b.classList.add("dim");
    });
    const key = val==="N/A"?"na":val.toLowerCase();
    card.className = `v-item-card s-${key}`;
  } else {
    // Fallback UI antigua (por compatibilidad)
    btn.closest(".status-grid")?.querySelectorAll(".sbtn").forEach(b=>b.className="sbtn");
    btn.className = "sbtn s-"+(val==="N/A"?"na":val.toLowerCase());
  }
  updateVProgBar();
}

function todoOkMovil() {
  if (!currentKey) return;
  const sec    = SECTIONS.find(s=>currentKey.startsWith(s.id+"_"));
  const fields = FIELDS[sec?.type]||[];
  fields.forEach(f => {
    const card = document.getElementById("vc-"+f.id);
    if (!card) return;
    card.className = "v-item-card s-ok";
    card.querySelectorAll(".v-sbtn").forEach(b => {
      b.classList.remove("sel","dim");
      if (b.textContent.trim()==="OK") b.classList.add("sel");
      else b.classList.add("dim");
    });
  });
  updateVProgBar();
}

function updateVProgBar() {
  if (!currentKey) return;
  const sec    = SECTIONS.find(s=>currentKey.startsWith(s.id+"_"));
  const fields = FIELDS[sec?.type]||[];
  const done   = fields.filter(f => document.getElementById("vc-"+f.id)?.querySelector(".v-sbtn.sel")).length;
  const fill   = document.getElementById("vProgFill");
  const txt    = document.getElementById("vProgTxt");
  if (fill) fill.style.width = fields.length ? Math.round(done/fields.length*100)+"%" : "0%";
  if (txt)  txt.textContent  = `${done}/${fields.length}`;
}

function saveVehicle() {
  if (!currentKey) return;
  const sec    = SECTIONS.find(s=>currentKey.startsWith(s.id+"_"));
  const fields = FIELDS[sec.type]||[];
  const d      = { _done:true };
  // Preservar foto si existe en el estado actual
  if (state.vehicles[currentKey]?.fotoUrl) d.fotoUrl = state.vehicles[currentKey].fotoUrl;
  fields.forEach(f => {
    // Nueva UI: leer del v-item-card
    const card   = document.getElementById("vc-"+f.id);
    const active = card?.querySelector(".v-sbtn.sel");
    if (active) {
      d[f.id] = active.textContent.trim();
    } else {
      // Fallback UI antigua
      const grid    = document.querySelector(`[data-field="${f.id}"]`);
      const oldAct  = grid?.querySelector(".sbtn.s-ok,.sbtn.s-no,.sbtn.s-roto,.sbtn.s-na");
      d[f.id] = oldAct ? oldAct.textContent.trim() : "";
    }
  });
  d.obs = document.getElementById("f_obs")?.value.trim()||"";
  d._updatedDate  = state.fecha || new Date().toISOString().split("T")[0];
  d._updatedGuard = state.oficial || "";
  state.vehicles[currentKey] = d;
  saveStorage();
  closeModal();
  renderList(activeSec);
  updateProgress();
  showToast("✓ "+currentKey.split("_").slice(1).join("_")+" guardado");
}

// ════════════════════════════════════════════
//  COUNTS
// ════════════════════════════════════════════
function countTotal() {
  const elim = state.eliminados || [];
  return SECTIONS.reduce((a,s) => a + s.vehicles.filter(v => !elim.includes(s.id+"_"+v.ro)).length, 0);
}
function countDone() {
  const elim = state.eliminados || [];
  return Object.entries(state.vehicles).filter(([k,v]) => v._done && !elim.includes(k)).length;
}
function countNovedades() {
  const elim = state.eliminados || [];
  return Object.entries(state.vehicles).filter(([k,v]) =>
    !elim.includes(k) && v._done && ((v.obs && v.obs.trim() !== "") || v.fotoUrl)
  ).length;
}
function updateSummary() {
  const t=countTotal(), d=countDone();
  document.getElementById("sumTotal").textContent = t;
  document.getElementById("sumDone").textContent  = d;
  document.getElementById("sumPend").textContent  = t-d;
}

// ── Listado de móviles por contador (Total / Completados / Pendientes) ──────
// Se abre al tocar los números del resumen en los tabs Móviles y Exportar.
function verMovilesContados(tipo) {
  const modal = document.getElementById("countModal");
  const title = document.getElementById("countModalTitle");
  const list  = document.getElementById("countModalList");
  if (!modal || !title || !list) return;
  const elim = state.eliminados || [];
  const tituloMap = { total:"🚓 Todos los móviles", done:"✅ Móviles completados", pend:"⏳ Móviles pendientes" };
  title.textContent = tituloMap[tipo] || "Móviles";

  let html = "", count = 0;
  SECTIONS.forEach(sec => {
    const rows = sec.vehicles
      .filter(v => !elim.includes(sec.id + "_" + v.ro))
      .map(v => {
        const key  = sec.id + "_" + v.ro;
        const vd   = state.vehicles[key] || {};
        const done = !!vd._done;
        if (tipo === "done" && !done) return "";
        if (tipo === "pend" && done)  return "";
        count++;
        const sub = v.modelo || v.marca || "";
        const nov = done && ((vd.obs && vd.obs.trim() !== "") || vd.fotoUrl);
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
          <div style="min-width:0"><b>RO ${escapeHTML(v.ro)}</b>${sub ? " — " + escapeHTML(sub) : ""}</div>
          <div style="flex-shrink:0;font-size:11px;font-weight:700;color:${done ? "var(--ok)" : "var(--warn)"}">${nov ? "⚠️ " : ""}${done ? "✔ Completado" : "⏳ Pendiente"}</div>
        </div>`;
      }).join("");
    if (rows) html += `<div class="dash-section" style="margin-top:12px">${escapeHTML(sec.label)}</div>${rows}`;
  });

  list.innerHTML = html || '<div style="text-align:center;color:var(--muted);padding:24px;font-size:13px">No hay móviles en esta categoría</div>';
  const stats = document.getElementById("countModalStats");
  if (stats) stats.textContent = count ? `${count} móvil${count === 1 ? "" : "es"}` : "";
  modal.classList.add("open");
}

function closeCountModal() {
  const modal = document.getElementById("countModal");
  if (modal) modal.classList.remove("open");
}

// ════════════════════════════════════════════
//  PREVIEW
// ════════════════════════════════════════════
// Estado de selección de categorías (se inicializa con todas en true)
const pdfSelection = {
  cats: {},      // secId -> true/false
  personal: true,
  leyenda:  true,
};

// → Ver js/pdf.js (initPdfSelection, buildCatToggleList, toggleCat, toggleExtra, syncExtrasToggle, seleccionarTodasCats, fillPreview)
function nuevaGuardia() {
  // Mostrar acta antes de confirmar — si no hay datos del turno, saltear el acta
  const hayDatos = state.oficial || state.ayudante || countDone() > 0;
  if (hayDatos) {
    mostrarActaPasaje();
  } else {
    confirmarNuevaGuardia();
  }
}

function generarTextoActa() {
  const ahora   = new Date();
  const fecha   = ahora.toLocaleDateString("es-AR", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const hora    = ahora.toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
  const total   = countTotal(), done = countDone(), pend = total - done;

  let txt = `════════════════════════════════\n`;
  txt += `  ACTA DE PASAJE DE GUARDIA\n`;
  txt += `  DI.PRO.TRAN. — 2ª Sección\n`;
  txt += `════════════════════════════════\n`;
  txt += `Fecha/hora de pasaje: ${fecha}, ${hora}\n`;
  txt += `Turno relevado:       ${state.fecha || "—"}\n`;
  txt += `Oficial de servicio:  ${state.oficial || "—"}\n`;
  txt += `Ayudante de guardia:  ${state.ayudante || "—"}\n`;
  txt += `\n`;
  txt += `MÓVILES: ${done}/${total} relevados`;
  if (pend > 0) txt += ` (${pend} pendientes)`;
  txt += `\n`;

  // Recopilar novedades
  const novedades = [];
  const elim = state.eliminados || [];
  SECTIONS.forEach(sec => {
    sec.vehicles.forEach(v => {
      const key = `${sec.id}_${v.ro}`;
      if (elim.includes(key)) return;
      const d = state.vehicles[key] || {};
      if (!d._done) return;
      const campos = Object.entries(d)
        .filter(([k, val]) => !k.startsWith("_") && k !== "obs" && val && val !== "OK" && val !== "N/A");
      if (campos.length || d.obs?.trim()) {
        const isNoId = sec.type === "no_ident";
        const ro     = `${isNoId ? "Dom." : "RO"} ${v.ro}`;
        const sub    = [v.modelo, v.marca].filter(Boolean).join(" ");
        const estado = campos.map(([k, val]) => `${k.toUpperCase()}=${val}`).join(", ");
        novedades.push(`• ${ro}${sub ? " (" + sub + ")" : ""} [${sec.label}]${estado ? " — " + estado : ""}${d.obs?.trim() ? ": " + d.obs.trim() : ""}`);
      }
    });
  });

  if (novedades.length) {
    txt += `\nNOVEDADES (${novedades.length}):\n`;
    txt += novedades.join("\n") + "\n";
  } else {
    txt += `\nSIN NOVEDADES REGISTRADAS\n`;
  }

  // Personal de servicio
  const todos = [...PERSONAL_BASE, ...(state.personalExtra||[])];
  const enServicio = todos.filter(ef => {
    const p = state.personal[ef.id] || {};
    const f = p.funcion || ef.funcion_base;
    return f && !["franco","licencia","lic_especial","vacaciones","baja_med","desafect","inactividad"].includes(f);
  });
  if (enServicio.length) {
    txt += `\nPERSONAL EN SERVICIO (${enServicio.length}):\n`;
    enServicio.forEach(ef => {
      const funcion = FUNCIONES.find(f => f.id === (state.personal[ef.id]?.funcion || ef.funcion_base));
      txt += `• ${ef.jerarquia} ${ef.nombre}${funcion ? " — " + funcion.label : ""}\n`;
    });
  }

  txt += `\n════════════════════════════════\n`;
  return txt;
}

function mostrarActaPasaje() {
  const txt    = generarTextoActa();
  const total  = countTotal(), done = countDone();
  const nov    = countNovedades();
  const pct    = total > 0 ? Math.round(done/total*100) : 0;

  document.getElementById("actaTexto").value = txt;
  document.getElementById("actaResumen").innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
      <div class="sum-box"><div class="num" style="color:var(--blue1)">${done}/${total}</div><div class="lbl">Relevados</div></div>
      <div class="sum-box ${pct===100?"ok-box":""}"><div class="num">${pct}%</div><div class="lbl">Completado</div></div>
      <div class="sum-box ${nov>0?"warn-box-c":""}"><div class="num" style="color:${nov>0?"var(--warn)":"var(--ok)"}">${nov}</div><div class="lbl">Novedades</div></div>
    </div>`;
  document.getElementById("actaModal").classList.add("open");
}

async function copiarActa() {
  const txt = document.getElementById("actaTexto").value;
  try {
    await navigator.clipboard.writeText(txt);
    showToast("📋 Acta copiada al portapapeles");
  } catch {
    document.getElementById("actaTexto").select();
    document.execCommand("copy");
    showToast("📋 Acta copiada");
  }
}

async function compartirActa() {
  const txt = document.getElementById("actaTexto").value;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Acta de pasaje — DI.PRO.TRAN.", text: txt });
      return;
    } catch(e) {
      if (e.name !== "AbortError") dbgW("share:", e);
    }
  }
  // Fallback: abrir WhatsApp Web con el texto
  const url = "https://wa.me/?text=" + encodeURIComponent(txt);
  window.open(url, "_blank");
}

function confirmarNuevaGuardia() {
  document.getElementById("actaModal").classList.remove("open");
  // Remover extras de SECTIONS
  SECTIONS.forEach(sec => {
    sec.vehicles = sec.vehicles.filter(v => !v._extra);
  });
  // Reset completo del turno (eliminados se preservan)
  const eliminadosGuardados = state.eliminados || [];
  state = {
    fecha:      new Date().toISOString().split("T")[0],
    oficial:    "",
    ayudante:   "",
    vehicles:   {},
    personal:   {},
    extras:     [],
    vacaciones: {},
    eliminados: eliminadosGuardados,
  };
  document.getElementById("inpFecha").value    = state.fecha;
  document.getElementById("inpOficial").value  = "";
  document.getElementById("inpAyudante").value = "";
  saveStorage();
  activeSec = SECTIONS[0].id;
  buildSecNav();
  renderList(activeSec);
  updateProgress();
  updateSummary();
  updateHeaderDate();
  renderPersonal("");
  goTab(1);
  renderGuardiaBanner();
  showToast("✅ Nueva guardia iniciada");
}

// Mantenida por compatibilidad (redirige a nuevaGuardia)
function resetAll() { nuevaGuardia(); }

function eliminarMovilActual() {
  if (!currentKey) return;
  const [secId] = currentKey.split("_");
  const ro = currentKey.slice(secId.length + 1);
  const sec = SECTIONS.find(s => s.id === secId);
  if (!sec) return;
  const v = sec.vehicles.find(v2 => v2.ro === ro);
  const label = `${sec.type === "no_ident" ? "Dom." : "RO"} ${ro}`;
  if (!confirm(`¿Dar de baja "${label}" de la flota?\n\nEl móvil dejará de aparecer en los relevamientos.\nPodés restaurarlo desde Flota Completa → Dados de baja.`)) return;
  if (!state.eliminados) state.eliminados = [];
  if (!state.eliminados.includes(currentKey)) {
    state.eliminados.push(currentKey);
    saveEliminados();
  }
  closeModal();
  renderList(activeSec);
  updateProgress();
  updateSummary();
  showToast(`🚫 ${label} dado de baja`);
}

function restaurarMovil(key) {
  state.eliminados = (state.eliminados || []).filter(k => k !== key);
  saveEliminados();
  renderFlotaList();
  updateProgress();
  updateSummary();
  const [secId] = key.split("_");
  const ro = key.slice(secId.length + 1);
  showToast(`✅ RO ${ro} restaurado`);
}

// ════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════
function renderDashboard() {
  const total = countTotal(), done = countDone(), pend = total-done;
  const pct   = total > 0 ? Math.round(done/total*100) : 0;
  const nov   = countNovedades();
  document.getElementById("d-total").textContent    = total;
  document.getElementById("d-done").textContent     = done;
  document.getElementById("d-pct").textContent      = pct+"% del total";
  document.getElementById("d-pend").textContent     = pend;
  document.getElementById("d-novedades").textContent = nov;

  // Personal
  const pStats = getPersonalStats();
  document.getElementById("d-p-guardia").textContent = pStats.guardia;
  document.getElementById("d-p-franco").textContent  = pStats.franco;
  document.getElementById("d-p-servicio").textContent= pStats.servicio;
  document.getElementById("d-p-otros").textContent   = pStats.otros;
  // Mostrar alerta si el Oficial titular está de vacaciones (JPK)
  const alertEl = document.getElementById("ascensoAlert");
  if (alertEl) {
    const ausente = villalbaAusente();
    alertEl.style.display = ausente ? "block" : "none";
    if (ausente) {
      // Texto dinámico: buscar titular y suplente por funcion_base
      const oficial  = PERSONAL_BASE.find(p => p.funcion_base === "of_servicio");
      const suplente = PERSONAL_BASE.find(p => p.funcion_base === "enc_tercio");
      const nomOficial  = oficial  ? `${oficial.jerarquia}. ${oficial.nombre.split(" ")[0]}`  : "Oficial";
      const nomSuplente = suplente ? `${suplente.jerarquia} ${suplente.nombre}` : "siguiente en rango";
      const txtEl = document.getElementById("ascensoAlertTxt");
      if (txtEl) txtEl.innerHTML = `🎖️ ${escapeHTML(nomOficial)} en JPK (vacaciones) — <b>${escapeHTML(nomSuplente)}</b> asciende automáticamente a Oficial de Servicio`;
    }
  }

  // Barras por categoría (excluir vehículos dados de baja)
  const barsEl = document.getElementById("dashCatBars");
  const barsElim = state.eliminados || [];
  const bars = SECTIONS.map(sec => {
    const activos = sec.vehicles.filter(v => !barsElim.includes(sec.id+"_"+v.ro));
    const total = activos.length;
    if (!total) return "";
    const done  = activos.filter(v => !!(state.vehicles[sec.id+"_"+v.ro]||{})._done).length;
    const pct   = total > 0 ? Math.round(done/total*100) : 0;
    const color = pct === 100 ? "#0d6e2f" : pct > 0 ? "#1a73e8" : "#d0d9e8";
    return `<div class="cat-bar-wrap">
      <div class="cat-bar-label">
        <span>${sec.label}</span>
        <span>${done}/${total}</span>
      </div>
      <div class="cat-bar-bg">
        <div class="cat-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>`;
  }).join("");
  barsEl.innerHTML = bars || `<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">Sin datos</div>`;

  // Novedades (excluir vehículos dados de baja)
  const novEl  = document.getElementById("dashNovedades");
  const novElim = state.eliminados || [];
  const novList = [];
  SECTIONS.forEach(sec => {
    sec.vehicles.forEach(v => {
      const key = sec.id+"_"+v.ro;
      if (novElim.includes(key)) return;
      const d   = state.vehicles[key]||{};
      const tieneNovedad = (d._done && d.obs && d.obs.trim()) || d.fotoUrl;
      if (tieneNovedad) {
        const sub    = v.modelo||v.marca||"";
        const isNoId = sec.type === "no_ident";
        const roLabel= `${isNoId ? "Dom." : "RO"} ${v.ro}`;
        novList.push(`<div style="padding:9px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:flex-start;gap:10px">
            ${d.fotoUrl ? `<img src="${escapeHTML(d.fotoUrl)}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer" onclick="verFotoNovedad('${escapeHTML(d.fotoUrl)}')">` : ""}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px;font-family:var(--font-display)">
                ${roLabel}${sub?" — "+escapeHTML(sub):""} <span style="font-weight:400;color:var(--muted);font-size:11px">${escapeHTML(sec.label)}</span>
              </div>
              ${d.obs?.trim() ? `<div style="font-size:12px;margin-top:3px;color:var(--text)">${escapeHTML(d.obs)}</div>` : ""}
              ${d.fotoUrl ? `<div style="font-size:10px;color:var(--ba-teal);font-weight:700;margin-top:3px">📷 Con foto</div>` : ""}
            </div>
          </div>
        </div>`);
      }
    });
  });
  novEl.innerHTML = novList.length
    ? novList.join("")
    : `<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">Sin novedades registradas</div>`;
}

// ════════════════════════════════════════════
//  MODAL FLOTA COMPLETA
// ════════════════════════════════════════════
let flotaFilter = "all";

function openFlotaModal(filter) {
  flotaFilter = filter || "all";
  const titles = {
    all:  "Flota Completa",
    done: "Relevadas Hoy",
    pend: "Sin Relevar",
    nov:  "Con Novedades",
  };
  document.getElementById("flotaModalTitle").textContent = titles[flotaFilter] || "Flota";
  document.getElementById("flotaSearch").value = "";
  buildFlotaFilters();
  renderFlotaList();
  document.getElementById("flotaModal").classList.add("open");
}

function closeFlotaModal() {
  document.getElementById("flotaModal").classList.remove("open");
}

function buildFlotaFilters() {
  const bajaCnt = (state.eliminados || []).length;
  const filters = [
    { id:"all",  label:"Todos" },
    { id:"done", label:"✅ Relevados" },
    { id:"pend", label:"⬜ Sin relevar" },
    { id:"nov",  label:"💬 Con novedades" },
    ...(bajaCnt > 0 ? [{ id:"baja", label:`🚫 Baja (${bajaCnt})` }] : []),
    ...SECTIONS.map(s => ({ id:"sec_"+s.id, label:s.label }))
  ];
  document.getElementById("flotaFilters").innerHTML = filters.map(f =>
    `<button class="ffbtn${flotaFilter===f.id?" active":""}" onclick="setFlotaFilter(event,'${f.id}')">${f.label}</button>`
  ).join("");
}

function setFlotaFilter(e, f) {
  flotaFilter = f;
  document.querySelectorAll(".ffbtn").forEach(b => b.classList.remove("active"));
  e.target.classList.add("active");
  renderFlotaList();
}

function renderFlotaList() {
  const q     = (document.getElementById("flotaSearch")?.value||"").toLowerCase().trim();
  const hoy   = state.fecha || new Date().toISOString().split("T")[0];
  const list  = document.getElementById("flotaList");
  const elim  = state.eliminados || [];
  const items = [];

  // Filtro especial: mostrar dados de baja
  if (flotaFilter === "baja") {
    if (!elim.length) {
      list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">No hay móviles dados de baja</div>`;
      return;
    }
    let html = `<div class="baja-section">
      <div class="baja-section-title">🚫 Móviles dados de baja — ${elim.length} unidad${elim.length!==1?"es":""}</div>`;
    elim.forEach(key => {
      const [secId] = key.split("_");
      const ro = key.slice(secId.length + 1);
      const sec = SECTIONS.find(s => s.id === secId);
      const v   = sec?.vehicles.find(v2 => v2.ro === ro);
      const subtitle = v ? (v.marca ? (v.marca + (v.modelo ? " " + v.modelo : "")) : (v.modelo || "")) : "";
      const roLabel  = sec?.type === "no_ident" ? "Dom." : "RO";
      html += `<div class="baja-item">
        <div>
          <div class="baja-item-info">${roLabel} ${escapeHTML(ro)}${subtitle ? " — " + escapeHTML(subtitle) : ""}</div>
          <div class="baja-item-sub">${escapeHTML(sec?.label || secId)}</div>
        </div>
        <button class="btn-restaurar" onclick="restaurarMovil('${escapeHTML(key)}')">↩ Restaurar</button>
      </div>`;
    });
    html += `</div>`;
    list.innerHTML = html;
    return;
  }

  SECTIONS.forEach(sec => {
    sec.vehicles.forEach(v => {
      const key  = sec.id + "_" + v.ro;
      // Excluir eliminados en todos los filtros normales
      if (elim.includes(key)) return;

      const d    = state.vehicles[key] || {};
      const done = !!d._done;
      const hasNov = done && d.obs && d.obs.trim() !== "";
      const updDate = d._updatedDate || null;
      const isHoy   = updDate === hoy;

      // Aplicar filtro activo
      if (flotaFilter === "done" && !done)   return;
      if (flotaFilter === "pend" && done)    return;
      if (flotaFilter === "nov"  && !hasNov) return;
      if (flotaFilter.startsWith("sec_") && sec.id !== flotaFilter.replace("sec_","")) return;

      // Aplicar búsqueda
      const searchStr = [v.ro, v.modelo||"", v.marca||"", sec.label].join(" ").toLowerCase();
      if (q && !searchStr.includes(q)) return;

      items.push({ sec, v, key, d, done, hasNov, updDate, isHoy });
    });
  });

  if (!items.length) {
    list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">Sin resultados</div>`;
    return;
  }

  list.innerHTML = items.map(({ sec, v, key, d, done, hasNov, updDate, isHoy }) => {
    const subtitle   = v.marca ? (v.marca + (v.modelo ? " " + v.modelo : "")) : (v.modelo || "");
    const isNoIdent  = sec.type === "no_ident";
    const roLabel    = isNoIdent ? "Dom." : "RO";
    const fields     = FIELDS[sec.type] || [];

    // Badge de estado de actualización
    let badge, badgeClass;
    if (!done && !updDate) {
      badge = "Sin datos"; badgeClass = "mb-never";
    } else if (isHoy) {
      badge = "Hoy"; badgeClass = "mb-hoy";
    } else if (updDate) {
      const [ay,am,ad] = updDate.split("-");
      badge = `Últ: ${ad}/${am}/${ay}`; badgeClass = "mb-prev";
    } else {
      badge = "Sin datos"; badgeClass = "mb-never";
    }

    // Chips de campos
    let chips = "";
    if (done && fields.length > 0) {
      chips = fields.map(f => {
        const val = d[f.id] || "—";
        const cls = val==="OK"?"fchip-ok":val==="NO"?"fchip-no":val==="Roto"?"fchip-roto":val==="N/A"?"fchip-na":"fchip-nd";
        return `<span class="fchip ${cls}">${escapeHTML(f.label)}: ${escapeHTML(val)}</span>`;
      }).join("");
    }

    // Sección de detalle
    const updInfo = updDate
      ? `<div class="fecha-tag">📅 Última actualización: ${(() => { const [ay,am,ad]=updDate.split("-"); return `${ad}/${am}/${ay}`; })()}${d._updatedGuard ? " — " + escapeHTML(d._updatedGuard) : ""}</div>`
      : `<div class="fecha-tag">⚠️ Sin registros de esta unidad</div>`;

    const obsBlock = d.obs
      ? `<div style="margin-top:8px;padding:8px 10px;background:var(--white);border-radius:6px;border:1px solid var(--border);font-size:12px"><b style="color:var(--blue1)">Observaciones:</b> ${escapeHTML(d.obs)}</div>`
      : "";

    const btnEditar = `<button onclick="editarDesdeFlota('${sec.id}','${escapeHTML(v.ro)}')" class="btn btn-outline btn-sm" style="margin-top:10px;font-size:12px">✏️ Editar en guardia actual</button>`;

    return `<div class="movil-item" id="flotaItem_${key}">
      <div class="movil-header" onclick="toggleFlotaItem('${key}')">
        <div style="flex:1;min-width:0">
          <div class="movil-ro">${roLabel} ${escapeHTML(v.ro)}${subtitle ? " — " + escapeHTML(subtitle) : ""}</div>
          <div class="movil-sub">${escapeHTML(sec.label)}${hasNov ? " · 💬 Con novedades" : ""}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span class="movil-badge ${badgeClass}">${badge}</span>
          <span style="color:var(--muted);font-size:16px" id="flotaArrow_${key}">▸</span>
        </div>
      </div>
      <div class="movil-detail" id="flotaDetail_${key}">
        ${updInfo}
        ${chips ? `<div class="field-chips">${chips}</div>` : ""}
        ${obsBlock}
        ${btnEditar}
      </div>
    </div>`;
  }).join("");
}

function toggleFlotaItem(key) {
  const detail = document.getElementById("flotaDetail_" + key);
  const arrow  = document.getElementById("flotaArrow_" + key);
  if (!detail) return;
  const open = detail.classList.toggle("open");
  if (arrow) arrow.textContent = open ? "▾" : "▸";
}

function editarDesdeFlota(secId, ro) {
  closeFlotaModal();
  activeSec = secId;
  goTab(2);
  setTimeout(() => {
    document.querySelectorAll(".sec-btn").forEach((b,i) => {
      b.classList.toggle("active", i === SECTIONS.indexOf(SECTIONS.find(s=>s.id===secId)));
    });
    renderList(secId);
    setTimeout(() => {
      const sec   = SECTIONS.find(s=>s.id===secId);
      const found = sec?.vehicles.find(v=>v.ro===ro);
      if (found) {
        const items = document.querySelectorAll(".vehicle-item");
        items.forEach(el => {
          if ((el.querySelector(".v-ro")?.textContent||"").includes(ro)) {
            el.scrollIntoView({ behavior:"smooth", block:"center" });
            el.style.outline = "2px solid var(--blue3)";
            setTimeout(()=>el.style.outline="", 1800);
          }
        });
        openModal(secId, found);
      }
    }, 80);
  }, 60);
}

// → Ver js/personal.js (ESCALAFONES, buildNuevoEfForm, renderPersonal, renderCalendario, saveEfectivo, ...)
// ════════════════════════════════════════════
//  BUSCADOR RO
// ════════════════════════════════════════════
function getAllVehicles() {
  const all = [], seen = new Set();
  const elim = state.eliminados || [];
  SECTIONS.forEach(sec => {
    sec.vehicles.forEach(v => {
      const uid = sec.id+"_"+v.ro;
      if (!seen.has(uid) && !elim.includes(uid)) {
        seen.add(uid);
        all.push({ secId:sec.id, secLabel:sec.label, v,
          isExtra:!!(state.extras||[]).find(e=>e.secId===sec.id && e.v.ro===v.ro) });
      }
    });
  });
  return all;
}

function onSearchInput(val) {
  const q   = val.trim().toUpperCase();
  const box = document.getElementById("searchResults");
  if (!q) { box.style.display="none"; return; }

  const matches = getAllVehicles().filter(item =>
    item.v.ro.toString().toUpperCase().includes(q) ||
    (item.v.modelo||"").toUpperCase().includes(q)  ||
    (item.v.marca ||"").toUpperCase().includes(q)
  );

  box.style.display = "block";
  box.innerHTML = "";

  if (!matches.length) {
    // Fila: "no encontrado"
    const noFound = document.createElement("div");
    noFound.style.cssText = "padding:12px 14px;color:var(--muted);font-size:13px";
    noFound.innerHTML = `"<b style="color:var(--text)">${escapeHTML(val.trim())}</b>" no encontrado.`;
    box.appendChild(noFound);

    // Fila: agregar nuevo — sin onclick en innerHTML para evitar problemas de escape
    const addRow = document.createElement("div");
    addRow.style.cssText = "padding:12px 14px;background:var(--blue5);border-top:1px solid var(--border);color:var(--blue2);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px";
    addRow.textContent = `➕ Agregar "${val.trim()}" como nuevo vehículo`;
    addRow.addEventListener("click", (e) => {
      e.stopPropagation();
      promptNewRo(val.trim());
    });
    box.appendChild(addRow);
    return;
  }

  matches.slice(0,8).forEach(item => {
    const key  = item.secId+"_"+item.v.ro;
    const done = !!(state.vehicles[key]||{})._done;
    const sub  = item.v.marca ? (item.v.marca+" "+(item.v.modelo||"")).trim() : (item.v.modelo||"");
    const row  = document.createElement("div");
    row.style.cssText = "padding:11px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center";
    row.innerHTML = `
      <div>
        <div style="font-weight:700;font-size:14px">${escapeHTML(item.v.ro)}${sub?" — "+escapeHTML(sub):""}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHTML(item.secLabel)}${item.isExtra?" · Manual":""}</div>
      </div>
      <div>${done?"✅":"⬜"}</div>`;
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      selectSearchResult(item.secId, item.v.ro);
    });
    box.appendChild(row);
  });
}

function doSearch() { onSearchInput(document.getElementById("searchRO").value.trim()); }

function selectSearchResult(secId, ro) {
  document.getElementById("searchResults").style.display="none";
  document.getElementById("searchRO").value="";
  activeSec = secId;
  document.querySelectorAll(".sec-btn").forEach((b,i) =>
    b.classList.toggle("active", i===SECTIONS.indexOf(SECTIONS.find(s=>s.id===secId)))
  );
  renderList(secId);
  setTimeout(() => {
    document.querySelectorAll(".vehicle-item").forEach(el => {
      if ((el.querySelector(".v-ro")?.textContent||"").includes(ro)) {
        el.scrollIntoView({behavior:"smooth", block:"center"});
        el.style.outline = "2px solid var(--blue3)";
        setTimeout(() => el.style.outline="", 1800);
        const sec   = SECTIONS.find(s=>s.id===secId);
        const found = sec?.vehicles.find(v=>v.ro===ro);
        if (found) openModal(secId, found);
      }
    });
  }, 80);
}

document.addEventListener("click", e => {
  if (!e.target.closest("#searchRO") && !e.target.closest("#searchResults"))
    document.getElementById("searchResults").style.display="none";
});

// ════════════════════════════════════════════
//  NUEVO RO
// ════════════════════════════════════════════
let pendingNewRo = null;

function promptNewRo(roVal) {
  document.getElementById("searchResults").style.display="none";
  document.getElementById("searchRO").value="";
  pendingNewRo = roVal.trim();
  document.getElementById("newRoNum").textContent = pendingNewRo;

  // Construir botones de categoría con addEventListener (no onclick en innerHTML)
  const catDiv = document.getElementById("catButtons");
  catDiv.innerHTML = "";
  SECTIONS.forEach(sec => {
    const btn = document.createElement("button");
    btn.style.cssText = "background:var(--white);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:14px;font-weight:600;padding:12px 14px;cursor:pointer;text-align:left;font-family:var(--font-body);width:100%;display:flex;justify-content:space-between;align-items:center";
    btn.innerHTML = `<span><span style="color:var(--blue2);margin-right:8px">▸</span>${sec.label}</span><span style="font-size:11px;color:var(--muted)">${sec.vehicles.length} unid.</span>`;
    btn.addEventListener("click", () => addNewRo(sec.id));
    catDiv.appendChild(btn);
  });

  document.getElementById("newRoModal").classList.add("open");
}

function closeNewRoModal() {
  document.getElementById("newRoModal").classList.remove("open");
  pendingNewRo = null;
}

function addNewRo(secId) {
  const ro  = pendingNewRo;
  closeNewRoModal();
  if (!ro) return;
  const sec = SECTIONS.find(s=>s.id===secId);
  if (!sec) return;
  if (sec.vehicles.find(v=>v.ro===ro)) { selectSearchResult(secId, ro); return; }
  const newV = { ro, _extra:true };
  sec.vehicles.push(newV);
  if (!state.extras) state.extras = [];
  if (!state.extras.find(e=>e.secId===secId && e.v.ro===ro))
    state.extras.push({ secId, secLabel:sec.label, v:newV });
  saveStorage();
  activeSec = secId;
  document.querySelectorAll(".sec-btn").forEach((b,i) =>
    b.classList.toggle("active", i===SECTIONS.indexOf(sec))
  );
  renderList(secId);
  updateSummary();
  showToast("➕ "+ro+" agregado a "+sec.label);
  setTimeout(() => openModal(secId, newV), 150);
}

function showToast(msg){
  const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1900);
}

// ════════════════════════════════════════════
//  PDF
// ════════════════════════════════════════════
// → Ver js/pdf.js (generatePDF)
async function openCompModal() {
  document.getElementById("compModal").classList.add("open");
  document.getElementById("compResult").innerHTML = '<div class="comp-no-diff">Cargando historial...</div>';
  const sel = document.getElementById("compSelect");
  sel.innerHTML = '<option value="">— Seleccioná un informe —</option>';

  if (!supaClient) {
    document.getElementById("compResult").innerHTML = '<div class="comp-no-diff" style="color:var(--no)">Sin conexión a la nube</div>';
    return;
  }
  try {
    const { data, error } = await supaClient
      .from("informes")
      .select("id, fecha, oficial, ayudante, vehicles, personal, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    _compInformes = (data || []).filter(inf => inf.fecha !== state.fecha);
    _compInformes.forEach(inf => {
      const [y,m,d] = (inf.fecha||"").split("-");
      const opt = document.createElement("option");
      opt.value = inf.id;
      opt.textContent = `${d}/${m}/${y} — ${inf.oficial||"?"}`;
      sel.appendChild(opt);
    });
    if (!_compInformes.length) {
      document.getElementById("compResult").innerHTML = '<div class="comp-no-diff">No hay informes anteriores disponibles</div>';
    } else {
      document.getElementById("compResult").innerHTML = '<div class="comp-no-diff">Seleccioná un informe del menú para ver las diferencias</div>';
    }
  } catch(e) {
    document.getElementById("compResult").innerHTML = '<div class="comp-no-diff" style="color:var(--no)">Error al cargar el historial</div>';
  }
}

function closeCompModal() {
  document.getElementById("compModal").classList.remove("open");
}

function cargarCompInforme(id) {
  if (!id) return;
  const inf = _compInformes.find(i => i.id === id);
  if (!inf) return;

  const [y,m,d] = (inf.fecha||"").split("-");
  const [cy,cm,cd] = (state.fecha||"").split("-");
  document.getElementById("compMeta").textContent =
    `${cd}/${cm}/${cy} vs ${d}/${m}/${y}`;

  const vehiclesA = state.vehicles || {};
  const vehiclesB = inf.vehicles   || {};

  const allKeys = new Set([...Object.keys(vehiclesA), ...Object.keys(vehiclesB)]);

  const diffsBySec = {};
  const tagClass = v => v==="OK"?"comp-tag-ok":v==="NO"?"comp-tag-no":v==="Roto"?"comp-tag-roto":v==="N/A"?"comp-tag-na":"comp-tag-nd";

  let totalDiffs = 0, newIssues = 0, resolved = 0;

  allKeys.forEach(key => {
    const dA = vehiclesA[key] || {};
    const dB = vehiclesB[key] || {};
    const [secId] = key.split("_");
    const sec = SECTIONS.find(s => s.id === secId);
    const secLabel = sec?.label || secId;

    // Comparar campo a campo (fix: FIELDS por tipo, no por secId)
    const fields = FIELDS[sec?.type] || [];
    const diffs = [];

    fields.forEach(field => {
      const valA = dA[field.id];
      const valB = dB[field.id];
      if (valA === valB) return;
      if (!valA && !valB) return;
      diffs.push({ field: field.label, valA: valA||"—", valB: valB||"—" });
    });

    // Observaciones (fix: era 'novedad', debe ser 'obs')
    const novA = (dA.obs||"").trim();
    const novB = (dB.obs||"").trim();
    if (novA !== novB && (novA || novB)) {
      diffs.push({ field:"Observaciones", valA: novA||"—", valB: novB||"—" });
    }

    if (!diffs.length) return;

    totalDiffs += diffs.length;
    diffs.forEach(d => {
      if (d.valB === "—" || d.valB === "OK") newIssues++;
      if (d.valA === "—" || d.valA === "OK") resolved++;
    });

    if (!diffsBySec[secLabel]) diffsBySec[secLabel] = [];
    diffsBySec[secLabel].push({ ro: key.slice(secId.length + 1), diffs });
  });

  if (!totalDiffs) {
    document.getElementById("compResult").innerHTML =
      '<div class="comp-no-diff">✅ Sin diferencias — ambos informes son idénticos</div>';
    return;
  }

  let html = `<div class="comp-summary">
    <div class="comp-sum-box"><div class="comp-sum-num" style="color:var(--no)">${totalDiffs}</div><div class="comp-sum-lbl">Diferencias</div></div>
    <div class="comp-sum-box"><div class="comp-sum-num" style="color:var(--warn)">${newIssues}</div><div class="comp-sum-lbl">Nuevas issues</div></div>
    <div class="comp-sum-box"><div class="comp-sum-num" style="color:var(--ok)">${resolved}</div><div class="comp-sum-lbl">Resueltas</div></div>
  </div>`;

  Object.entries(diffsBySec).forEach(([secLabel, vehDiffs]) => {
    html += `<div class="comp-section">
      <div class="comp-sec-title">${escapeHTML(secLabel)}</div>`;
    vehDiffs.forEach(({ro, diffs}) => {
      diffs.forEach(({field, valA, valB}) => {
        html += `<div class="comp-row">
          <span class="comp-ro">RO ${escapeHTML(ro)}</span>
          <span class="comp-diff">
            <span style="font-size:11px;color:var(--muted);display:block;margin-bottom:2px">${escapeHTML(field)}</span>
            <span class="comp-tag ${tagClass(valB)}">${escapeHTML(valB)}</span>
            <span class="comp-arrow"> → </span>
            <span class="comp-tag ${tagClass(valA)}">${escapeHTML(valA)}</span>
          </span>
        </div>`;
      });
    });
    html += `</div>`;
  });

  document.getElementById("compResult").innerHTML = html;
}

// ── MODO OSCURO ──────────────────────────────────────────────────────────────
function applyDarkMode(dark) {
  // Tailwind usa darkMode:'class' → necesita clase 'dark' en <html>
  document.documentElement.classList.toggle("dark", dark);
  // Mantener data-theme para compatibilidad con CSS custom properties
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  const btn = document.getElementById("btnDark");
  if (btn) btn.textContent = dark ? "☀️" : "🌙";
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.contains("dark");
  const next = !isDark;
  localStorage.setItem("dpt_dark", next ? "1" : "0");
  applyDarkMode(next);
}

// Aplicar preferencia guardada (o del sistema) al cargar
(function() {
  const saved = localStorage.getItem("dpt_dark");
  if (saved !== null) {
    applyDarkMode(saved === "1");
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyDarkMode(true);
  }
})();

// ════════════════════════════════════════════
//  TAB ADMIN — GESTIÓN DE FLOTA
// ════════════════════════════════════════════
// → Ver js/admin.js (switchAdminTab, renderAdminPersonal, openEditarEfAdmin, darDeBajaEfAdmin, renderAdminFlota, toggleAdminSec, guardarNuevoVehiculo, eliminarVehiculoAdmin, guardarNuevaSeccion)
// ════════════════════════════════════════════
//  FOTOS DE DAÑO EN VEHÍCULOS
// ════════════════════════════════════════════
// → Ver js/fotos.js (comprimirImagen, blobToDataUrl, actualizarFotoWrap, uploadFotoMovil, eliminarFotoMovil, verFotoNovedad)
// ── PWA — Registro del Service Worker ─────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then(reg => {
      reg.addEventListener("updatefound", () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener("statechange", () => {
          if (newSW.state === "installed" && navigator.serviceWorker.controller) {
            showToast("🔄 Nueva versión disponible — recargando...");
            setTimeout(() => location.reload(), 800);
          }
        });
      });
    });
  });
}
