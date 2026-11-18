import express from 'express';
import multer from 'multer';
import SectionFile from '../../models/SectionFile.js';
import Section from '../../models/Section.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types, you can add restrictions here
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mov', 'video/webm'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

/**
 * GET /api/section-files/:sectionId
 * Get all files for a section
 */
router.get('/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // ❌ Temporarily remove the canAccessSectionFiles check
    // ✅ Continue straight to fetching files

    const files = await SectionFile.find({ section: sectionId })
      .populate('uploadedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    const formattedFiles = files.map(file => ({
      id: file._id,
      name: file.originalName,
      filename: file.filename,
      type: file.fileType,
      size: file.formattedSize,
      url: file.cloudinaryUrl,
      date: file.createdAt.toISOString().split('T')[0],
      uploadedBy: file.uploadedBy?.fullName || 'Unknown',
      description: file.description,
      tags: file.tags,
      isPublic: file.isPublic,
      icon: file.icon,
      color: file.color
    }));

    res.json({
      success: true,
      files: formattedFiles,
      message: files.length ? 'Files loaded successfully' : 'No files found'
    });
  } catch (error) {
    console.error('❌ Error fetching section files:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching files'
    });
  }
});



/**
 * POST /api/section-files/:sectionId/upload
 * Upload files to a section
 */
router.post('/:sectionId/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { sectionId } = req.params;
    const uploadedBy = req.session.user?.id;

    if (!uploadedBy) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Verify section exists
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = [];
    const errors = [];

    // Process each file
    for (const file of req.files) {
      try {
        // Determine file type
        const getFileType = (mimeType) => {
          if (mimeType.startsWith('image/')) return 'image';
          if (mimeType.startsWith('video/')) return 'video';
          if (mimeType.startsWith('audio/')) return 'audio';
          if (mimeType.includes('pdf') || 
              mimeType.includes('word') || 
              mimeType.includes('excel') || 
              mimeType.includes('powerpoint') || 
              mimeType.includes('text')) {
            return 'document';
          }
          return 'other';
        };

        const fileType = getFileType(file.mimetype);

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(
          file.buffer,
          `section-files/${sectionId}`,
          file.originalname
        );

        // Create file record
        const sectionFile = new SectionFile({
          section: sectionId,
          filename: file.originalname,
          originalName: file.originalname,
          fileType: fileType,
          mimeType: file.mimetype,
          fileSize: file.size,
          cloudinaryUrl: uploadResult.secure_url,
          cloudinaryPublicId: uploadResult.public_id,
          uploadedBy: uploadedBy,
          description: req.body.description || '',
          tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
          isPublic: req.body.isPublic !== 'false'
        });

        await sectionFile.save();
        
        // Populate uploadedBy for response
        await sectionFile.populate('uploadedBy', 'fullName email');

        uploadedFiles.push({
          id: sectionFile._id,
          name: sectionFile.originalName,
          filename: sectionFile.filename,
          type: sectionFile.fileType,
          size: sectionFile.formattedSize,
          url: sectionFile.cloudinaryUrl,
          date: sectionFile.createdAt.toISOString().split('T')[0],
          uploadedBy: sectionFile.uploadedBy.fullName,
          description: sectionFile.description,
          tags: sectionFile.tags,
          isPublic: sectionFile.isPublic,
          icon: sectionFile.icon,
          color: sectionFile.color
        });

      } catch (fileError) {
        console.error(`❌ Error uploading file ${file.originalname}:`, fileError);
        errors.push({
          filename: file.originalname,
          error: fileError.message
        });
      }
    }

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Error uploading section files:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading files'
    });
  }
});

/**
 * PUT /api/section-files/:fileId
 * Update file metadata
 */
router.put('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { description, tags, isPublic } = req.body;

    const file = await SectionFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Update fields
    if (description !== undefined) file.description = description;
    if (tags !== undefined) file.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    if (isPublic !== undefined) file.isPublic = isPublic;

    await file.save();
    await file.populate('uploadedBy', 'fullName email');

    res.json({
      success: true,
      message: 'File updated successfully',
      file: {
        id: file._id,
        name: file.originalName,
        filename: file.filename,
        type: file.fileType,
        size: file.formattedSize,
        url: file.cloudinaryUrl,
        date: file.createdAt.toISOString().split('T')[0],
        uploadedBy: file.uploadedBy.fullName,
        description: file.description,
        tags: file.tags,
        isPublic: file.isPublic,
        icon: file.icon,
        color: file.color
      }
    });

  } catch (error) {
    console.error('❌ Error updating file:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating file'
    });
  }
});

/**
 * DELETE /api/section-files/:fileId
 * Delete a file
 */
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await SectionFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete from Cloudinary
    try {
      await deleteFromCloudinary(file.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.error('❌ Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary fails
    }

    // Delete from database
    await SectionFile.findByIdAndDelete(fileId);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file'
    });
  }
});

/**
 * GET /api/section-files/:fileId/download
 * Get file download URL
 */
router.get('/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await SectionFile.findById(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      downloadUrl: file.cloudinaryUrl,
      filename: file.originalName
    });

  } catch (error) {
    console.error('❌ Error getting download URL:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting download URL'
    });
  }
});

export default router;