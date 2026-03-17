import multer from 'multer';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.config.js';

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// @desc    Upload single image
// @route   POST /api/upload/single
// @access  Private/Admin
export const uploadSingle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload a file',
      });
    }

    const result = await uploadToCloudinary(req.file.buffer, req.body.folder || 'products');

    res.status(200).json({
      status: 'success',
      data: {
        url: result.url,
        public_id: result.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload multiple images
// @route   POST /api/upload/multiple
// @access  Private/Admin
export const uploadMultiple = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload files',
      });
    }

    const uploadPromises = req.files.map((file) =>
      uploadToCloudinary(file.buffer, req.body.folder || 'products')
    );

    const results = await Promise.all(uploadPromises);

    const images = results.map((result) => ({
      url: result.url,
      public_id: result.public_id,
    }));

    res.status(200).json({
      status: 'success',
      data: { images },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete image
// @route   DELETE /api/upload/:publicId
// @access  Private/Admin
export const deleteImage = async (req, res, next) => {
  try {
    const publicId = req.params.publicId.replace(/--/g, '/');

    const result = await deleteFromCloudinary(publicId);

    if (!result) {
      return res.status(400).json({
        status: 'error',
        message: 'Failed to delete image',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export { upload };
