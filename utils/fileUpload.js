import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import {
  uploadQuestionFile,
  uploadCorrectFeedbackFile,
  uploadIncorrectFeedbackFile,
  uploadLearningMaterialsFile
} from '../utils/cloudinary.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Generate signature for client-side uploads (if needed)
router.post('/cloudinary-signature', (req, res) => {
  try {
    const { folder, uploadType } = req.body;
    
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp: timestamp,
      folder: folder || 'testbank'
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder: folder || 'testbank'
    });
  } catch (error) {
    console.error('Error generating Cloudinary signature:', error);
    res.status(500).json({ error: 'Failed to generate upload signature' });
  }
});

// Server-side upload endpoints (Recommended - More Secure)
router.post('/upload/question', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadQuestionFile(req.file.buffer, req.file.originalname);
    
    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      fileName: req.file.originalname,
      fileType: 'question'
    });
  } catch (error) {
    console.error('Question upload error:', error);
    res.status(500).json({ error: 'Question upload failed: ' + error.message });
  }
});

router.post('/upload/correct-feedback', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadCorrectFeedbackFile(req.file.buffer, req.file.originalname);
    
    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      fileName: req.file.originalname,
      fileType: 'correctFeedback'
    });
  } catch (error) {
    console.error('Correct feedback upload error:', error);
    res.status(500).json({ error: 'Correct feedback upload failed: ' + error.message });
  }
});

router.post('/upload/incorrect-feedback', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadIncorrectFeedbackFile(req.file.buffer, req.file.originalname);
    
    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      fileName: req.file.originalname,
      fileType: 'incorrectFeedback'
    });
  } catch (error) {
    console.error('Incorrect feedback upload error:', error);
    res.status(500).json({ error: 'Incorrect feedback upload failed: ' + error.message });
  }
});

router.post('/upload/learning-materials', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadLearningMaterialsFile(req.file.buffer, req.file.originalname);
    
    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      fileName: req.file.originalname,
      fileType: 'learningMaterials'
    });
  } catch (error) {
    console.error('Learning materials upload error:', error);
    res.status(500).json({ error: 'Learning materials upload failed: ' + error.message });
  }
});

// Bulk upload endpoint
router.post('/upload/bulk', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadType = req.body.uploadType || 'question';
    const results = [];

    for (const file of req.files) {
      let result;
      switch (uploadType) {
        case 'correctFeedback':
          result = await uploadCorrectFeedbackFile(file.buffer, file.originalname);
          break;
        case 'incorrectFeedback':
          result = await uploadIncorrectFeedbackFile(file.buffer, file.originalname);
          break;
        case 'learningMaterials':
          result = await uploadLearningMaterialsFile(file.buffer, file.originalname);
          break;
        case 'question':
        default:
          result = await uploadQuestionFile(file.buffer, file.originalname);
      }

      results.push({
        url: result.secure_url,
        publicId: result.public_id,
        fileName: file.originalname,
        fileType: uploadType
      });
    }

    res.json({ success: true, files: results });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Bulk upload failed: ' + error.message });
  }
});

export default router;