import { Document } from '../model/Document.js';
import { Project } from '../model/Project.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// @desc    Upload new document(s)
// @route   POST /api/documents
// @access  Private
export const uploadDocument = async (req, res) => {
  try {
    const { 
      projectId, 
      milestoneId, 
      notes,
      type // Allow frontend to specify type (e.g. 'DWG')
    } = req.body;

    // Check if files exist (Supports both single 'file' or multiple 'files')
    let files = [];
    if (req.files && req.files.length > 0) {
      files = req.files;
    } else if (req.file) {
      files = [req.file];
    } else {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedDocs = [];

    // Process all files in parallel
    const uploadPromises = files.map(async (file) => {
      // 1. Upload to Cloudinary
      // Note: For CAD files (DWG), Cloudinary might treat them as 'raw' or 'image' depending on config.
      const result = await uploadToCloudinary(file.buffer, 'architectural-projects/documents');
      
      // 2. Handle Versioning (Find latest version of THIS specific file name in THIS project)
      const existingDoc = await Document.findOne({ 
        project: projectId, 
        name: file.originalname 
      }).sort({ version: -1 });

      const nextVersion = existingDoc ? existingDoc.version + 1 : 1;

      // 3. Determine Document Type
      let docType = 'Other';
      if (type) {
        docType = type;
      } else {
        // Auto-detection fallback
        const fmt = result.format || file.mimetype;
        if (fmt.includes('pdf')) docType = 'PDF';
        else if (fmt.match(/jpg|jpeg|png/)) docType = 'JPG'; // Simplified mapping
        else if (file.originalname.match(/\.(dwg|dxf)$/i)) docType = 'DWG';
      }

      // 4. Create Document Record
      const newDoc = await Document.create({
        name: file.originalname,
        project: projectId,
        milestoneId,
        uploadedBy: req.user._id,
        file: {
          public_id: result.public_id,
          url: result.secure_url,
          mimeType: file.mimetype,
          size: file.size,
          format: result.format
        },
        type: docType,
        version: nextVersion,
        notes,
        status: 'Pending'
      });

      uploadedDocs.push(newDoc);
    });

    await Promise.all(uploadPromises);

    res.status(201).json(uploadedDocs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all documents for a specific project
export const getProjectDocuments = async (req, res) => {
    try {
      const { milestoneId } = req.query;
      const query = { project: req.params.projectId };
      if (milestoneId) query.milestoneId = milestoneId;
  
      const documents = await Document.find(query)
        .populate('uploadedBy', 'name role avatar')
        .sort({ createdAt: -1 });
  
      res.json(documents);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
// @desc    Update Document Status
  export const updateDocumentStatus = async (req, res) => {
    try {
      const { status } = req.body;
      const document = await Document.findById(req.params.id);
      if (!document) return res.status(404).json({ message: 'Document not found' });
  
      document.status = status;
      if (status === 'Approved') {
        document.approvedBy = req.user._id;
        document.approvedDate = Date.now();
      }
      await document.save();
      res.json(document);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
// @desc    Add Comment to Document
  export const addComment = async (req, res) => {
    try {
      const { text } = req.body;
      const document = await Document.findById(req.params.id);
      if (!document) return res.status(404).json({ message: 'Document not found' });
  
      document.comments.push({
        user: req.user._id,
        text,
        createdAt: Date.now()
      });
      await document.save();
      res.status(201).json(document);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  };