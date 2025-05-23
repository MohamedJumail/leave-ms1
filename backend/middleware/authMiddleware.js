const jwt = require('jsonwebtoken');
const Boom = require('@hapi/boom');

require('dotenv').config();

const verifyToken = {
  assign: 'auth', // attach decoded token to request.pre.auth
  method: async (request, h) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw Boom.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded; // returned value becomes request.pre.auth
    } catch (err) {
      throw Boom.unauthorized('Invalid or expired token');
    }
  },
};

const roleCheck = (roles) => {
  return (request, h) => {
    const user = request.pre.auth;
    if (!roles.includes(user.role)) {
      return h.response({ msg: 'Access denied' }).code(403).takeover();
    }
    return h.continue;
  };
};

module.exports = { verifyToken, roleCheck };
