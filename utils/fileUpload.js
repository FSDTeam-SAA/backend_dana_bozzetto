import multer from 'multer';
import path from 'path';

// Use Memory Storage (Stores file in req.file.buffer)
// Best for uploading directly to cloud services (AWS S3, Cloudinary, etc.)
const storage = multer.memoryStorage();

// File Validation
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|pdf|dwg|dxf/;
  const extname = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  // Check mime type (basic check, can be expanded)
  // CAD files often have complex mime types, so extension check is often safer for them
  const mimetype =
    allowedFileTypes.test(file.mimetype) ||
    file.originalname.match(/\.(dwg|dxf)$/i);

  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Invalid file type. Only Images, PDFs, and CAD files are allowed!'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (Architectural files can be large)
  },
  fileFilter,
});

export default upload;