-- ══════════════════════════════════════════════════════════════════
--  MIGRACIÓN: Crear o completar la tabla "personal"
--  Ejecutar en: Supabase Dashboard → SQL Editor
--  Fecha: 2026-06-11
--
--  Este script es seguro de ejecutar múltiples veces (idempotente).
--  Si la tabla ya existe, solo agrega las columnas que faltan.
--  Si no existe, la crea completa.
-- ══════════════════════════════════════════════════════════════════

-- ── PASO 1: Crear tabla si no existe ──────────────────────────────
--
--  IMPORTANTE: el id es TEXT porque el sistema usa ids como
--  "p01", "p02", ..., "p07" para el personal base y
--  "px_1749639000000" (px_ + timestamp) para personal extra.
--
CREATE TABLE IF NOT EXISTS public.personal (
  id                TEXT PRIMARY KEY,
  nombre            TEXT NOT NULL DEFAULT '',
  jerarquia         TEXT DEFAULT '',
  escalafon         TEXT DEFAULT '',
  subescalafon      TEXT DEFAULT '',
  legajo            TEXT DEFAULT '',
  destino           TEXT DEFAULT '',
  calle             TEXT DEFAULT '—',
  localidad         TEXT DEFAULT '—',
  partido           TEXT DEFAULT '—',
  fecha_nac         TEXT DEFAULT '',
  fecha_ingreso     TEXT DEFAULT '',
  cel               TEXT DEFAULT '—',
  email             TEXT DEFAULT '—',
  lic_hab           TEXT DEFAULT '—',
  armamento         TEXT DEFAULT '—',
  chaleco           TEXT DEFAULT '—',
  cria_jurisd       TEXT DEFAULT '—',
  grupo_sanguineo   TEXT DEFAULT '—',
  factor_rh         TEXT DEFAULT '—',
  situacion_revista TEXT DEFAULT 'servicio_activo',
  vac_hasta         TEXT DEFAULT '',
  nota              TEXT DEFAULT '',
  funcion_base      TEXT DEFAULT 'guardia',
  funcion_fija      BOOLEAN DEFAULT false,
  ord               INT DEFAULT 99,
  activo            BOOLEAN DEFAULT true
);


-- ── PASO 2: Agregar columnas que pueden faltar en tabla existente ──
--  (Si la tabla ya existía sin estas columnas)

ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS factor_rh         TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS vac_hasta         TEXT DEFAULT '';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS nota              TEXT DEFAULT '';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS funcion_fija      BOOLEAN DEFAULT false;
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS activo            BOOLEAN DEFAULT true;
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS situacion_revista TEXT DEFAULT 'servicio_activo';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS calle             TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS localidad         TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS partido           TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS destino           TEXT DEFAULT '';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS grupo_sanguineo   TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS cria_jurisd       TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS armamento         TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS chaleco           TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS lic_hab           TEXT DEFAULT '—';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS funcion_base      TEXT DEFAULT 'guardia';
ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS ord               INT DEFAULT 99;


-- ── PASO 3: Activar RLS ───────────────────────────────────────────
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;


-- ── PASO 4: Recrear políticas RLS ────────────────────────────────
--  (DROP IF EXISTS + CREATE para que quede limpio sin importar
--   cuál versión de RLS se ejecutó antes)

DROP POLICY IF EXISTS "personal_select_auth"  ON public.personal;
DROP POLICY IF EXISTS "personal_insert_jefe"  ON public.personal;
DROP POLICY IF EXISTS "personal_update_jefe"  ON public.personal;
DROP POLICY IF EXISTS "personal_delete_jefe"  ON public.personal;
DROP POLICY IF EXISTS "auth_read_personal"    ON public.personal;
DROP POLICY IF EXISTS "auth_write_personal"   ON public.personal;
DROP POLICY IF EXISTS "auth_update_personal"  ON public.personal;

-- Todos pueden leer personal
CREATE POLICY "personal_select_auth"
  ON public.personal FOR SELECT TO authenticated
  USING (true);

-- Solo 'jefe' puede insertar (usa user_metadata para compatibilidad con SETUP_RLS.sql)
CREATE POLICY "personal_insert_jefe"
  ON public.personal FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe'
  );

-- Solo 'jefe' puede actualizar
CREATE POLICY "personal_update_jefe"
  ON public.personal FOR UPDATE TO authenticated
  USING  (COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe')
  WITH CHECK (COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe');

-- Solo 'jefe' puede eliminar
CREATE POLICY "personal_delete_jefe"
  ON public.personal FOR DELETE TO authenticated
  USING  (COALESCE((auth.jwt() -> 'user_metadata' ->> 'rol'), 'oficial') = 'jefe');


-- ── VERIFICACIÓN FINAL ────────────────────────────────────────────
--  Debería mostrar todas las columnas de la tabla personal.

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'personal'
ORDER BY ordinal_position;
