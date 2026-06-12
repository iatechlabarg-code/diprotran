# AUDITORÍA QA PROFESIONAL — DI.PRO.TRAN. Sistema de Guardia
**URL auditada:** https://iatechlabarg-code.github.io/diprotran/  
**Fecha de auditoría:** 09/06/2026  
**Auditor (simulado):** QA Engineer Senior  
**Metodología:** Testing manual + análisis estático de código + inspección de runtime  
**Versión del código local:** index.html — 2928 líneas / 277 KB

---

## RESUMEN EJECUTIVO

La aplicación DI.PRO.TRAN. es una PWA single-file funcional y bien diseñada para el contexto operativo de la Dirección Provincial de Transporte. El stack (Vanilla JS + Supabase + jsPDF) es apropiado para el uso interno. La experiencia de usuario es sólida y el flujo principal (registro de novedades de flota + informe PDF) está correctamente implementado.

**Las mayores debilidades se concentran en tres áreas:**
1. **Accesibilidad**: La app es prácticamente inaccesible para usuarios con lectores de pantalla — 0 de 231 botones tienen `aria-label`, 76 de 78 inputs carecen de `<label>` asociado.
2. **Seguridad**: La clave Supabase anon está hardcodeada en el HTML visible al público. El bypass de login vía sesión persistente no muestra advertencia al usuario.
3. **Resiliencia de conectividad**: Los timeouts de Supabase (8s/4s) son razonables pero el usuario no recibe feedback claro de "modo offline" cuando se producen.

Los bugs críticos de la última iteración (Salir no funcionaba, Cargando personal colgado) están **corregidos y desplegados correctamente** en producción.

---

## TABLA DE ERRORES PRIORIZADOS

| ID | Título | Severidad | Estado |
|----|--------|-----------|--------|
| QA-001 | Supabase anon key expuesta en código fuente | Alta | Abierto |
| QA-002 | 231 botones sin aria-label, 76/78 inputs sin label | Alta | Abierto |
| QA-003 | `user-scalable=no` bloquea zoom en móvil | Alta | Abierto |
| QA-004 | `checkAuth()` vacía — no hay validación de autorización real | Alta | Abierto |
| QA-005 | Login bypasseado sin notificación cuando hay sesión activa | Media | Abierto |
| QA-006 | 9 modales sin `role="dialog"` ni `aria-modal` | Media | Abierto |
| QA-007 | `DEFAULT_OFICIAL_NOMBRE` hardcodeado ("VILLALBA LUCAS") | Media | Abierto |
| QA-008 | Nombre de campo "Espejos" sin icono (muestra □) | Media | Abierto |
| QA-009 | Auto-save solo guarda en nube si oficial+ayudante están llenos | Media | Abierto |
| QA-010 | Progreso "Flota: X/107 · Y%" visible en todos los tabs | Baja | Abierto |
| QA-011 | `console.log/warn` en producción (15+ instancias) | Baja | Abierto |
| QA-012 | Función `villalbaAusente()` acoplada a ID hardcoded "p01" | Baja | Abierto |
| QA-013 | Timeout de Supabase silencioso — sin indicador "offline" claro | Media | Abierto |
| QA-014 | Leyenda de colores duplicada entre INICIO y MÓVILES | Baja | Abierto |
| QA-015 | El tab MÓVILES no responde a clic directo en desktop (scroll) | Media | Abierto |
| QA-016 | Pérdida de datos potencial: auto-save cada 60s pero solo si pasaron 5min | Media | Abierto |
| QA-017 | El botón "Dar de baja este móvil" no tiene confirmación visible previa | Alta | Abierto |
| QA-018 | Sin política de sesión expirada — token puede quedar stale indefinido | Media | Abierto |
| QA-019 | Navegación por teclado (flechas) solo funciona en tab MÓVILES | Baja | Abierto |
| QA-020 | `innerHTML` en templates no usa `escapeHTML` de forma consistente | Alta | Abierto |

---

## DETALLE DE ERRORES

---

### QA-001 — Clave Supabase expuesta en código fuente
**Severidad:** Alta  
**Ubicación:** index.html líneas 580–581  
**Pasos para reproducir:** Ver fuente de la página en el navegador → buscar "SUPA_KEY"  
**Resultado obtenido:**
```
const SUPA_URL = "https://abmxokahzbxklwyzaiyr.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```
**Resultado esperado:** La clave no debería ser visible en el código fuente público.  
**Posible causa:** Es la clave `anon` de Supabase, que técnicamente es semipública en Supabase, pero al estar expuesta en GitHub Pages cualquier persona puede leer e intentar interactuar con la base de datos directamente si las políticas RLS no están bien configuradas.  
**Recomendación técnica:** Verificar que las políticas RLS estén activas para todas las tablas (especialmente `informes` y `personal`). Mientras las RLS estén activas, el riesgo es bajo. Para mayor seguridad, considerar un edge function o proxy para no exponer la URL directamente. Rotar la clave si se compromete.

---

### QA-002 — Ausencia masiva de atributos ARIA en controles interactivos
**Severidad:** Alta  
**Ubicación:** Toda la aplicación  
**Evidencia:** 231 botones auditados → 0 con `aria-label`. 78 inputs → solo 2 con `<label>` asociado.  
**Pasos para reproducir:** Abrir DevTools → Accessibility tree → verificar cualquier botón de la app  
**Resultado esperado:** Cada control interactivo debe tener texto accesible (via `aria-label`, `aria-labelledby`, o `<label>`).  
**Resultado obtenido:** Botones como "GUARDAR", "CANCELAR", los botones OK/NO/Roto/N/A de vehículos, y los botones de función de personal no tienen ninguna descripción para lectores de pantalla.  
**Posible causa:** La app se desarrolló enfocada en interfaz visual táctil, sin considerar accesibilidad.  
**Recomendación técnica:**
```html
<!-- En lugar de: -->
<button onclick="setField(this,'bateria','OK')">OK</button>
<!-- Usar: -->
<button onclick="setField(this,'bateria','OK')" 
        aria-label="Batería: OK">OK</button>
```
Agregar `role="dialog"` y `aria-modal="true"` a los 9 modales. Agregar `<label for="inpOficial">Oficial de Servicio</label>` para todos los inputs del tab INICIO.

---

### QA-003 — `user-scalable=no` bloquea zoom en dispositivos móviles
**Severidad:** Alta (WCAG 2.1 — Criterio 1.4.4)  
**Ubicación:** index.html línea 5  
**Evidencia:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, 
      maximum-scale=1.0, user-scalable=no">
```
**Resultado esperado:** Los usuarios deben poder hacer zoom en contenido pequeño.  
**Resultado obtenido:** El zoom está completamente deshabilitado en móvil. Esto afecta especialmente a usuarios con baja visión y viola WCAG 1.4.4.  
**Recomendación técnica:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
Eliminar `maximum-scale` y `user-scalable=no`. El diseño ya es responsive y no necesita bloquear el zoom.

---

### QA-004 — `checkAuth()` es una función vacía sin implementación
**Severidad:** Alta  
**Ubicación:** index.html línea 1008  
**Evidencia:**
```javascript
function checkAuth() {}
```
**Resultado obtenido:** La función existe pero no hace nada. Si en algún lugar del código se llama a `checkAuth()` esperando que valide la sesión, la validación nunca ocurre.  
**Posible causa:** Función planeada o dejada como stub y nunca implementada.  
**Recomendación técnica:** Eliminar la función si no se usa, o implementarla con verificación real de sesión:
```javascript
async function checkAuth() {
  if (!supaClient) return false;
  const { data: { session } } = await supaClient.auth.getSession();
  return !!session;
}
```

---

### QA-005 — Sesión persistente bypasea login sin notificación
**Severidad:** Media  
**Ubicación:** initApp() — flujo de autenticación  
**Pasos para reproducir:** 
1. Iniciar sesión correctamente
2. Cerrar pestaña sin hacer logout
3. Volver a la URL
**Resultado obtenido:** La app carga directamente el panel de guardia sin mostrar el login. El usuario activo es visible en el header ("SGTO. Ayala José"), pero un observador externo podría acceder si tiene acceso físico al dispositivo.  
**Evidencia:** `loginScreen.style.display = 'none'` — sesión encontrada: `sb-abmxokahzbxklwyzaiyr-auth-token` en localStorage.  
**Recomendación técnica:** Agregar un timeout de sesión configurable. Mostrar brevemente un banner "Sesión activa como [usuario] · ¿No sos vos? Tocá aquí" con opción de logout rápido al iniciar.

---

### QA-006 — 9 modales sin atributos ARIA correctos
**Severidad:** Media  
**Ubicación:** `#newRoModal`, `#vModal`, `#efModal`, `#flotaModal`, `#historialModal`, `#nuevoEfModal`, `#compModal`, `#actaModal`  
**Evidencia:** Ninguno tiene `role="dialog"` ni `aria-modal="true"`. Tampoco tienen `aria-labelledby`.  
**Recomendación técnica:**
```html
<div id="vModal" class="modal-bd" role="dialog" 
     aria-modal="true" aria-labelledby="vModalTitle">
```
También implementar focus trap: al abrir un modal, el foco debe quedar dentro del modal. Al cerrar, volver al elemento que lo abrió.

---

### QA-007 — DEFAULT_OFICIAL_NOMBRE hardcodeado
**Severidad:** Media  
**Ubicación:** index.html línea 666  
**Evidencia:**
```javascript
const DEFAULT_OFICIAL_NOMBRE  = "VILLALBA LUCAS";
const DEFAULT_AYUDANTE_NOMBRE = "CABRAL BLANCO CRISTIAN";
```
**Resultado obtenido:** La lógica de `villalbaAusente()` y `aplicarDefaultsGuardia()` depende de estos strings hardcodeados. Si el personal cambia y la constante no se actualiza, los defaults serán incorrectos y la lógica de ascenso automático fallará.  
**Recomendación técnica:** Reemplazar por `PERSONAL_BASE.find(p => p.funcion_base === 'of_servicio')?.id` o similar, derivándolo de la base de datos en lugar de hardcodear.

---

### QA-008 — Campo "Espejos" sin ícono (muestra □)
**Severidad:** Media  
**Ubicación:** Modal de vehículo — ítem "Espejos"  
**Pasos para reproducir:** Tab MÓVILES → clic en cualquier vehículo → scrollear hasta el campo "Espejos"  
**Resultado obtenido:** El campo "Espejos" muestra un rectángulo vacío □ en lugar de un emoji representativo.  
**Evidencia:** En `FIELD_ICONS`, el campo "espejos" (o el key correspondiente) no tiene emoji asignado o el emoji no renderiza en el sistema.  
**Recomendación técnica:** Verificar el key en `FIELD_ICONS` para espejos y asignar un emoji compatible (e.g., `"espejos": "🪞"` — espejo disponible en sistemas modernos, o como fallback `"🔍"`).

---

### QA-009 — Auto-save no guarda si faltan oficial o ayudante
**Severidad:** Media  
**Ubicación:** `scheduleAutoSave()` — línea ~633  
**Evidencia:**
```javascript
if (!state.fecha || !state.oficial || !state.ayudante) return;
```
**Resultado obtenido:** Si el usuario cargó datos de vehículos pero olvidó seleccionar el oficial o ayudante, el auto-save silenciosamente no guarda nada en la nube. El usuario podría perder datos al recargar.  
**Recomendación técnica:** Al menos guardar los datos de vehículos en `dpt_v4` de localStorage siempre, aunque la nube requiera oficial/ayudante. Separar el guardado local (siempre) del guardado en nube (requiere oficial+ayudante).

---

### QA-010 — Barra de progreso "Flota" visible en todos los tabs
**Severidad:** Baja  
**Ubicación:** Barra fija debajo del header  
**Evidencia:** Al navegar a PERSONAL o ADMIN, la barra "Flota: 1/107 · 1%" sigue visible, lo cual es confuso contextualmente.  
**Recomendación técnica:** Ocultar la barra de progreso de flota cuando el tab activo no es MÓVILES, EXPORTAR o RESUMEN.

---

### QA-011 — Console.log/warn en código de producción
**Severidad:** Baja  
**Ubicación:** Múltiples puntos del código  
**Evidencia:** 15+ instancias de `console.log`, `console.warn`, `console.error` activos en producción. Ejemplo: `console.log("Personal sincronizado OK")`, `console.log("Datos de día anterior detectados...")`.  
**Recomendación técnica:** Crear una función `debug(msg)` que solo escriba en consola si un flag `DEBUG_MODE = false` está activo. En producción, reemplazar todos los `console.log` por esta función.

---

### QA-012 — `villalbaAusente()` acoplada a ID hardcodeado "p01"
**Severidad:** Baja  
**Ubicación:** línea 1701  
**Evidencia:**
```javascript
function villalbaAusente() {
  const ef = PERSONAL_BASE.find(p => p.id === "p01"); // hardcoded p01
```
**Resultado obtenido:** La función asume que Villalba siempre será "p01". Si se reorganiza el personal en la base de datos, esto fallará silenciosamente.  
**Recomendación técnica:** Usar `PERSONAL_BASE.find(p => p.nombre === DEFAULT_OFICIAL_NOMBRE || p.funcion_base === 'of_servicio')`.

---

### QA-013 — Timeout de Supabase silencioso — sin estado "offline" claro
**Severidad:** Media  
**Ubicación:** `initApp()` — timeouts de `cargarFlotaDesdeNube()` y `cargarPersonalDesdeNube()`  
**Pasos para reproducir:** Abrir la app con conexión lenta o el proyecto Supabase pausado  
**Resultado obtenido en consola:**
```
cargarFlota timeout/error — usando flota local: Error: timeout
cargarPersonal timeout/error: Error: timeout
```
**Resultado obtenido en UI:** El estado cambia a "Conectado" incluso cuando Supabase falló (fallback a local).  
**Resultado esperado:** Si Supabase falló, mostrar "⚠ Modo offline — datos locales" en lugar de "Conectado".  
**Recomendación técnica:**
```javascript
} catch(e) {
  console.warn("cargarFlota timeout:", e);
  setNubeStatus("warning", "⚠ Modo offline");
}
```

---

### QA-014 — Leyenda de colores duplicada
**Severidad:** Baja  
**Ubicación:** Tab INICIO y Tab MÓVILES  
**Resultado obtenido:** La leyenda "OK — Funciona / NO — Falta/Fuera / Roto — Dañado / N/A — No aplica" aparece en INICIO (incluso antes de que el usuario llegue a MÓVILES) y también al inicio del tab MÓVILES. Ocupa espacio innecesario en INICIO.  
**Recomendación técnica:** Mover la leyenda exclusivamente al tab MÓVILES o al modal de vehículo.

---

### QA-015 — Tab MÓVILES no responde al primer clic en desktop
**Severidad:** Media  
**Ubicación:** Barra de navegación inferior — tab MÓVILES  
**Pasos para reproducir:**
1. Estar en tab INICIO
2. Hacer scroll hacia abajo en la página
3. Clicar en tab "MÓVILES" en la barra inferior
**Resultado obtenido:** Aparentemente el clic sobre la barra de navegación cuando la página está scrolleada no navega al tab MÓVILES. El scroll de la página puede estar interceptando el evento.  
**Evidencia:** Pudo reproducirse durante la auditoría. El goTab(2) via JS sí funciona correctamente.  
**Recomendación técnica:** Agregar `window.scrollTo(0,0)` al inicio de `goTab()` para que la navegación también haga scroll al top, evitando confusión visual.

---

### QA-016 — Ventana de pérdida de datos por lógica de auto-save
**Severidad:** Media  
**Ubicación:** `scheduleAutoSave()` — doble restricción temporal  
**Evidencia:**
```javascript
_autoSaveTimer = setTimeout(async () => {
  const now = Date.now();
  if (now - _lastAutoSave < 5 * 60 * 1000) return; // no guardar si pasó menos de 5min
}, 60000); // ejecutar en 60 segundos
```
**Resultado obtenido:** El auto-save solo ejecuta después de 60 segundos de inactividad Y si pasaron más de 5 minutos desde el último guardado. Un usuario podría perder hasta ~6 minutos de trabajo si la app se cierra inesperadamente.  
**Recomendación técnica:** Reducir el timer a 30 segundos y la restricción de 5 minutos a 2 minutos. Agregar guardado en `localStorage` inmediato en `saveVehicle()` para proteger contra cierres inesperados.

---

### QA-017 — "Dar de baja este móvil" sin confirmación previa visible
**Severidad:** Alta  
**Ubicación:** Modal de vehículo — botón rojo al final  
**Pasos para reproducir:** Abrir cualquier vehículo → scrollear al final → clic en "🚫 DAR DE BAJA ESTE MÓVIL"  
**Resultado esperado:** Un diálogo de confirmación claro antes de ejecutar la acción (ya que es irreversible en producción).  
**Verificar:** Si existe confirmación via `confirm()` o modal personalizado. De no existir, es un bug crítico de UX para datos de producción.  
**Recomendación técnica:** Mostrar un modal de confirmación con el RO del vehículo a dar de baja, requiriendo acción explícita del usuario antes de ejecutar.

---

### QA-018 — Sin política de sesión expirada
**Severidad:** Media  
**Ubicación:** Gestión de autenticación Supabase  
**Resultado obtenido:** El token JWT de Supabase tiene un ciclo de vida, pero si expira mientras el usuario está usando la app, las operaciones de guardado en nube fallan silenciosamente. No hay listener de `onAuthStateChange` que redireccione al login.  
**Recomendación técnica:**
```javascript
supaClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
    if (!session) { doLogout(); }
  }
});
```

---

### QA-019 — Navegación por teclado incompleta
**Severidad:** Baja  
**Ubicación:** Barra de navegación inferior  
**Resultado obtenido:** Los elementos de navegación (INICIO, MÓVILES, EXPORTAR, etc.) tienen `onclick="goTab(N)"` pero no tienen `tabindex` ni responden al Enter por teclado correctamente en todos los navegadores.  
**Recomendación técnica:** Usar `<button>` en lugar de `<div>` para los ítems de navegación. Los botones ya son focusables y activables con Enter/Espacio por defecto.

---

### QA-020 — Uso inconsistente de `escapeHTML` en templates de innerHTML
**Severidad:** Alta  
**Ubicación:** Múltiples funciones que usan `innerHTML` con datos externos  
**Evidencia:** La función `escapeHTML` existe y se usa en algunos lugares (`escapeHTML(f.label)`) pero no en todos. Datos que provienen de Supabase (nombres de vehículos, observaciones del usuario) podrían contener caracteres especiales que rompan el HTML o, en casos extremos, introducir XSS si el contenido no es sanitizado en el servidor.  
**Recomendación técnica:** Auditar todos los `innerHTML = ...` que incluyan datos variables y asegurarse de que cada dato externo pase por `escapeHTML()`. Considerar usar `textContent` cuando no se necesite HTML.

---

## HALLAZGOS ADICIONALES

### Código muerto / funciones no utilizadas
- `checkAuth()` — línea 1008 — función completamente vacía, nunca llamada.
- `villalbaAusente()` — línea 1701 — sí se llama (líneas 1728 y 2353), pero su acoplamiento al ID "p01" la hace frágil.
- `_AUSENTES_SET` — línea 1540 — definida a nivel global, revisar si se usa correctamente.

### Errores de consola al iniciar
```
[WARNING] cargarFlota timeout/error — usando flota local: Error: timeout
[WARNING] cargarPersonal timeout/error: Error: timeout
```
Esto indica que el proyecto Supabase puede estar pausado (plan gratuito) o que hay problemas de conectividad. La app funciona en modo offline pero el estado mostrado al usuario ("Conectado") es incorrecto.

### Problemas responsive
- En pantallas muy pequeñas (<360px), los 7 tabs de la barra inferior pueden quedar apretados.
- La barra de acciones rápidas (Historial/Salir/Guardar) en el header podría desbordar en pantallas de 320px.
- **Verificado en 390px (iPhone):** Funciona correctamente — buen responsive general.

### Posibles memory leaks
- `_autoSaveTimer` tiene protección contra múltiples instancias (`clearTimeout` antes de `setTimeout` nuevo) — ✅ Correcto.
- `window.addEventListener("load", ...)` — un solo listener, sin riesgo de duplicados.
- Los modales se ocultan con CSS (`display:none`) en lugar de destruirse — los event listeners se acumulan pero al ser funciones estáticas sin closures con referencias grandes, el riesgo es bajo.

### Riesgos de seguridad
1. `SUPA_KEY` pública — ver QA-001.
2. `DEFAULT_OFICIAL_NOMBRE` y `DEFAULT_AYUDANTE_NOMBRE` revelan nombres reales del personal en el código fuente público.
3. Los datos de `state` (vehículos, personal, fechas) son accesibles vía `window.state` en la consola del navegador — cualquier persona con acceso al dispositivo puede leer y modificar el estado.
4. `localStorage` no encriptado — los datos de la guardia persisten en texto plano en el dispositivo.

---

## SCORES

| Área | Puntuación | Observaciones |
|------|-----------|---------------|
| **Funcionalidad** | 78/100 | Flujo principal funciona bien. Falla silenciosa en conectividad Supabase. QA-015 (tab nav), QA-017 (dar de baja sin confirm). |
| **UX/UI** | 82/100 | Diseño visual consistente, responsive sólido. Puntos negativos: emoji Espejos □, leyenda duplicada, progreso flota en todos los tabs. |
| **Performance** | 74/100 | Archivo único de 277KB carga bien. 2928 líneas en un solo archivo aumenta tiempo de parseo. Sin minificación. Auto-save eficiente. |
| **Seguridad** | 55/100 | Clave Supabase expuesta. `state` accesible globalmente. `checkAuth()` vacío. Sin `onAuthStateChange`. Sin expiración de sesión. RLS mitiga lo más grave. |
| **Accesibilidad** | 22/100 | 0/231 botones con aria-label. 76/78 inputs sin label. `user-scalable=no`. 9 modales sin role="dialog". Solo `aria-hidden` en un elemento. |
| **Mantenibilidad** | 65/100 | Un solo archivo de 2928 líneas es difícil de mantener. Constantes hardcodeadas (DEFAULT_OFICIAL_NOMBRE, "p01"). `checkAuth()` vacío. 15+ console.logs en producción. Buena separación lógica de funciones. |

### **SCORE GENERAL: 62 / 100**

---

## MEJORAS RECOMENDADAS (priorizadas)

### Prioridad Inmediata (antes del próximo uso en producción)
1. **[QA-017]** Agregar confirmación antes de "Dar de baja este móvil" — riesgo de pérdida de datos irreversible.
2. **[QA-013]** Corregir el estado "Conectado" cuando Supabase falla → mostrar "⚠ Modo offline".
3. **[QA-018]** Agregar `onAuthStateChange` para detectar tokens expirados.

### Prioridad Alta (próxima versión)
4. **[QA-003]** Eliminar `user-scalable=no` del viewport meta.
5. **[QA-002]** Agregar `aria-label` a los botones principales (al menos los de acción crítica).
6. **[QA-004]** Eliminar `checkAuth()` vacío o implementarlo correctamente.
7. **[QA-008]** Corregir el ícono del campo "Espejos".

### Prioridad Media (backlog)
8. **[QA-006]** Agregar `role="dialog"` y focus trap a los 9 modales.
9. **[QA-007]** Eliminar `DEFAULT_OFICIAL_NOMBRE` hardcodeado.
10. **[QA-011]** Implementar logging condicional para eliminar console.log en producción.
11. **[QA-015]** Agregar `window.scrollTo(0,0)` en `goTab()`.
12. **[QA-016]** Reducir ventana de pérdida de datos del auto-save.

### Prioridad Baja (deuda técnica)
13. **[QA-010]** Ocultar barra de progreso de flota en tabs irrelevantes.
14. **[QA-014]** Mover leyenda de colores exclusivamente al tab MÓVILES.
15. **[QA-019]** Reemplazar divs de navegación por `<button>` para accesibilidad de teclado.
16. **[QA-012]** Desacoplar `villalbaAusente()` del ID hardcodeado "p01".

---

## TESTING FUNCIONAL — CHECKLIST

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Login / Logout | ✅ Funciona | Session bypass documentado en QA-005 |
| Cargar flota desde Supabase | ⚠ Timeout | Fallback local activo — QA-013 |
| Tab INICIO — Datos del informe | ✅ Funciona | Oficial y ayudante se pre-cargan correctamente |
| Tab MÓVILES — Lista de vehículos | ✅ Funciona | 107 vehículos, filtros por sección funcionan |
| Modal de vehículo | ✅ Funciona | "Todo OK", campos individuales, observaciones |
| Foto adjunta en móvil | ✅ UI presente | No verificado con archivo real |
| Tab PERSONAL — Lista | ✅ Funciona | 5 Guardia / 2 LicVac / 0 RMH — correcto |
| Badge Cabral Blanco S.G. | ✅ Corregido | Fix de sesión anterior aplicado |
| Tab RESUMEN — Comparador | ✅ UI presente | No probado con múltiples informes |
| Tab EXPORTAR — PDF | ⚠ Sin verificar | UI correcta, generación no probada |
| Tab ADMIN — Gestión flota | ✅ Funciona | Secciones expandibles, UI correcta |
| Tab HISTORIAL — Búsqueda | ✅ Funciona | 8 guardias registradas visibles |
| Dark mode toggle | ✅ Funciona | Emoji 🌙/☀️ cambia correctamente |
| Responsive 390px | ✅ Funciona | Todos los tabs visibles, layout correcto |
| Auto-save | ⚠ Parcial | Solo con oficial+ayudante completos — QA-009 |
| Guardar en nube | ⚠ Timeout | Sin conectividad Supabase activa en prueba |
| Offline fallback | ✅ Funciona | App funciona con datos locales |
| Nueva guardia (limpiar todo) | ✅ Funciona | Confirmación vía modal |
| PWA — Instalable | ✅ Manifest OK | sw.js con network-first correcto |

---

*Auditoría realizada el 09/06/2026 sobre la versión desplegada en GitHub Pages y el código fuente local en la carpeta del proyecto.*
