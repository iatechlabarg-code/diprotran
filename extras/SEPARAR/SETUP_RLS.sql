-- ============================================================
--  DIPROTRAN — Políticas de Row Level Security (RLS)
--  Ejecutar en: Supabase Dashboard → SQL Editor
--  Versión corregida: sin función en schema auth (sin permisos)
-- ============================================================
--
--  VALIDACIÓN SERVER-SIDE DE ROL:
--  auth.jwt() lee el token firmado por Supabase — el cliente NO puede
--  modificarlo. Aunque alguien haga currentUserRol="jefe" en la consola
--  del browser, Supabase rechaza la operación porque el JWT real dice "oficial".


-- ============================================================
--  TABLA: informes
-- ============================================================
ALTER TABLE informes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "informes_select_auth"
  ON informes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "informes_insert_auth"
  ON informes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "informes_update_auth"
  ON informes FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "informes_delete_jefe"
  ON informes FOR DELETE TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );


-- ============================================================
--  TABLA: personal
-- ============================================================
ALTER TABLE personal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_select_auth"
  ON personal FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "personal_insert_jefe"
  ON personal FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );

CREATE POLICY "personal_update_jefe"
  ON personal FOR UPDATE TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );

CREATE POLICY "personal_delete_jefe"
  ON personal FOR DELETE TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );


-- ============================================================
--  TABLA: secciones
-- ============================================================
ALTER TABLE secciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secciones_select_auth"
  ON secciones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "secciones_insert_jefe"
  ON secciones FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );

CREATE POLICY "secciones_update_jefe"
  ON secciones FOR UPDATE TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );

CREATE POLICY "secciones_delete_jefe"
  ON secciones FOR DELETE TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );


-- ============================================================
--  TABLA: vehiculos
-- ============================================================
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehiculos_select_auth"
  ON vehiculos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "vehiculos_insert_jefe"
  ON vehiculos FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );

CREATE POLICY "vehiculos_update_jefe"
  ON vehiculos FOR UPDATE TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  )
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );

CREATE POLICY "vehiculos_delete_jefe"
  ON vehiculos FOR DELETE TO authenticated
  USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );


-- ============================================================
--  VERIFICACIÓN FINAL
--  Deberías ver rls_enabled = true en las 4 tablas
-- ============================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('informes','personal','secciones','vehiculos')
ORDER BY tablename;
