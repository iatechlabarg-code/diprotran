# Etapa 1 — Instrucciones de activación (Seguridad Crítica)

> Completar estas instrucciones **antes** de usar el sistema con datos reales.
> Tiempo estimado: ~15 minutos.

---

## ✅ PASO 1 — Ejecutar el nuevo SQL de roles en Supabase

1. Ir a **supabase.com → tu proyecto → SQL Editor → New query**
2. Abrir el archivo `SETUP_ROLES_V2.sql` del repositorio
3. Seleccionar **todo el contenido** y hacer clic en **Run**
4. Verificar que no haya errores en el output

**Qué hace este script:**
- Crea la tabla `public.roles` (solo editable por service_role)
- Crea la función `get_user_rol()` que las políticas RLS usan para verificar acceso
- Elimina todas las políticas viejas (que usaban `user_metadata`)
- Crea las políticas nuevas y seguras para las 4 tablas
- **Migra automáticamente** los roles actuales de `user_metadata` → tabla `roles`

---

## ✅ PASO 2 — Verificar que la migración fue correcta

En el SQL Editor de Supabase, ejecutar:

```sql
SELECT u.email, r.rol, r.asignado_en
FROM public.roles r
JOIN auth.users u ON u.id = r.user_id
ORDER BY r.rol, u.email;
```

Deberías ver a todos los usuarios del sistema con sus roles asignados.

---

## ✅ PASO 3 — Gestionar roles desde ahora en adelante

**Ya no se usa `supabase.auth.updateUser()` para roles.**

Para subir a alguien a 'jefe':

```sql
UPDATE public.roles
SET rol = 'jefe', asignado_por = 'admin', asignado_en = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'usuario@diprotran.internal'
);
```

Para bajar a 'oficial':

```sql
UPDATE public.roles
SET rol = 'oficial', asignado_por = 'admin', asignado_en = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'usuario@diprotran.internal'
);
```

---

## ✅ PASO 4 — Agregar nuevo usuario al sistema

Cuando se incorpora un nuevo usuario:

1. Crearlo en **Authentication → Users → Invite user** con su email `@diprotran.internal`
2. El sistema le asigna automáticamente rol `oficial` por defecto (ver función `get_user_rol()`)
3. Si necesita rol `jefe`, ejecutar el UPDATE del Paso 3

> ⚠️ El nuevo usuario **no aparecerá en la tabla `roles`** hasta que inicie sesión por primera vez.
> La función `get_user_rol()` devuelve `'oficial'` si no hay registro — así que funciona correctamente de todas formas.
> Para forzar la inserción antes de que inicie sesión, usar:
> ```sql
> INSERT INTO public.roles (user_id, rol, asignado_por)
> VALUES ((SELECT id FROM auth.users WHERE email = 'nuevo@diprotran.internal'), 'oficial', 'admin');
> ```

---

## ⚡ PASO 5 — Limpiar historial de git (ver INSTRUCCIONES_LIMPIEZA_GIT.md)

El archivo `SETUP_PERSONAL_PII.sql` ya no contiene datos reales, pero el historial de git todavía los tiene. Seguir las instrucciones detalladas en `INSTRUCCIONES_LIMPIEZA_GIT.md`.

---

## 🔒 Qué cambió en la seguridad

| Antes | Ahora |
|-------|-------|
| Rol en `user_metadata` — modificable por el usuario | Rol en tabla `roles` — solo service_role puede escribir |
| `auth.jwt()->'user_metadata'->>'rol'` en RLS | `public.get_user_rol()` lee de `public.roles` |
| Cualquier usuario podía auto-promoverse a 'jefe' | **Imposible** sin acceso al Dashboard de Supabase |
| SETUP_PERSONAL_PII.sql con datos reales | Archivo vaciado, instrucciones de limpieza git provistas |
| SETUP_SUPABASE.sql con políticas débiles | Marcado como OBSOLETO, usar SETUP_ROLES_V2.sql |

---

## ❓ Verificación rápida post-instalación

Para confirmar que todo funciona, hacer esto desde la app:

1. Iniciar sesión con un usuario `oficial`
2. Verificar que el tab ⚙️ Admin **no aparece** en la navegación
3. Abrir la consola del navegador (F12) y ejecutar:
   ```js
   await supabase.auth.updateUser({ data: { rol: 'jefe' } })
   ```
4. Recargar la app — el tab Admin **no debe aparecer** (el rol se lee de la base de datos, no de user_metadata)
5. ✅ Si Admin sigue oculto, la corrección funcionó correctamente

---

*Auditoría de seguridad: Junio 2026 — Sistema DIPROTRAN*
