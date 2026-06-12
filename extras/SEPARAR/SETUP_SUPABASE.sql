-- ══════════════════════════════════════════════════════════════════
--  ⚠️  ARCHIVO OBSOLETO — NO EJECUTAR  ⚠️
--
--  Este archivo fue reemplazado por SETUP_ROLES_V2.sql
--  Razón: las políticas aquí definidas permiten que CUALQUIER
--  usuario autenticado modifique la tabla 'personal', lo cual
--  es una vulnerabilidad de seguridad (ver auditoría VULN-01).
--
--  ✅  Usar SETUP_ROLES_V2.sql en su lugar.
--
--  Fecha de obsolescencia: 2026-06-07
-- ══════════════════════════════════════════════════════════════════
--
--  ARCHIVO ORIGINAL PRESERVADO ABAJO SOLO COMO REFERENCIA HISTÓRICA
-- ══════════════════════════════════════════════════════════════════

-- ── PASO 1: Activar RLS en ambas tablas ────────────────────────
ALTER TABLE public.informes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;

-- ── PASO 2: Eliminar políticas anteriores (si existen) ─────────
DROP POLICY IF EXISTS "anon_read_informes"  ON public.informes;
DROP POLICY IF EXISTS "anon_write_informes" ON public.informes;
DROP POLICY IF EXISTS "anon_read_personal"  ON public.personal;
DROP POLICY IF EXISTS "anon_write_personal" ON public.personal;
DROP POLICY IF EXISTS "auth_read_informes"  ON public.informes;
DROP POLICY IF EXISTS "auth_write_informes" ON public.informes;
DROP POLICY IF EXISTS "auth_read_personal"  ON public.personal;
DROP POLICY IF EXISTS "auth_write_personal" ON public.personal;

-- ── PASO 3: Políticas para tabla "informes" ────────────────────
-- Solo usuarios autenticados pueden leer
CREATE POLICY "auth_read_informes"
  ON public.informes
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo usuarios autenticados pueden insertar
CREATE POLICY "auth_write_informes"
  ON public.informes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Solo usuarios autenticados pueden actualizar
CREATE POLICY "auth_update_informes"
  ON public.informes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── PASO 4: Políticas para tabla "personal" ────────────────────
-- Solo usuarios autenticados pueden leer
CREATE POLICY "auth_read_personal"
  ON public.personal
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo usuarios autenticados pueden insertar o actualizar (upsert)
CREATE POLICY "auth_write_personal"
  ON public.personal
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_personal"
  ON public.personal
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Nota: no se otorga DELETE a nadie por política.
-- Si en el futuro se necesita borrar, agregar política específica.

-- ── VERIFICACIÓN (opcional, ejecutar por separado) ─────────────
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN ('informes','personal')
-- ORDER BY tablename, cmd;
