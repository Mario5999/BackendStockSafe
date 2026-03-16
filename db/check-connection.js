const { pool } = require('./pool');

async function main() {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database_name, current_user AS db_user, now() AS server_time'
    );

    const row = result.rows[0];
    console.log('[DB] Conexion OK');
    console.log(`[DB] Base de datos: ${row.database_name}`);
    console.log(`[DB] Usuario: ${row.db_user}`);
    console.log(`[DB] Hora servidor: ${row.server_time}`);
  } catch (error) {
    console.error('[DB] Fallo de conexion:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();