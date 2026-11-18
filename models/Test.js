import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  text: { type: String, default: "" },
  file: { type: String, default: "" } // Cloudinary URL for feedback files
}, { _id: false });

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ["multiple", "truefalse", "enumeration", "identification", "essay"], required: true },
  points: { type: Number, default: 0 },
  choices: [String],
  correctAnswer: { type: mongoose.Schema.Types.Mixed, default: undefined },
  answer: String,
  answers: [String],
  files: [String], // Cloudinary URLs for question files
  feedbackWhenCorrect: feedbackSchema,
  feedbackWhenIncorrect: feedbackSchema
});

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subjectCode: { type: String, required: true },
  description: { type: String, default: "" },
  timeLimit: Number,
  deadline: Date,
  access: { type: String, enum: ["Private", "Public"], default: "Private" },
  status: { type: String, enum: ["active", "archived"], default: "active" }, // NEW: Archive status
  howManyQuestions: { type: Number, required: true },
  passingPoints: { type: Number, default: 0 },
  // NEW: Period field added here
  period: { 
    type: String, 
    enum: [
      "1st Sem : P1", 
      "1st Sem : P2", 
      "1st Sem : P3", 
      "2nd Sem : P1", 
      "2nd Sem : P2", 
      "2nd Sem : P3", 
      "Summer"
    ], 
    required: true 
  },
  assignedSections: [String],
  prerequisites: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  questions: [questionSchema],
  // NEW: Cloudinary fields for test-level images
  coverImage: { type: String, default: "" }, // Cloudinary URL for test cover image
  additionalFiles: [String] // Cloudinary URLs for additional test files
});

// Virtual: total questions, total points across all questions
testSchema.virtual("totalQuestions").get(function() {
  return (this.questions && this.questions.length) || 0;
});

testSchema.virtual("totalPoints").get(function() {
  return (this.questions || []).reduce((s, q) => s + (q.points || 0), 0);
});

// Export model
export default mongoose.model("Test", testSchema);