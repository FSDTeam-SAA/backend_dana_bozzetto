import multer from 'multer';
import path from 'path';

// Use Memory Storage (Stores file in req.file.buffer)
// Best for uploading directly to cloud services (AWS S3, Cloudinary, etc.)
const storage = multer.memoryStorage();

// File Validation
const fileFilter = (req, file, cb) => {
  // Expanded list to include common architectural/project management files
  const allowedFileTypes = /jpeg|jpg|png|pdf|dwg|dxf|zip|rar|xls|xlsx|doc|docx|txt/;
  
  const extname = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  
  // Check mime type (basic check, expanded for generic types)
  // Note: 'application/octet-stream' is often used for binary files like DWG/DXF/ZIP
  const mimetype =
    allowedFileTypes.test(file.mimetype) ||
    file.originalname.match(/\.(dwg|dxf|zip|rar)$/i) ||
    file.mimetype === 'application/octet-stream' ||
    file.mimetype === 'application/zip' || 
    file.mimetype === 'application/x-zip-compressed';

  if (extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Invalid file type. Allowed: Images, PDF, CAD (DWG/DXF), Archives (ZIP), Office Docs.'));
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