const bcrypt = require('bcrypt');

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

function isStrongPassword(password) {
  const value = String(password || '');
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function isBcryptHash(value) {
  return BCRYPT_HASH_REGEX.test(String(value || ''));
}

async function hashPassword(password) {
  return bcrypt.hash(String(password || ''), BCRYPT_SALT_ROUNDS);
}

async function verifyPassword(password, storedHash) {
  const incoming = String(password || '');
  const persisted = String(storedHash || '');

  if (!persisted) {
    return { match: false, needsRehash: false };
  }

  if (isBcryptHash(persisted)) {
    const match = await bcrypt.compare(incoming, persisted);
    return { match, needsRehash: false };
  }

  const legacyMatch = incoming === persisted;
  return { match: legacyMatch, needsRehash: legacyMatch };
}

module.exports = {
  isStrongPassword,
  hashPassword,
  verifyPassword,
};
