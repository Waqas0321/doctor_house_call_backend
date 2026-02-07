/**
 * Image upload to Cloudinary. Returns public URL to store in MongoDB.
 * Requires: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * If not configured, uploadImage returns null (caller can fall back to base64).
 */

let cloudinary = null;

function getCloudinary() {
  if (cloudinary) return cloudinary;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return null;
  }
  try {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    });
    return cloudinary;
  } catch (e) {
    console.warn('Cloudinary not available:', e.message);
    return null;
  }
}

/**
 * Upload image buffer to Cloudinary and return the public URL.
 * @param {Buffer} buffer - File buffer from multer
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @param {string} [folder] - Optional folder in Cloudinary (e.g. 'family-members')
 * @returns {Promise<string|null>} Public image URL or null if upload fails / not configured
 */
async function uploadImage(buffer, mimeType, folder = 'family-members') {
  const cld = getCloudinary();
  if (!cld || !buffer || !buffer.length) return null;

  try {
    const dataUri = `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
    const result = await cld.uploader.upload(dataUri, {
      folder,
      resource_type: 'image'
    });
    return result.secure_url || result.url || null;
  } catch (err) {
    console.error('Cloudinary upload error:', err.message);
    return null;
  }
}

module.exports = { uploadImage, getCloudinary };
