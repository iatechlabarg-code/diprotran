// ════════════════════════════════════════════
//  js/offline.js — Colas offline para informes y fotos
//  Depende de globals: supaClient, state, showToast,
//                      actualizarIndicadorCola, buildPayload
// ════════════════════════════════════════════

// ════════════════════════════════════════════
//  COLA OFFLINE
// ════════════════════════════════════════════
const COLA_KEY = "diprotran_offline_queue";

function getColaOffline() {
  try { return JSON.parse(localStorage.getItem(COLA_KEY) || "[]"); } catch { return []; }
}
function setColaOffline(cola) {
  localStorage.setItem(COLA_KEY, JSON.stringify(cola));
}
function encolarPayload(payload) {
  const cola = getColaOffline();
  // Reemplazar si ya hay un item con la misma fecha (evitar duplicados)
  const idx = cola.findIndex(i => i.payload.fecha === payload.fecha);
  const item = { payload, timestamp: Date.now() };
  if (idx >= 0) cola[idx] = item; else cola.push(item);
  setColaOffline(cola);
  actualizarIndicadorCola();
}
function actualizarIndicadorCola() {
  const cola   = getColaOffline();
  const badge  = document.getElementById("colaBadge");
  const badgeN = document.getElementById("colaBadgeNum");
  if (!badge) return;
  if (cola.length > 0) {
    badge.style.display  = "";
    badgeN.textContent   = cola.length;
  } else {
    badge.style.display = "none";
  }
}
async function procesarColaOffline() {
  if (!supaClient) return;
  const cola = getColaOffline();
  if (!cola.length) return;
  setNubeStatus("saving", `Sincronizando ${cola.length} pendiente${cola.length>1?"s":""}...`);
  const pendientes = [...cola];
  const exitosos = [];
  for (const item of pendientes) {
    try {
      await _upsertInforme(item.payload);
      exitosos.push(item);
    } catch(e) {
      console.warn("Cola: no se pudo sincronizar item:", e);
    }
  }
  if (exitosos.length) {
    const nuevaCola = getColaOffline().filter(i => !exitosos.some(e => e.timestamp === i.timestamp));
    setColaOffline(nuevaCola);
    actualizarIndicadorCola();
    if (exitosos.length === pendientes.length) {
      setNubeStatus("online", "Conectado");
      showToast(`☁️ ${exitosos.length} informe${exitosos.length>1?"s":""} sincronizado${exitosos.length>1?"s":""}`);
    }
  }
}

// Helper interno: upsert de un informe en Supabase
async function _upsertInforme(payload) {
  const { data: existing } = await supaClient
    .from("informes").select("id").eq("fecha", payload.fecha).limit(1);
  let err;
  if (existing && existing.length > 0) {
    const { error } = await supaClient.from("informes").update(payload).eq("id", existing[0].id);
    err = error;
  } else {
    const { error } = await supaClient.from("informes").insert([payload]);
    err = error;
  }
  if (err) throw err;
}

// Escuchar reconexión
// ════════════════════════════════════════════
//  COLA OFFLINE — FOTOS
// ════════════════════════════════════════════
const FOTO_COLA_KEY = "diprotran_foto_queue";

function _getFotoCola() {
  try { return JSON.parse(localStorage.getItem(FOTO_COLA_KEY) || "[]"); } catch { return []; }
}
function _setFotoCola(cola) {
  try { localStorage.setItem(FOTO_COLA_KEY, JSON.stringify(cola)); } catch(e) {
    console.warn("No se pudo guardar cola de fotos:", e);
  }
}
function _encolarFoto(vehicleKey, dataUrl, storagePath) {
  const cola = _getFotoCola();
  const idx  = cola.findIndex(i => i.vehicleKey === vehicleKey);
  const item = { vehicleKey, dataUrl, storagePath, timestamp: Date.now() };
  if (idx >= 0) cola[idx] = item; else cola.push(item);
  _setFotoCola(cola);
}
function _quitarFotoDeCola(vehicleKey) {
  const cola = _getFotoCola().filter(i => i.vehicleKey !== vehicleKey);
  _setFotoCola(cola);
}
async function procesarColaFotos() {
  if (!supaClient) return;
  const cola = _getFotoCola();
  if (!cola.length) return;
  const exitosos = [];
  for (const item of cola) {
    try {
      // Convertir dataUrl a Blob
      const res  = await fetch(item.dataUrl);
      const blob = await res.blob();
      const { data: upData, error: upErr } = await supaClient.storage
        .from("fotos-moviles")
        .upload(item.storagePath, blob, { contentType: "image/jpeg", upsert: true });
      if (!upErr && upData) {
        const { data: { publicUrl } } = supaClient.storage
          .from("fotos-moviles").getPublicUrl(item.storagePath);
        // Actualizar state si el vehículo sigue en memoria
        if (state.vehicles[item.vehicleKey]) {
          state.vehicles[item.vehicleKey].fotoUrl = publicUrl;
          saveStorage();
        }
        exitosos.push(item.vehicleKey);
      }
    } catch(e) { console.warn("procesarColaFotos — item fallido:", e); }
  }
  if (exitosos.length) {
    _setFotoCola(_getFotoCola().filter(i => !exitosos.includes(i.vehicleKey)));
    showToast(`📷 ${exitosos.length} foto${exitosos.length > 1 ? "s" : ""} sincronizada${exitosos.length > 1 ? "s" : ""}`);
  }
}

window.addEventListener("online", () => {
  setNubeStatus("online", "Conectado");
  procesarColaOffline();
  procesarColaFotos();
});
window.addEventListener("offline", () => {
  setNubeStatus("offline", "Sin conexión");
});

