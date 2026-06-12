# Activación — DIPROTRANS

Seguí estos pasos en orden. Tomás unos 15 minutos en total.

---

## Paso 1 — Crear usuarios en Supabase Auth

Ir a: **supabase.com → tu proyecto → Authentication → Users → Add user**

Crear los siguientes 3 usuarios (marcar "Auto Confirm User"):

| Email                          | Contraseña       |
|-------------------------------|------------------|
| guardia@diprotran.internal    | (elegí una nueva, segura) |
| villalba@diprotran.internal   | (elegí una nueva, segura) |
| cabral@diprotran.internal     | (elegí una nueva, segura) |

> Las contraseñas anteriores (diprotran2025, oavillalba, oflcabral) están comprometidas — no las reutilices.

---

## Paso 2 — Aplicar políticas RLS

Ir a: **supabase.com → tu proyecto → SQL Editor → New query**

1. Abrir el archivo `SETUP_SUPABASE.sql` (está en esta misma carpeta)
2. Seleccionar todo el contenido (Ctrl+A)
3. Pegarlo en el editor SQL
4. Click en **Run**

Deberías ver "Success. No rows returned" — eso es correcto.

---

## Paso 3 — Verificar que funcionó

En el mismo SQL Editor, correr:

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('informes','personal')
ORDER BY tablename, cmd;
```

Deberías ver 6 filas (3 por tabla: SELECT, INSERT, UPDATE), todas con `roles = {authenticated}`.

---

---

## Paso 3b — Migrar la flota a Supabase (nuevo)

Este paso carga todos los vehículos en la base de datos para que puedan gestionarse desde la app.

Ir a: **supabase.com → tu proyecto → SQL Editor → New query**

1. Abrir el archivo `SETUP_FLOTA.sql` (está en esta misma carpeta)
2. Seleccionar todo (Ctrl+A) y pegarlo en el editor
3. Click en **Run**

Deberías ver "Success. No rows returned".

Para verificar:
```sql
SELECT s.label, COUNT(v.id) AS vehiculos
FROM public.secciones s
LEFT JOIN public.vehiculos v ON v.seccion_id = s.id AND v.activo = true
GROUP BY s.id, s.label, s.ord
ORDER BY s.ord;
```

Deberías ver 14 filas (una por sección) con el total de vehículos correspondiente.

---

## Paso 4 — Probar la app

1. Abrir `index.html` en el navegador del teléfono
2. Ingresar con usuario `guardia` y la nueva contraseña
3. La app debe mostrar el panel normalmente
4. Confirmar que el botón **🔒 Salir** aparece en la barra superior

---

---

## Cómo usar el Tab Admin (nuevo)

La app ahora tiene un sexto tab **⚙️ Admin** en la barra de navegación inferior.

**Gestión de flota:**
- Tocá el tab Admin → se muestra la lista de secciones
- Tocá el nombre de una sección para expandirla
- Cada vehículo tiene un botón **Dar de baja** (baja definitiva, no temporal)
- Al final de cada sección hay un formulario para **Agregar vehículo** (RO obligatorio, resto opcional)
- El botón **+ Nueva sección** (desplegable arriba) permite crear secciones nuevas
- Todos los cambios se sincronizan en Supabase y quedan disponibles para todos los dispositivos

**Gestión de personal:**
- Desde el tab Admin → Personal → el botón lleva al tab Personal existente
- El botón **+ Nuevo** en el tab Personal agrega efectivos a Supabase
- Los efectivos se editan tocando la tarjeta y usando el botón Editar

---

## Qué cambió en el código

- **Login real**: usa Supabase Auth (`signInWithPassword`). No hay contraseñas en el código fuente.
- **Logout**: botón "🔒 Salir" en la barra superior cierra la sesión correctamente.
- **Inicio de sesión por usuario**: escribís el mismo nombre de usuario (`guardia`, `villalba`, `cabral`) — el código lo convierte internamente a email.
- **RLS activo**: con las políticas del Paso 2, ninguna petición anónima puede leer ni escribir datos.
- **Flota dinámica**: al iniciar sesión, la app carga la flota desde Supabase. Si no hay conexión, usa la copia local como fallback.
- **Tab Admin**: nuevo tab ⚙️ para agregar vehículos, secciones y gestionar personal sin tocar el código.
- **`SECTIONS` y `PERSONAL_BASE`**: ya no son constantes fijas — se sobreescriben con datos de Supabase en cada inicio de sesión.

---

## Si algo falla

- **"Usuario o contraseña incorrectos" al loguearse**: confirmar que el email en Supabase Auth es exactamente `<usuario>@diprotran.internal` (sin mayúsculas) y que el usuario tiene "Email Confirmed" en verde.
- **La app no carga datos después del login**: verificar que el SQL del Paso 2 se ejecutó sin errores. Correr la query de verificación del Paso 3.
- **"Sin conexión a la nube"**: el RLS puede estar bloqueando si el Paso 2 no se completó. Revisar las políticas.
