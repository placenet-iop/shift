#!/bin/bash

# Script de Backup Automático para Control Horario
# Cumplimiento: Real Decreto-ley 8/2019 (retención 4 años)

set -e

# Configuración
DB_PATH="${DB_PATH:-./data/control_horario.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-1460}"  # 4 años = 1460 días

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función de log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar que existe la base de datos
if [ ! -f "$DB_PATH" ]; then
    error "Base de datos no encontrada en: $DB_PATH"
    exit 1
fi

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Nombre del archivo de backup con timestamp
TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/control_horario_${TIMESTAMP}.db"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

log "Iniciando backup de la base de datos..."
log "Origen: $DB_PATH"
log "Destino: $BACKUP_FILE_GZ"

# Realizar backup usando SQLite3 (más seguro que cp)
if command -v sqlite3 &> /dev/null; then
    log "Usando SQLite3 para backup seguro..."
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
    warning "SQLite3 no encontrado, usando copia directa..."
    cp "$DB_PATH" "$BACKUP_FILE"
fi

# Comprimir el backup
log "Comprimiendo backup..."
gzip "$BACKUP_FILE"

# Verificar que el backup se creó correctamente
if [ -f "$BACKUP_FILE_GZ" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    log "✓ Backup completado exitosamente: $BACKUP_FILE_GZ ($BACKUP_SIZE)"
else
    error "Error al crear el backup"
    exit 1
fi

# Limpiar backups antiguos (mantener solo los últimos RETENTION_DAYS días)
log "Limpiando backups antiguos (retención: $RETENTION_DAYS días)..."
DELETED_COUNT=0

find "$BACKUP_DIR" -name "control_horario_*.db.gz" -type f -mtime +$RETENTION_DAYS | while read -r old_backup; do
    log "Eliminando backup antiguo: $(basename "$old_backup")"
    rm "$old_backup"
    DELETED_COUNT=$((DELETED_COUNT + 1))
done

# Listar backups existentes
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "control_horario_*.db.gz" -type f | wc -l)
log "Total de backups almacenados: $BACKUP_COUNT"

# Mostrar últimos 5 backups
log "Últimos backups:"
find "$BACKUP_DIR" -name "control_horario_*.db.gz" -type f -printf "%T@ %p\n" | sort -rn | head -5 | while read -r timestamp filepath; do
    size=$(du -h "$filepath" | cut -f1)
    date=$(date -d "@${timestamp%.*}" +'%Y-%m-%d %H:%M:%S')
    echo "  - $(basename "$filepath") ($size) - $date"
done

log "✓ Proceso de backup finalizado"
exit 0
