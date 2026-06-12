# Configurar roles de usuario — DIPROTRANS

El sistema tiene dos roles:

| Rol | Acceso |
|-----|--------|
| `jefe` | Todo: turno actual, Historial, **Tab Admin** (flota/personal) |
| `oficial` | Solo turno actual e Historial. Sin Tab Admin. |

Sin configuración, todos los usuarios quedan como `oficial` por defecto.

---

## Cómo asignar el rol "jefe"

### Opción A — desde el Dashboard de Supabase (recomendado)

1. Ir a **supabase.com → tu proyecto → Authentication → Users**
2. Hacer click en el usuario que querés promover (ej: `cabral@diprotran.internal`)
3. En la columna **"User Metadata"** hacer click en el ícono de edición (lápiz)
4. Agregar o reemplazar con:
   ```json
   {"rol": "jefe"}
   ```
5. Guardar

El cambio se aplica la próxima vez que el usuario inicie sesión.

### Opción B — desde SQL Editor

```sql
-- Asignar rol "jefe" a un usuario específico
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"rol":"jefe"}'::jsonb
WHERE email = 'cabral@diprotran.internal';

-- Asignar rol "oficial" (quitar permisos de jefe)
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"rol":"oficial"}'::jsonb
WHERE email = 'villalba@diprotran.internal';
```

---

## Verificar roles actuales

```sql
SELECT email,
       raw_user_meta_data->>'rol' AS rol
FROM auth.users
WHERE email LIKE '%@diprotran.internal'
ORDER BY email;
```

---

## Qué ve cada rol

### Oficial
- Tab Inicio, Móviles, Exportar, Resumen, Personal, Historial
- Badge **"OFICIAL"** en la barra superior
- El tab ⚙️ Admin **no aparece** en la navegación
- Si intenta acceder directamente, ve un mensaje de acceso denegado

### Jefe
- Todos los tabs incluido ⚙️ Admin
- Badge **"JEFE"** en la barra superior
- Puede agregar/dar de baja vehículos y secciones
- Puede ver y gestionar el personal

---

## Usuarios sugeridos por rol

| Usuario | Rol sugerido |
|---------|-------------|
| `guardia@diprotran.internal` | `oficial` |
| `villalba@diprotran.internal` | `oficial` |
| `cabral@diprotran.internal` | `jefe` |
