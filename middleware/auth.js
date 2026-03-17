const { verifyAccessToken } = require('../utils/jwt');

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;

  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }

  const accessToken = typeof req.query.accessToken === 'string' ? req.query.accessToken : null;
  if (accessToken) {
    return accessToken;
  }

  const token = typeof req.query.token === 'string' ? req.query.token : null;
  return token;
}

function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido.' });
  }

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    const role = req.auth?.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción.' });
    }

    return next();
  };
}

function getScopedRestaurantId(req, options = {}) {
  const role = req.auth?.role;
  const authRestaurantId = Number(req.auth?.restauranteId);
  const queryValue = Number(options.queryValue);
  const bodyValue = Number(options.bodyValue);

  if (role === 'admin') {
    if (Number.isInteger(queryValue) && queryValue > 0) {
      return queryValue;
    }

    if (Number.isInteger(bodyValue) && bodyValue > 0) {
      return bodyValue;
    }

    return null;
  }

  if (Number.isInteger(authRestaurantId) && authRestaurantId > 0) {
    return authRestaurantId;
  }

  return null;
}

module.exports = {
  authenticateToken,
  requireRoles,
  getScopedRestaurantId,
};
