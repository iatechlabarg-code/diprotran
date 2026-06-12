# Configurar Supabase Storage para fotos de daños

Seguí estos pasos para habilitar el adjunto de fotos en el modal de vehículos.

---

## Paso 1 — Crear el bucket

Ir a: **supabase.com → tu proyecto → Storage → New bucket**

- **Name**: `fotos-moviles`
- **Public bucket**: ✅ Activado (para que las fotos sean accesibles sin autenticación adicional)
- Click en **Save**

---

## Paso 2 — Configurar políticas del bucket

Ir a: **Storage → fotos-moviles → Policies → New policy → For full customization**

Crear las siguientes políticas:

### Política 1 — Subir fotos (INSERT)

```sql
CREATE POLICY "auth_upload_fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fotos-moviles');
```

### Política 2 — Ver fotos (SELECT)

```sql
CREATE POLICY "auth_read_fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'fotos-moviles');
```

### Política 3 — Borrar fotos (DELETE)

```sql
CREATE POLICY "auth_delete_fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fotos-moviles');
```

---

## Paso 3 — Verificar

Ir a **Storage → fotos-moviles** y confirmar que aparece el bucket vacío con las 3 políticas configuradas.

---

## Cómo funciona en la app

- En el modal de cualquier vehículo, al final del formulario aparece la sección **"Foto de daño"**
- Tocar el área punteada abre la cámara del teléfono (o el selector de archivos en desktop)
- La foto se comprime automáticamente a máx. 1200px antes de subir
- Si no hay conexión, se guarda localmente y sube a la nube la próxima vez que se guarda el informe
- Las fotos aparecen en las novedades del tab Resumen
- Estructura de archivos en el bucket: `{fecha}/{seccion}/{ro}_{timestamp}.jpg`
