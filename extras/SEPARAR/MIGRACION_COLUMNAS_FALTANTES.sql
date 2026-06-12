-- ══════════════════════════════════════════════════════════════════
--  MIGRACIÓN: Agregar columnas faltantes a tabla "informes"
--  Ejecutar en: Supabase → SQL Editor
--  Fecha: 2026-06-11
-- ══════════════════════════════════════════════════════════════════

-- Columna "eliminados": lista de vehículos dados de baja en el turno
ALTER TABLE public.informes
  ADD COLUMN IF NOT EXISTS eliminados JSONB DEFAULT '[]'::jsonb;

-- Columna "vacaciones": mapa de efectivos en JPK (persiste entre días)
ALTER TABLE public.informes
  ADD COLUMN IF NOT EXISTS vacaciones JSONB DEFAULT '{}'::jsonb;

-- Verificación: debería mostrar las columnas nuevas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'informes'
ORDER BY ordinal_position;
