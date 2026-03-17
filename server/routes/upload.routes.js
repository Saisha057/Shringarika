import express from 'express';
import { uploadSingle, uploadMultiple, deleteImage, upload } from '../controllers/upload.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/single', protect, authorize('admin'), upload.single('image'), uploadSingle);
router.post('/image', protect, authorize('admin'), upload.single('image'), uploadSingle);  // alias used by api.ts
router.post('/multiple', protect, authorize('admin'), upload.array('images', 10), uploadMultiple);
router.delete('/:publicId', protect, authorize('admin'), deleteImage);

export default router;
