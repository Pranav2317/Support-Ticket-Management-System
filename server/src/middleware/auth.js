const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/** Verifies the Bearer JWT and loads the current user onto req.user. */
async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }

  // Load the user so a deleted user or a changed role takes effect immediately.
  const user = await User.findById(payload.sub);
  if (!user) return next(ApiError.unauthorized('User no longer exists'));
  req.user = user;
  next();
}

/** Role guard, e.g. authorize('admin'). */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

module.exports = { authenticate, authorize };
