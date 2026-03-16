const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const workspaceRoot = path.join(__dirname, '..', '..');

const knownTargets = {
  schema: path.join(workspaceRoot, 'Base de datos', 'postgresql_schema.sql'),
  seed: path.join(workspaceRoot, 'Base de datos', 'postgresql_seed.sql'),
};

function resolveTarget(targetArg) {
  if (knownTargets[targetArg]) {
    return knownTargets[targetArg];
  }

  if (path.isAbsolute(targetArg)) {
    return targetArg;
  }

  return path.resolve(process.cwd(), targetArg);
}

async function main() {
  const targetArg = process.argv[2];

  if (!targetArg) {
    console.error('[DB] Debes indicar un archivo SQL o usar: schema | seed');
    process.exit(1);
  }

  const sqlFilePath = resolveTarget(targetArg);

  if (!fs.existsSync(sqlFilePath)) {
    console.error(`[DB] No existe el archivo: ${sqlFilePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  try {
    await pool.query(sql);
    console.log(`[DB] SQL aplicado correctamente: ${sqlFilePath}`);
  } catch (error) {
    console.error('[DB] Error aplicando SQL:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();