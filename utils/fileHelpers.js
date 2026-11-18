// utils/fileHelpers.js
import { deleteFromCloudinary, getPublicIdFromUrl } from './cloudinary.js';

/**
 * Delete old files from Cloudinary when updating
 */
export const cleanupOldFiles = async (oldUrls) => {
  if (!oldUrls || oldUrls.length === 0) return;
  
  try {
    for (const url of oldUrls) {
      if (url) {
        const publicId = getPublicIdFromUrl(url);
        if (publicId) {
          await deleteFromCloudinary(publicId);
          console.log(`✅ Deleted old file: ${publicId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up old files:', error);
    // Don't throw error - cleanup failure shouldn't break the main operation
  }
};

/**
 * Extract file URLs from various field types
 */
export const extractFileUrls = (data) => {
  const urls = [];
  
  if (data.questionImage) urls.push(data.questionImage);
  if (data.correctFeedbackImage) urls.push(data.correctFeedbackImage);
  if (data.incorrectFeedbackImage) urls.push(data.incorrectFeedbackImage);
  if (data.learningMaterials) {
    if (Array.isArray(data.learningMaterials)) {
      urls.push(...data.learningMaterials);
    } else if (typeof data.learningMaterials === 'string') {
      urls.push(data.learningMaterials);
    }
  }
  
  return urls.filter(url => url && url.startsWith('http'));
};