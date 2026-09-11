const { verifyToken } = require('../utils/jwt.util');
const config = require('../config/app.config');
const ApiResponse = require('../utils/api.response');

/**
 * Universal Authentication Middleware
 * Supports:
 * 1. Mobile Apps / API Clients: via 'Authorization: Bearer <token>' header
 * 2. Web Browser Clients: via HTTP-Only session cookies ('growvidya_session' / 'token')
 */
function authMiddleware(req, res, next) {
  try {
    let token = null;
    let authSource = 'none';

    // 1. Mobile & REST API Clients: Check HTTP Authorization Header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
      authSource = 'bearer_header';
    }
    // 2. Query param token (useful for direct file downloads and previews)
    else if (req.query?.token) {
      token = req.query.token;
      authSource = 'query_token';
    }
    // 3. Web Browser Sessions: Check Cookies (unsigned & signed cookies)
    else if (req.cookies || req.signedCookies) {
      const cookieName = config.cookie?.name || 'growvidya_session';
      token =
        req.cookies?.[cookieName] ||
        req.signedCookies?.[cookieName] ||
        req.cookies?.token ||
        req.signedCookies?.token ||
        req.cookies?.session_token ||
        null;
      if (token) {
        authSource = 'session_cookie';
      }
    }

    if (!token) {
      return ApiResponse.error(
        res,
        'Access denied. Authentication required. Please provide a Bearer token or sign in to establish a session.',
        null,
        401
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return ApiResponse.error(res, 'Invalid or expired authentication session/token.', null, 401);
    }

    // Attach decoded user payload and authentication source to request
    req.user = decoded;
    if (req.user) {
      if (req.user.schoolId && !req.user.school_id) {
        req.user.school_id = req.user.schoolId;
      } else if (req.user.school_id && !req.user.schoolId) {
        req.user.schoolId = req.user.school_id;
      }
    }
    req.authSource = authSource;

    next();
  } catch (error) {
    return ApiResponse.error(res, 'Authentication failed.', error.message, 401);
  }
}

module.exports = authMiddleware;

