/**
 * Validation helper functions
 */

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (basic Canadian format)
 * @param {string} phone - Phone number
 * @returns {boolean} True if valid
 */
exports.isValidPhone = (phone) => {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  // Canadian phone numbers are 10 digits
  return digitsOnly.length === 10 || digitsOnly.length === 11;
};

/**
 * Validate date of birth
 * @param {Date|string} dob - Date of birth
 * @returns {boolean} True if valid (not future date)
 */
exports.isValidDOB = (dob) => {
  const date = new Date(dob);
  const today = new Date();
  return date <= today && !isNaN(date.getTime());
};

/**
 * Validate postal code (Canadian format)
 * @param {string} postalCode - Postal code
 * @returns {boolean} True if valid
 */
exports.isValidPostalCode = (postalCode) => {
  const postalRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
  return postalRegex.test(postalCode);
};
