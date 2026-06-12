-- ============================================================
--  DIPROTRAN — Sistema de Roles Seguro (V2)
--  REEMPLAZA a: SETUP_RLS.sql y SETUP_SUPABASE.sql
--
--  CAMBIO PRINCIPAL vs versión anterior:
--    ❌ ANTES: rol en user_metadata → cualquier usuario podía
--             modificarlo con supabase.auth.updateUser()
--    ✅ AHORA: rol en tabla public.roles → solo service_role
--             puede modificarla (no es accesible por el cliente)
--
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query
--  Ejecutar TODO de una vez (seleccionar todo y Run)
-- ============================================================


-- ============================================================
--  PARTE 1: TABLA DE ROLES
--  Solo service_role puede INSERT/UPDATE/DELETE.
--  Los usuarios autenticados solo pueden leer su propio rol.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roles (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  rol         TEXT NOT NULL DEFAULT 'oficial'
              CHECK (rol IN ('oficial', 'jefe')),
  asignado_por TEXT,
  asignado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS activado: sin políticas de escritura para 'authenticated'
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Los usuarios autenticados pueden leer todos los roles (necesario para la función helper)
CREATE POLICY "roles_select_auth"
  ON public.roles FOR SELECT TO authenticated
  USING (true);

-- ⛔ NO se agregan políticas INSERT/UPDATE/DELETE para 'authenticated'.
--    Solo service_role (Dashboard o API admin) puede modificar esta tabla.
--    Esto es lo que impide la escalación de privilegios.


-- ============================================================
--  PARTE 2: FUNCIÓN HELPER get_user_rol()
--  Lee el rol del usuario actual desde la tabla roles.
--  SECURITY DEFINER: se ejecuta con permisos del owner (postgres),
--  lo que permite leer la tabla roles aunque el usuario no tenga
--  acceso directo. search_path fijado para evitar inyección.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_rol()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT rol FROM public.roles WHERE user_id = auth.uid()),
    'oficial'
  );
$$;

-- Revocar acceso público y otorgar solo a authenticated
REVOKE ALL ON FUNCTION public.get_user_rol() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_rol() TO authenticated;


-- ============================================================
--  PARTE 3: ELIMINAR POLÍTICAS VIEJAS (si existen)
--  Las políticas anteriores usaban user_metadata — las reemplazamos.
-- ============================================================

-- informes
DROP POLICY IF EXISTS "informes_select_auth"    ON public.informes;
DROP POLICY IF EXISTS "informes_insert_auth"    ON public.informes;
DROP POLICY IF EXISTS "informes_update_auth"    ON public.informes;
DROP POLICY IF EXISTS "informes_delete_jefe"    ON public.informes;
DROP POLICY IF EXISTS "auth_read_informes"      ON public.informes;
DROP POLICY IF EXISTS "auth_write_informes"     ON public.informes;
DROP POLICY IF EXISTS "auth_update_informes"    ON public.informes;

-- personal
DROP POLICY IF EXISTS "personal_select_auth"   ON public.personal;
DROP POLICY IF EXISTS "personal_insert_jefe"   ON public.personal;
DROP POLICY IF EXISTS "personal_update_jefe"   ON public.personal;
DROP POLICY IF EXISTS "personal_delete_jefe"   ON public.personal;
DROP POLICY IF EXISTS "auth_read_personal"     ON public.personal;
DROP POLICY IF EXISTS "auth_write_personal"    ON public.personal;
DROP POLICY IF EXISTS "auth_update_personal"   ON public.personal;

-- secciones
DROP POLICY IF EXISTS "secciones_select_auth"  ON public.secciones;
DROP POLICY IF EXISTS "secciones_insert_jefe"  ON public.secciones;
DROP POLICY IF EXISTS "secciones_update_jefe"  ON public.secciones;
DROP POLICY IF EXISTS "secciones_delete_jefe"  ON public.secciones;

-- vehiculos
DROP POLICY IF EXISTS "vehiculos_select_auth"  ON public.vehiculos;
DROP POLICY IF EXISTS "vehiculos_insert_jefe"  ON public.vehiculos;
DROP POLICY IF EXISTS "vehiculos_update_jefe"  ON public.vehiculos;
DROP POLICY IF EXISTS "vehiculos_delete_jefe"  ON public.vehiculos;


-- ============================================================
--  PARTE 4: NUEVAS POLÍTICAS RLS (usan get_user_rol())
--  La función lee de la tabla roles — NO de user_metadata.
-- ============================================================

-- ── TABLA: informes ────────────────────────────────────────

ALTER TABLE public.informes ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer informes
CREATE POLICY "informes_select_auth"
  ON public.informes FOR SELECT TO authenticated
  USING (true);

-- Todos los autenticados pueden crear informes (registrar guardia)
CREATE POLICY "informes_insert_auth"
  ON public.informes FOR INSERT TO authenticated
  WITH CHECK (true);

-- Todos los autenticados pueden actualizar (auto-guardado, cola offline)
CREATE POLICY "informes_update_auth"
  ON public.informes FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Solo 'jefe' puede eliminar informes
CREATE POLICY "informes_delete_jefe"
  ON public.informes FOR DELETE TO authenticated
  USING (public.get_user_rol() = 'jefe');


-- ── TABLA: personal ────────────────────────────────────────

ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer el personal
CREATE POLICY "personal_select_auth"
  ON public.personal FOR SELECT TO authenticated
  USING (true);

-- Solo 'jefe' puede agregar personal
CREATE POLICY "personal_insert_jefe"
  ON public.personal FOR INSERT TO authenticated
  WITH CHECK (public.get_user_rol() = 'jefe');

-- Solo 'jefe' puede modificar personal
CREATE POLICY "personal_update_jefe"
  ON public.personal FOR UPDATE TO authenticated
  USING  (public.get_user_rol() = 'jefe')
  WITH CHECK (public.get_user_rol() = 'jefe');

-- Solo 'jefe' puede eliminar personal
CREATE POLICY "personal_delete_jefe"
  ON public.personal FOR DELETE TO authenticated
  USING (public.get_user_rol() = 'jefe');


-- ── TABLA: secciones ───────────────────────────────────────

ALTER TABLE public.secciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secciones_select_auth"
  ON public.secciones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "secciones_insert_jefe"
  ON public.secciones FOR INSERT TO authenticated
  WITH CHECK (public.get_user_rol() = 'jefe');

CREATE POLICY "secciones_update_jefe"
  ON public.secciones FOR UPDATE TO authenticated
  USING  (public.get_user_rol() = 'jefe')
  WITH CHECK (public.get_user_rol() = 'jefe');

CREATE POLICY "secciones_delete_jefe"
  ON public.secciones FOR DELETE TO authenticated
  USING (public.get_user_rol() = 'jefe');


-- ── TABLA: vehiculos ───────────────────────────────────────

ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehiculos_select_auth"
  ON public.vehiculos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "vehiculos_insert_jefe"
  ON public.vehiculos FOR INSERT TO authenticated
  WITH CHECK (public.get_user_rol() = 'jefe');

CREATE POLICY "vehiculos_update_jefe"
  ON public.vehiculos FOR UPDATE TO authenticated
  USING  (public.get_user_rol() = 'jefe')
  WITH CHECK (public.get_user_rol() = 'jefe');

CREATE POLICY "vehiculos_delete_jefe"
  ON public.vehiculos FOR DELETE TO authenticated
  USING (public.get_user_rol() = 'jefe');


-- ============================================================
--  PARTE 5: MIGRAR USUARIOS EXISTENTES
--  Toma el rol actual de user_metadata y lo copia a la tabla roles.
--  Ejecutar UNA sola vez luego de crear la tabla.
--  Después de esto, ya no se lee más user_metadata para roles.
-- ============================================================

INSERT INTO public.roles (user_id, rol, asignado_por, asignado_en)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'rol', 'oficial') AS rol,
  'migración automática desde user_metadata'      AS asignado_por,
  NOW()                                           AS asignado_en
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
  SET rol         = EXCLUDED.rol,
      asignado_por = EXCLUDED.asignado_por,
      asignado_en  = EXCLUDED.asignado_en;


-- ============================================================
--  PARTE 6: ASIGNAR ROL JEFE MANUALMENTE
--  Después de la migración, gestionar roles SOLO desde acá o
--  desde el Dashboard de Supabase con service_role.
--  NUNCA volver a usar supabase.auth.updateUser() para roles.
-- ============================================================

-- Para asignar 'jefe' a un usuario:
-- UPDATE public.roles
-- SET rol = 'jefe', asignado_por = 'admin', asignado_en = NOW()
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'cabral@diprotran.internal');

-- Para bajar a 'oficial':
-- UPDATE public.roles
-- SET rol = 'oficial', asignado_por = 'admin', asignado_en = NOW()
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'villalba@diprotran.internal');


-- ============================================================
--  VERIFICACIÓN FINAL
--  Ejecutar por separado para confirmar que todo quedó bien.
-- ============================================================

-- Ver roles asignados:
-- SELECT u.email, r.rol, r.asignado_en
-- FROM public.roles r
-- JOIN auth.users u ON u.id = r.user_id
-- ORDER BY r.rol, u.email;

-- Verificar que RLS está activo en las 4 tablas + roles:
-- SELECT tablename, rowsecurity AS rls_enabled
-- FROM pg_tables
-- WHERE tablename IN ('informes','personal','secciones','vehiculos','roles')
-- ORDER BY tablename;

-- Verificar políticas creadas:
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE tablename IN ('informes','personal','secciones','vehiculos','roles')
-- ORDER BY tablename, cmd;

-- Probar la función como usuario autenticado:
-- SELECT public.get_user_rol();
-- Debe devolver 'oficial' o 'jefe' según el usuario actual.
