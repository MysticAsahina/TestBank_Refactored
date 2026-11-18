import mongoose from 'mongoose';

const sectionFileSchema = new mongoose.Schema({
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['document', 'image', 'video', 'audio', 'other']
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number, // in bytes
    required: true
  },
  cloudinaryUrl: {
    type: String,
    required: true
  },
  cloudinaryPublicId: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin', // CHANGED FROM 'User' TO 'Admin'
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  tags: [{
    type: String
  }],
  isPublic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual for formatted file size
sectionFileSchema.virtual('formattedSize').get(function() {
  if (this.fileSize < 1024) {
    return this.fileSize + ' bytes';
  } else if (this.fileSize < 1024 * 1024) {
    return (this.fileSize / 1024).toFixed(2) + ' KB';
  } else {
    return (this.fileSize / (1024 * 1024)).toFixed(2) + ' MB';
  }
});

// Virtual for file icon
sectionFileSchema.virtual('icon').get(function() {
  const iconMap = {
    'document': 'fas fa-file-alt',
    'image': 'fas fa-file-image',
    'video': 'fas fa-file-video',
    'audio': 'fas fa-file-audio',
    'other': 'fas fa-file'
  };
  return iconMap[this.fileType] || iconMap.other;
});

// Virtual for file color
sectionFileSchema.virtual('color').get(function() {
  const colorMap = {
    'document': '#3498db',
    'image': '#9b59b6',
    'video': '#e67e22',
    'audio': '#1abc9c',
    'other': '#95a5a6'
  };
  return colorMap[this.fileType] || colorMap.other;
});

export default mongoose.model('SectionFile', sectionFileSchema);