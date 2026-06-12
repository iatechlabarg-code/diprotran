-- ══════════════════════════════════════════════════════════════════
--  DIPROTRANS — Tablas de Flota (secciones + vehiculos)
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query
--  Ejecutar TODO de una vez
-- ══════════════════════════════════════════════════════════════════

-- ── PASO 1: Crear tabla secciones ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.secciones (
  id    text PRIMARY KEY,
  label text NOT NULL,
  type  text NOT NULL,
  ord   int  DEFAULT 0
);

-- ── PASO 2: Crear tabla vehiculos ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id         bigserial PRIMARY KEY,
  seccion_id text NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
  ro         text NOT NULL,
  marca      text DEFAULT '',
  modelo     text DEFAULT '',
  dominio    text DEFAULT '',
  activo     bool DEFAULT true,
  ord        int  DEFAULT 0,
  UNIQUE(seccion_id, ro)
);

-- ── PASO 3: Activar RLS ────────────────────────────────────────
ALTER TABLE public.secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos  ENABLE ROW LEVEL SECURITY;

-- ── PASO 4: Eliminar políticas anteriores (si existen) ─────────
DROP POLICY IF EXISTS "auth_read_secciones"   ON public.secciones;
DROP POLICY IF EXISTS "auth_write_secciones"  ON public.secciones;
DROP POLICY IF EXISTS "auth_update_secciones" ON public.secciones;
DROP POLICY IF EXISTS "auth_delete_secciones" ON public.secciones;
DROP POLICY IF EXISTS "auth_read_vehiculos"   ON public.vehiculos;
DROP POLICY IF EXISTS "auth_write_vehiculos"  ON public.vehiculos;
DROP POLICY IF EXISTS "auth_update_vehiculos" ON public.vehiculos;
DROP POLICY IF EXISTS "auth_delete_vehiculos" ON public.vehiculos;

-- ── PASO 5: Políticas RLS para secciones ──────────────────────
CREATE POLICY "auth_read_secciones"
  ON public.secciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_secciones"
  ON public.secciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_secciones"
  ON public.secciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_secciones"
  ON public.secciones FOR DELETE TO authenticated USING (true);

-- ── PASO 6: Políticas RLS para vehiculos ──────────────────────
CREATE POLICY "auth_read_vehiculos"
  ON public.vehiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_vehiculos"
  ON public.vehiculos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_vehiculos"
  ON public.vehiculos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_delete_vehiculos"
  ON public.vehiculos FOR DELETE TO authenticated USING (true);

-- ── PASO 7: Insertar secciones ────────────────────────────────
INSERT INTO public.secciones (id, label, type, ord) VALUES
  ('sec1',    '1ª Sección',    'movil_std',    1),
  ('sec2',    '2ª Sección',    'movil_std',    2),
  ('sec3',    '3ª Sección',    'movil_std',    3),
  ('secSin',  'Sin Sección',   'movil_std',    4),
  ('secIC',   'IVECO Cursor',  'iveco_cursor', 5),
  ('secIT',   'IVECO Tector',  'iveco_tector', 6),
  ('secIN',   'IVECO Nuevos',  'iveco_nuevo',  7),
  ('secTall', 'Talleres',      'taller',       8),
  ('secCam',  'Camionetas',    'camioneta',    9),
  ('secTrans','Transit',       'transit',      10),
  ('secCar',  'Carretones',    'carretonable', 11),
  ('secMoto', 'Motos',         'moto',         12),
  ('secCont', 'Containers',    'container',    13),
  ('secNoId', 'No Identific.', 'no_ident',     14)
ON CONFLICT (id) DO NOTHING;

-- ── PASO 8: Insertar vehículos ────────────────────────────────

-- 1ª Sección
INSERT INTO public.vehiculos (seccion_id, ro, ord) VALUES
  ('sec1','28425',1),('sec1','28455',2),('sec1','28459',3),('sec1','28460',4),
  ('sec1','28512',5),('sec1','28538',6),('sec1','28541',7),('sec1','28544',8)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- 2ª Sección
INSERT INTO public.vehiculos (seccion_id, ro, ord) VALUES
  ('sec2','28521',1),('sec2','28524',2),('sec2','28526',3),('sec2','28533',4),
  ('sec2','28535',5),('sec2','28543',6),('sec2','28545',7),('sec2','28547',8),
  ('sec2','28550',9)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- 3ª Sección
INSERT INTO public.vehiculos (seccion_id, ro, ord) VALUES
  ('sec3','28427',1),('sec3','28437',2),('sec3','28457',3),('sec3','28525',4),
  ('sec3','28527',5),('sec3','28529',6),('sec3','28540',7),('sec3','28549',8)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- Sin Sección
INSERT INTO public.vehiculos (seccion_id, ro, ord) VALUES
  ('secSin','28423',1),('secSin','28430',2),('secSin','28436',3),('secSin','28453',4),
  ('secSin','28537',5),('secSin','28542',6),('secSin','28546',7),('secSin','28551',8)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- IVECO Cursor
INSERT INTO public.vehiculos (seccion_id, ro, ord) VALUES
  ('secIC','28496',1),('secIC','28501',2),('secIC','29498',3)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- IVECO Tector
INSERT INTO public.vehiculos (seccion_id, ro, ord) VALUES
  ('secIT','28463',1),('secIT','28464',2),('secIT','28465',3),('secIT','28466',4),
  ('secIT','28467',5),('secIT','28468',6),('secIT','28556',7),('secIT','28557',8),
  ('secIT','28558',9),('secIT','28480',10)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- IVECO Nuevos
INSERT INTO public.vehiculos (seccion_id, ro, modelo, ord) VALUES
  ('secIN','33019','Cursor',1),('secIN','33020','Cursor',2),
  ('secIN','33022','Cursor',3),('secIN','33023','Cursor',4),
  ('secIN','33024','Cursor',5),('secIN','33037','Cursor',6),
  ('secIN','33038','Tector',7),('secIN','33055','Tector',8)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- Talleres
INSERT INTO public.vehiculos (seccion_id, ro, modelo, ord) VALUES
  ('secTall','28552','IVECO Furgón',1),('secTall','33071','Tector',2)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- Camionetas
INSERT INTO public.vehiculos (seccion_id, ro, modelo, ord) VALUES
  ('secCam','26583','Hilux',1),('secCam','30720','Hilux',2),
  ('secCam','33447','Nissan',3),('secCam','33483','Nissan',4),
  ('secCam','45732','Hilux',5)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- Transit
INSERT INTO public.vehiculos (seccion_id, ro, modelo, ord) VALUES
  ('secTrans','34829','Ford Transit',1),('secTrans','34831','Ford Transit',2),
  ('secTrans','34832','Ford Transit',3),('secTrans','33029','Ford Transit',4)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- Carretones
INSERT INTO public.vehiculos (seccion_id, ro, marca, dominio, ord) VALUES
  ('secCar','28590','COMETO','AF066GC',1),
  ('secCar','CHASIS 0162','VIAL ERG','',2)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- Motos
INSERT INTO public.vehiculos (seccion_id, ro, modelo, ord) VALUES
  ('secMoto','24153','Corven Triax negra',1),
  ('secMoto','28640','Corven Triax blanca',2)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- Containers
INSERT INTO public.vehiculos (seccion_id, ro, marca, modelo, ord) VALUES
  ('secCont','0004',  'CSB','Simple',1),
  ('secCont','0012',  'CSB','Simple',2),
  ('secCont','0062',  'CSB','Blindado',3),
  ('secCont','MANT',  'CSB','Blindado',4),
  ('secCont','AG257DM','American Trailers','Unidad ministro',5),
  ('secCont','61878', 'Basani','Oficina móvil',6),
  ('secCont','61879', 'Basani','Oficina móvil',7)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- No Identificados
INSERT INTO public.vehiculos (seccion_id, ro, marca, modelo, ord) VALUES
  ('secNoId','NDA061', 'FORD',       'Ranger',          1),
  ('secNoId','MDH684', 'FORD',       'Mondeo',          2),
  ('secNoId','AD419LC','FORD',       'Focus',           3),
  ('secNoId','AD419LV','FORD',       'Focus',           4),
  ('secNoId','AD444NB','FORD',       'Focus',           5),
  ('secNoId','AE493SH','FORD',       'Ranger Limited',  6),
  ('secNoId','AA584PL','TOYOTA',     'Camry',           7),
  ('secNoId','AC385YP','TOYOTA',     'Camry',           8),
  ('secNoId','AC419OE','TOYOTA',     'Camry',           9),
  ('secNoId','AC419OD','TOYOTA',     'Camry',           10),
  ('secNoId','AA827VK','TOYOTA',     'Camry',           11),
  ('secNoId','AA584PR','TOYOTA',     'Camry',           12),
  ('secNoId','AA723IA','TOYOTA',     'Camry',           13),
  ('secNoId','JNM903', 'TOYOTA',     'Corolla',         14),
  ('secNoId','AA717ZA','TOYOTA',     'SW4',             15),
  ('secNoId','AA717B', 'TOYOTA',     'SW4',             16),
  ('secNoId','AD075ZD','TOYOTA',     'Hilux',           17),
  ('secNoId','NDA218', 'TOYOTA',     'Hilux',           18),
  ('secNoId','AC155IJ','RAM',        'Ram',             19),
  ('secNoId','AA053QB','RENAULT',    'Kangoo',          20),
  ('secNoId','AH964BI','RENAULT',    'Duster',          21),
  ('secNoId','AH160WP','VOLKSWAGEN', 'Amarok',          22),
  ('secNoId','AH199HF','VOLKSWAGEN', 'Amarok',          23),
  ('secNoId','AH202FH','VOLKSWAGEN', 'Amarok',          24),
  ('secNoId','AH202GO','VOLKSWAGEN', 'Amarok',          25),
  ('secNoId','AG110SH','VOLKSWAGEN', 'Amarok',          26),
  ('secNoId','AA778GU','VOLKSWAGEN', 'Up',              27),
  ('secNoId','AH166UO','PEUGEOT',    '208',             28),
  ('secNoId','AE129OY','AGRALE',     '4x4',             29),
  ('secNoId','A080NZR','BMW',        'Moto',            30),
  ('secNoId','A109TWC','BMW',        'Moto',            31)
ON CONFLICT (seccion_id, ro) DO NOTHING;

-- ── VERIFICACIÓN (ejecutar por separado) ──────────────────────
-- SELECT s.label, COUNT(v.id) AS total
-- FROM public.secciones s
-- LEFT JOIN public.vehiculos v ON v.seccion_id = s.id AND v.activo = true
-- GROUP BY s.id, s.label, s.ord
-- ORDER BY s.ord;
