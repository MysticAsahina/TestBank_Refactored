// utils/cloudinary.js - FIXED VERSION
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload file to Cloudinary with specific folder - FIXED VERSION
export const uploadToCloudinary = async (fileBuffer, folder = 'testbank') => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: folder,
          access_mode: 'public', // ← CRITICAL: This was missing!
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'mp4', 'mp3', 'wav', 'txt', 'zip'],
          max_file_size: 15 * 1024 * 1024 // 15MB
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

// Specific upload functions for different file types
export const uploadQuestionFile = async (fileBuffer, fileName = '') => {
  return uploadToCloudinary(fileBuffer, 'testbank/questions');
};

export const uploadCorrectFeedbackFile = async (fileBuffer, fileName = '') => {
  return uploadToCloudinary(fileBuffer, 'testbank/feedback/correct');
};

export const uploadIncorrectFeedbackFile = async (fileBuffer, fileName = '') => {
  return uploadToCloudinary(fileBuffer, 'testbank/feedback/incorrect');
};

export const uploadLearningMaterialsFile = async (fileBuffer, fileName = '') => {
  return uploadToCloudinary(fileBuffer, 'testbank/learning-materials');
};

// NEW: Section files upload function
export const uploadSectionFile = async (fileBuffer, fileName = '') => {
  return uploadToCloudinary(fileBuffer, 'section-files');
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    throw new Error(`Cloudinary delete failed: ${error.message}`);
  }
};

// Extract public ID from Cloudinary URL
export const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const matches = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
  return matches ? matches[1] : null;
};

// NEW: Update existing files to be public
export const makeFilePublic = async (publicId) => {
  try {
    const result = await cloudinary.uploader.explicit(publicId, {
      type: 'upload',
      access_mode: 'public'
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to make file public: ${error.message}`);
  }
};

export default cloudinary;