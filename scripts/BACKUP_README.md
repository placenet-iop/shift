# Sistema de Backup Automático

Sistema de copias de seguridad para cumplir con los requisitos legales del Real Decreto-ley 8/2019 (retención mínima de 4 años).

## Características

- ✅ Backup automático de la base de datos SQLite
- ✅ Compresión automática (gzip) para ahorrar espacio
- ✅ Retención configurable (por defecto 4 años / 1460 días)
- ✅ Rotación automática de backups antiguos
- ✅ Logs detallados de cada operación
- ✅ Verificación de integridad

## Uso Manual

### Ejecutar backup inmediato

```bash
npm run backup
```

O directamente:

```bash
./scripts/backup.sh
```

### Configuración mediante variables de entorno

```bash
# Ruta de la base de datos (por defecto: ./data/control_horario.db)
DB_PATH=./data/control_horario.db

# Directorio de backups (por defecto: ./backups)
BACKUP_DIR=./backups

# Días de retención (por defecto: 1460 días = 4 años)
RETENTION_DAYS=1460

# Ejemplo de ejecución personalizada
DB_PATH=/ruta/custom/db.db BACKUP_DIR=/ruta/backups ./scripts/backup.sh
```

## Automatización con Cron

### Opción 1: Backup Diario (Recomendado)

Ejecutar todos los días a las 2:00 AM:

```bash
# Editar crontab
crontab -e

# Añadir esta línea (ajustar rutas):
0 2 * * * cd /ruta/completa/shift && npm run backup >> /var/log/shift-backup.log 2>&1
```

### Opción 2: Backup Semanal

Ejecutar todos los domingos a las 3:00 AM:

```bash
0 3 * * 0 cd /ruta/completa/shift && npm run backup >> /var/log/shift-backup.log 2>&1
```

### Opción 3: Backup cada 6 horas

```bash
0 */6 * * * cd /ruta/completa/shift && npm run backup >> /var/log/shift-backup.log 2>&1
```

## Configuración con Systemd (Linux)

### 1. Crear servicio de backup

Crear archivo `/etc/systemd/system/shift-backup.service`:

```ini
[Unit]
Description=Shift Control Horario Backup
After=network.target

[Service]
Type=oneshot
User=tu_usuario
WorkingDirectory=/ruta/completa/shift
ExecStart=/usr/bin/npm run backup
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 2. Crear timer

Crear archivo `/etc/systemd/system/shift-backup.timer`:

```ini
[Unit]
Description=Shift Control Horario Backup Timer
Requires=shift-backup.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

### 3. Habilitar y activar

```bash
sudo systemctl daemon-reload
sudo systemctl enable shift-backup.timer
sudo systemctl start shift-backup.timer

# Verificar estado
sudo systemctl status shift-backup.timer
sudo systemctl list-timers
```

## Restaurar un Backup

### 1. Detener la aplicación

```bash
# Detener el servidor
npm stop  # o el comando que uses
```

### 2. Descomprimir el backup

```bash
# Ir al directorio de backups
cd backups

# Descomprimir el backup deseado
gunzip -k control_horario_YYYYMMDD_HHMMSS.db.gz
```

### 3. Restaurar la base de datos

```bash
# Hacer backup del estado actual (por seguridad)
cp data/control_horario.db data/control_horario.db.before_restore

# Restaurar el backup
cp backups/control_horario_YYYYMMDD_HHMMSS.db data/control_horario.db
```

### 4. Reiniciar la aplicación

```bash
npm run dev  # o el comando que uses
```

## Verificar Backups

### Listar todos los backups

```bash
ls -lh backups/
```

### Verificar el último backup

```bash
ls -lht backups/ | head -5
```

### Ver logs de backup (si usas systemd)

```bash
journalctl -u shift-backup.service -n 50
```

### Probar integridad de un backup

```bash
# Descomprimir temporalmente
gunzip -c backups/control_horario_YYYYMMDD_HHMMSS.db.gz > /tmp/test.db

# Verificar integridad con SQLite
sqlite3 /tmp/test.db "PRAGMA integrity_check;"

# Debería mostrar: ok

# Limpiar
rm /tmp/test.db
```

## Recomendaciones

### 1. Backup Remoto (Recomendado)

Para mayor seguridad, sincroniza los backups a un servidor remoto:

```bash
# Ejemplo con rsync
rsync -avz --delete backups/ usuario@servidor:/ruta/backups/shift/
```

### 2. Monitoreo

Configura alertas para detectar fallos en backups:

```bash
# Ejemplo simple: enviar email si falla
0 2 * * * cd /ruta/shift && npm run backup || echo "Backup falló" | mail -s "Error Backup Shift" admin@empresa.com
```

### 3. Retención según Política de Empresa

Si tu empresa requiere retención mayor a 4 años, configura:

```bash
# 7 años = 2555 días
RETENTION_DAYS=2555 ./scripts/backup.sh
```

## Solución de Problemas

### Error: "Base de datos no encontrada"

Verifica que la ruta en `.env` o `DB_PATH` sea correcta:

```bash
ls -l data/control_horario.db
```

### Error: "No space left on device"

Libera espacio o reduce `RETENTION_DAYS`:

```bash
# Ver espacio disponible
df -h

# Limpiar backups antiguos manualmente
find backups/ -name "*.db.gz" -mtime +365 -delete
```

### Backups muy grandes

Los backups están comprimidos con gzip. Si aún así ocupan mucho:

1. Verifica que no haya datos innecesarios en la BD
2. Considera archivado de datos antiguos (>4 años)
3. Usa compresión adicional: `xz` en lugar de `gzip`

## Cumplimiento Legal

Este sistema garantiza:

- ✅ **Retención mínima 4 años**: Configurado por defecto
- ✅ **Integridad**: Backups verificables con SQLite
- ✅ **Disponibilidad**: Múltiples copias con rotación
- ✅ **Trazabilidad**: Logs de cada backup realizado
- ✅ **Seguridad**: Backups comprimidos y almacenables remotamente

## Soporte

Para problemas o dudas sobre backups, contacta con el administrador del sistema.
