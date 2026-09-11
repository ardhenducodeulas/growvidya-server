const ApiResponse = require('../utils/api.response');

function errorMiddleware(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  const errors = err.errors || null;

  // Handle MySQL ER_DUP_ENTRY duplicate key error
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 400;
    const msg = String(err.message || '');
    if (msg.includes('email') || msg.includes('uq_') && msg.includes('email')) {
      message = 'An account with this email address already exists.';
    } else if (msg.includes('phone') || msg.includes('primary_contact_number') || msg.includes('uq_') && msg.includes('phone')) {
      message = 'An account with this mobile/phone number already exists.';
    } else {
      message = 'A record with this duplicate information already exists.';
    }
  }

  if (statusCode >= 500) {
    console.error('[Unhandled Server Error]', err);
  } else {
    console.warn(`[Client/Operational Error ${statusCode}]`, message);
  }

  return ApiResponse.error(res, message, errors, statusCode);
}

module.exports = errorMiddleware;
