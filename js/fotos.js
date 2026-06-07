// ════════════════════════════════════════════
//  js/fotos.js — Compresión, upload y visualización de fotos de daño
//  Depende de globals: supaClient, currentKey, state,
//                      showToast, saveStorage, _encolarFoto, SUPA_URL
// ════════════════════════════════════════════

async function comprimirImagen(file, maxWidth, quality) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio  = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(blob);
  });
}

function actualizarFotoWrap(url) {
  const wrap = document.getElementById("fotoWrap");
  if (!wrap) return;
  wrap.innerHTML = `<img src="${escapeHTML(url)}" class="foto-preview-img">
    <button class="btn btn-danger btn-sm" onclick="eliminarFotoMovil()">🗑 Quitar foto</button>`;
}

async function uploadFotoMovil(input) {
  if (!input.files || !input.files[0] || !currentKey) return;
  const area = document.getElementById("fotoUploadArea");
  if (area) { area.classList.add("uploading"); area.textContent = "Procesando..."; }

  try {
    const compressed = await comprimirImagen(input.files[0], 1200, 0.82);
    // Guardar data URL localmente de inmediato (funciona offline)
    const dataUrl = await blobToDataUrl(compressed);
    if (!state.vehicles[currentKey]) state.vehicles[currentKey] = {};
    state.vehicles[currentKey].fotoUrl = dataUrl;
    actualizarFotoWrap(dataUrl);

    // Intentar subir a Supabase Storage
    if (supaClient) {
      const [secId, ...roParts] = currentKey.split("_");
      const ro     = roParts.join("_");
      const fecha  = state.fecha || new Date().toISOString().split("T")[0];
      const path   = `${fecha}/${secId}/${ro}_${Date.now()}.jpg`;
      const { data: upData, error: upErr } = await supaClient.storage
        .from("fotos-moviles")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: true });

      if (!upErr && upData) {
        const { data: { publicUrl } } = supaClient.storage
          .from("fotos-moviles").getPublicUrl(path);
        state.vehicles[currentKey].fotoUrl = publicUrl;
        actualizarFotoWrap(publicUrl);
        // Limpiar de cola de fotos si estaba pendiente
        _quitarFotoDeCola(currentKey);
        showToast("📷 Foto guardada en la nube");
      } else {
        // Upload falló (sin red u otro error) → encolar para reintentar
        _encolarFoto(currentKey, dataUrl, path);
        showToast("📷 Foto guardada localmente — se subirá al reconectar");
        if (upErr) console.warn("Storage upload:", upErr.message);
      }
    } else {
      // Sin supaClient → encolar
      const [secId2, ...roParts2] = currentKey.split("_");
      const ro2   = roParts2.join("_");
      const fecha2 = state.fecha || new Date().toISOString().split("T")[0];
      const path2  = `${fecha2}/${secId2}/${ro2}_${Date.now()}.jpg`;
      _encolarFoto(currentKey, dataUrl, path2);
      showToast("📷 Foto guardada — se subirá al reconectar");
    }
  } catch(e) {
    console.error("uploadFotoMovil:", e);
    showToast("❌ Error al procesar la foto");
    if (area) { area.classList.remove("uploading"); area.textContent = "📷 Tocar para adjuntar foto"; }
  }
  // Limpiar input para poder subir de nuevo
  input.value = "";
}

function eliminarFotoMovil() {
  if (!currentKey) return;
  if (!confirm("¿Quitar la foto de este vehículo?")) return;
  if (state.vehicles[currentKey]) delete state.vehicles[currentKey].fotoUrl;
  const wrap = document.getElementById("fotoWrap");
  if (wrap) wrap.innerHTML = `
    <div class="foto-upload-area" id="fotoUploadArea" onclick="document.getElementById('fotoInput').click()">
      📷 Tocar para adjuntar foto
    </div>
    <input type="file" id="fotoInput" accept="image/*" capture="environment" style="display:none" onchange="uploadFotoMovil(this)">`;
}

// → Ver js/historial.js (Tab 7: _histTabData, renderHistorialTab, _renderHistTabList, filtrarHistorialTab, histTabLoadMore, verDetalleHistorial, cerrarDetalleHistorial, confirmarCargarHistorial)
function verFotoNovedad(url) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out";
  overlay.onclick = () => overlay.remove();
  const img = document.createElement("img");
  img.src = url;
  img.style.cssText = "max-width:95vw;max-height:90vh;border-radius:8px;box-shadow:0 4px 32px rgba(0,0,0,.6)";
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

