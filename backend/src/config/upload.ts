import multer from 'multer';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

// Memory storage — files stay in buffer for Cloudinary upload
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP, SVG`));
    }
  },
});
