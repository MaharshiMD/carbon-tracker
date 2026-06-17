const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No authorization header provided.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Access denied. Invalid token format (expected Bearer <token>).' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'carbon_tracker_local_secret_9988776655');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Access denied. Invalid or expired token.' });
  }
};
