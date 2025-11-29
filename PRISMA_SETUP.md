# Prisma Database Setup

This document explains how to configure Shift to use the new Prisma-powered SQLite database. The legacy `data/control_horario.db` file is no longer used.

## 1. Requirements

- Node.js 18+
- npm (or pnpm/yarn)
- SQLite3 CLI (optional, useful for inspecting the DB)

## 2. Install dependencies

```bash
cd shift
npm install
```

## 3. Configure environment

**IMPORTANT**: You must create a `.env` file in the `shift/` directory (same folder as `package.json`).

Create (or update) `shift/.env` with:

```bash
DATABASE_URL="file:./shift.db"
JWT_SECRET="dev-secret-change-me"
NODE_ENV=development
```

**Critical Notes**:
- The `.env` file must be in the `shift/` directory (project root), same folder as `package.json`
- The path `file:./shift.db` creates the database at `shift/shift.db` (root of the project)
- The old `data/control_horario.db` database is no longer used and can be deleted
- Set `JWT_SECRET` to the same value used by Placenet in production
- After creating `.env`, run `npx prisma generate` and `npx prisma db push` from the `shift/` directory

## 4. Initialize the database

```bash
# Ensure Prisma client + schema are in sync
npx prisma generate

# Create/update the SQLite file based on schema.prisma
npx prisma db push

# (Optional) inspect data or verify tables
sqlite3 ./shift.db ".tables"
```

## 5. Seed local appdev users (optional)

If you use `appdev/apps/shift.json` for authentication profiles, mirror those entries into the Prisma DB so API calls succeed:

```bash
# from shift/
npm run seed:appdev

# Custom location (optional)
APPDEV_SHIFT_JSON=/absolute/path/to/shift.json npm run seed:appdev
```

The script upserts users by email (creates them if they don't exist, updates fields otherwise).

## 6. Run the app

```bash
npm run dev     # development server (http://localhost:5173)
npm run check   # type + svelte checks
npm run build   # production build
```

## 7. Useful commands

```bash
# Open Prisma Studio (visual editor)
npx prisma studio

# Reset database (drops and recreates tables)
npx prisma migrate reset
```

## 8. Backups

Use the provided script (now pointing to `shift.db`):

```bash
./scripts/backup.sh
```

The script writes compressed copies under `./backups/shift_records_*.db.gz`. Adjust `DB_PATH`, `BACKUP_DIR`, or retention via environment variables if needed.

