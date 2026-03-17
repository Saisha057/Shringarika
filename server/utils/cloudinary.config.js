import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// NOTE: Do NOT call cloudinary.config() at module-load time.
// This file is imported via static ES module imports which are hoisted and
// run BEFORE dotenv.config() executes in server.js — so process.env values
// would be undefined. Configure lazily inside each function instead.

const getCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

export const uploadToCloudinary = async (buffer, folder = 'products') => {
  const cld = getCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = cld.uploader.upload_stream(
      {
        folder: `shringarika/${folder}`,
        resource_type: 'auto',
        transformation: [
          { width: 1000, height: 1000, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        }
      }
    );

    const stream = Readable.from(buffer);
    stream.pipe(uploadStream);
  });
};

export const deleteFromCloudinary = async (public_id) => {
  try {
    const cld = getCloudinary();
    await cld.uploader.destroy(public_id);
    return true;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return false;
  }
};

export default cloudinary;
