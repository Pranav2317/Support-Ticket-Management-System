const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

async function register({ name, email, password }) {
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  // Public sign-up always creates a regular user. Admins are created by the seed script
  // (or promoted directly in the database), so nobody can self-register as admin.
  const user = await User.create({ name, email, password });
  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  // Same message for "no such user" and "wrong password" to avoid account enumeration.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  return { user, token: signToken(user) };
}

module.exports = { register, login, signToken };
