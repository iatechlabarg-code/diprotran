# ⚠️ Limpieza de historial de git — URGENTE

El archivo `SETUP_PERSONAL_PII.sql` fue commiteado con datos personales reales de efectivos policiales (nombres, domicilios, teléfonos, armas, etc.).

Aunque el archivo ya está vacío de PII en el directorio, **los datos siguen existiendo en el historial de git**. Cualquier persona con acceso al repositorio puede recuperarlos con `git log` o `git show`.

---

## Paso 1 — Verificar si el repo fue alguna vez público

1. Ir a GitHub/GitLab donde está el repositorio
2. Revisar en Settings → Visibility si fue público en algún momento
3. **Si fue público aunque sea por un momento**: los datos pueden estar indexados. Contactar a Anthropic o un especialista en seguridad.

---

## Paso 2 — Limpiar el historial (elegir una opción)

### Opción A: `git filter-repo` (recomendado, más seguro)

```bash
# 1. Instalar git-filter-repo (si no lo tenés)
pip install git-filter-repo

# 2. Desde la carpeta del repositorio:
git filter-repo --path SETUP_PERSONAL_PII.sql --invert-paths --force

# 3. Verificar que no quedó rastro:
git log --all --full-history -- SETUP_PERSONAL_PII.sql
# Debe devolver NADA (lista vacía)
```

### Opción B: `BFG Repo Cleaner` (más simple)

```bash
# 1. Descargar BFG: https://rtyley.github.io/bfg-repo-cleaner/
# 2. Desde la carpeta del repositorio:
java -jar bfg.jar --delete-files SETUP_PERSONAL_PII.sql

# 3. Limpiar objetos huérfanos:
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Verificar:
git log --all --full-history -- SETUP_PERSONAL_PII.sql
```

---

## Paso 3 — Forzar push al repositorio remoto

⚠️ **Esto reescribe el historial. Coordinar con todos los colaboradores antes.**

```bash
git push origin --force --all
git push origin --force --tags
```

---

## Paso 4 — Informar a colaboradores

Todos los que tenían el repo clonado necesitan:

```bash
# Descartar su copia local y bajar la nueva versión limpia
git fetch --all
git reset --hard origin/main
# (o la rama que corresponda)
```

---

## Paso 5 — Revocar acceso a quienes ya no deban tenerlo

Revisar en GitHub/GitLab → Settings → Collaborators y quitar acceso
a cualquier persona que no debería ver estos datos.

---

## ✅ Checklist de verificación

- [ ] `git log --all -- SETUP_PERSONAL_PII.sql` devuelve vacío
- [ ] El push forzado fue exitoso
- [ ] Todos los colaboradores actualizaron su copia local
- [ ] Los accesos al repositorio fueron revisados
- [ ] En Supabase Dashboard, se verificó que los datos del personal siguen presentes en la base de datos (no se borraron datos reales, solo el archivo SQL)
