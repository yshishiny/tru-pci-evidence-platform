const { verifyToken } = require('../auth');

function requireAuth(req, res, next) {
  let token = null;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback to portal cookie
  if (!token && req.cookies && req.cookies['tru_portal_token']) {
    token = req.cookies['tru_portal_token'];
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid authorization' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

module.exports = requireAuth;
