/**
 * Portal Authentication Middleware
 * Protects HTML portal routes (/command-center, /reviewer, /iexperts, /ceo)
 * Uses JWT tokens stored in HTTP-only cookies
 */
const { verifyToken } = require('../auth');

function portalAuth(req, res, next) {
  // Check for JWT in cookie
  const token = req.cookies && req.cookies['tru_portal_token'];

  // Also check Authorization header (for API-style access)
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const activeToken = token || headerToken;

  if (!activeToken) {
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }

  const decoded = verifyToken(activeToken);
  if (!decoded) {
    // Token expired or invalid — clear cookie and redirect
    res.clearCookie('tru_portal_token');
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }

  req.user = decoded;
  next();
}

/**
 * API-level portal auth — returns 401 JSON instead of redirect
 * For protecting API endpoints that should require auth
 */
function portalAuthAPI(req, res, next) {
  const token = (req.cookies && req.cookies['tru_portal_token']) || null;
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const activeToken = token || headerToken;

  if (!activeToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const decoded = verifyToken(activeToken);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

module.exports = { portalAuth, portalAuthAPI };
