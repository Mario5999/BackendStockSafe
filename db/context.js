const { pool } = require('./pool');

async function getDefaultRestaurantId(client = pool) {
  if (process.env.DEFAULT_RESTAURANT_ID) {
    return Number(process.env.DEFAULT_RESTAURANT_ID);
  }

  if (process.env.DEFAULT_RESTAURANT_EMAIL) {
    const byEmail = await client.query(
      'SELECT id FROM restaurantes WHERE lower(email) = lower($1) LIMIT 1',
      [process.env.DEFAULT_RESTAURANT_EMAIL]
    );

    if (byEmail.rows[0]) {
      return Number(byEmail.rows[0].id);
    }
  }

  const firstRestaurant = await client.query('SELECT id FROM restaurantes ORDER BY id ASC LIMIT 1');
  return firstRestaurant.rows[0] ? Number(firstRestaurant.rows[0].id) : null;
}

async function getDefaultRestaurantUserId(restauranteId, client = pool) {
  if (process.env.DEFAULT_RESTAURANT_USER_ID) {
    return Number(process.env.DEFAULT_RESTAURANT_USER_ID);
  }

  const preferredRole = process.env.DEFAULT_RESTAURANT_USER_ROLE || 'empleado';

  const byRole = await client.query(
    'SELECT id FROM restaurant_users WHERE restaurante_id = $1 AND rol = $2 ORDER BY id ASC LIMIT 1',
    [restauranteId, preferredRole]
  );

  if (byRole.rows[0]) {
    return Number(byRole.rows[0].id);
  }

  const anyUser = await client.query(
    'SELECT id FROM restaurant_users WHERE restaurante_id = $1 ORDER BY id ASC LIMIT 1',
    [restauranteId]
  );

  return anyUser.rows[0] ? Number(anyUser.rows[0].id) : null;
}

module.exports = {
  getDefaultRestaurantId,
  getDefaultRestaurantUserId,
};