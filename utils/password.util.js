const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Hash password using MD5 hex digest to maintain 100% compatibility
 * with Growvidya database schema and PHP backend.
 */
async function hashPassword(plainPassword) {
  if (plainPassword === null || plainPassword === undefined) return '';
  return crypto.createHash('md5').update(String(plainPassword)).digest('hex');
}

/**
 * Compare plain text password against stored hash.
 * Supports MD5 (primary), bcrypt (hybrid), and plaintext fallback.
 */
async function comparePassword(plainPassword, storedHash) {
  if (!storedHash || !plainPassword) return false;

  const cleanPlain = String(plainPassword);
  const cleanStored = String(storedHash).trim();

  // 1. Primary Check: MD5 Hash match
  const md5Hash = crypto.createHash('md5').update(cleanPlain).digest('hex');
  if (md5Hash.toLowerCase() === cleanStored.toLowerCase()) {
    return true;
  }

  // 2. Hybrid Check: bcrypt hash (if password was previously hashed with bcrypt)
  if (cleanStored.startsWith('$2a$') || cleanStored.startsWith('$2b$') || cleanStored.startsWith('$2y$')) {
    try {
      const isBcryptValid = await bcrypt.compare(cleanPlain, cleanStored);
      if (isBcryptValid) return true;
    } catch (_) {}
  }

  // 3. Fallback Check: Plain text password match
  if (cleanPlain === cleanStored) {
    return true;
  }

  return false;
}

module.exports = {
  hashPassword,
  comparePassword,
};

