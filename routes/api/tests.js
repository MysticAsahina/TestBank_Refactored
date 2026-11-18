// ✅ routes/api/tests.js

import express from "express";
import mongoose from "mongoose";
import Test from "../../models/Test.js";
import StudentTestAttempt from "../../models/StudentTestAttempt.js";
import { requireAuth } from "../../middleware/auth.js";
import { checkRole } from "../../middleware/checkRole.js";

const router = express.Router();

// Helper: compute maximum possible points for `howMany` questions
function maxPointsForHowMany(questions = [], howMany = 0) {
  const points = (questions || []).map(q => Number(q.points || 0)).sort((a,b) => b - a);
  return points.slice(0, howMany).reduce((s, p) => s + p, 0);
}

function normalizeQuestions(questions = []) {
  return questions.map(q => {
    const question = {
      text: q.text || "",
      type: q.type || "identification",
      points: Number(q.points || 0),
      choices: [],
      answers: [],
      files: q.files || [], // Keep Cloudinary URLs
      correctAnswer: undefined,
      feedbackWhenCorrect: q.feedbackWhenCorrect || {},
      feedbackWhenIncorrect: q.feedbackWhenIncorrect || {}
    };

    // Multiple choice
    if (question.type === "multiple") {
      question.choices = Array.isArray(q.choices) ? [...q.choices] : (q.choices ? [q.choices] : []);
      if (Array.isArray(q.correctAnswer)) {
        question.correctAnswer = [...q.correctAnswer];
      } else if (q.correctAnswer === undefined || q.correctAnswer === null || q.correctAnswer === "") {
        question.correctAnswer = [];
      } else {
        question.correctAnswer = [String(q.correctAnswer)];
      }
      question.answers = Array.isArray(q.answers) ? [...q.answers] : [];
    }

    // True/False, Identification, Enumeration, Essay
    else if (["truefalse", "identification", "enumeration", "essay"].includes(question.type)) {
      question.correctAnswer = Array.isArray(q.correctAnswer)
        ? (q.correctAnswer.length ? String(q.correctAnswer[0]) : "")
        : (q.correctAnswer ? String(q.correctAnswer) : "");
      question.answers = Array.isArray(q.answers) ? [...q.answers] : [];
    }

    return question;
  });
}

// ✅ Protect all test modification routes (Dean + Professor)
router.use(requireAuth);
router.use(checkRole(["Dean", "Professor"]));

// Create a test
router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.title || !payload.subjectCode || !payload.period) {
      return res.status(400).json({ message: "title, subjectCode, and period are required" });
    }

    const questions = Array.isArray(payload.questions) ? normalizeQuestions(payload.questions) : [];
    const totalQuestions = questions.length;
    const howManyQuestions = Number(payload.howManyQuestions || 0);

    if (howManyQuestions <= 0) return res.status(400).json({ message: "howManyQuestions must be greater than 0" });
    if (howManyQuestions > totalQuestions) return res.status(400).json({ message: "howManyQuestions cannot be more than total questions" });

    const maxPoints = maxPointsForHowMany(questions, howManyQuestions);
    const passingPoints = Number(payload.passingPoints || 0);
    if (passingPoints > maxPoints) return res.status(400).json({ message: `passingPoints cannot exceed maximum possible points (${maxPoints})` });

    const testDoc = new Test({
      title: payload.title,
      subjectCode: payload.subjectCode,
      description: payload.description || "",
      timeLimit: payload.timeLimit,
      deadline: payload.deadline ? new Date(payload.deadline) : undefined,
      access: payload.access || "Private",
      period: payload.period,
      howManyQuestions,
      passingPoints,
      assignedSections: Array.isArray(payload.assignedSections) ? payload.assignedSections : [],
      prerequisites: Array.isArray(payload.prerequisites) ? payload.prerequisites : [],
      questions,
      createdBy: req.session?.user?.id,
      coverImage: payload.coverImage || "",
      additionalFiles: payload.additionalFiles || []
    });

    await testDoc.save();
    res.status(201).json(testDoc);
  } catch (err) {
    console.error("❌ Error creating test:", err);
    res.status(500).json({ message: "Server error", error: err?.message || String(err) });
  }
});

// List tests
router.get("/", async (req, res) => {
  try {
    const { status, archived } = req.query;
    let filter = {};

    if (status === "archived" || archived === "true") {
      filter.status = "archived";
    } else {
      filter.status = "active";
    }

    const tests = await Test.find(filter)
      .populate("createdBy", "firstName middleName lastName email role")
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    const withTotals = tests.map(t => ({
      ...t,
      totalQuestions: (t.questions || []).length,
      totalPoints: (t.questions || []).reduce((s, q) => s + (q.points || 0), 0),
    }));

    res.json(withTotals);
  } catch (err) {
    console.error("❌ Error listing tests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single test
router.get("/:id", async (req, res) => {
  try {
    const t = await Test.findById(req.params.id)
      .populate("createdBy", "fullName email role")
      .lean({ virtuals: true });

    if (!t) return res.status(404).json({ message: "Test not found" });
    res.json(t);
  } catch (err) {
    console.error("❌ Error getting test:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update test
router.put("/:id", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.period) {
      return res.status(400).json({ message: "period is required" });
    }

    const questions = Array.isArray(payload.questions) ? normalizeQuestions(payload.questions) : [];
    const totalQuestions = questions.length;
    const howManyQuestions = Number(payload.howManyQuestions || 0);

    if (howManyQuestions <= 0) {
      return res.status(400).json({ message: "howManyQuestions must be greater than 0" });
    }
    if (howManyQuestions > totalQuestions) {
      return res.status(400).json({ message: "howManyQuestions cannot be more than total questions" });
    }

    const maxPoints = maxPointsForHowMany(questions, howManyQuestions);
    const passingPoints = Number(payload.passingPoints || 0);
    if (passingPoints > maxPoints) {
      return res.status(400).json({ message: `passingPoints cannot exceed maximum possible points (${maxPoints})` });
    }

    const updated = await Test.findByIdAndUpdate(req.params.id, {
      title: payload.title,
      subjectCode: payload.subjectCode,
      description: payload.description || "",
      timeLimit: payload.timeLimit,
      deadline: payload.deadline ? new Date(payload.deadline) : undefined,
      access: payload.access || "Private",
      period: payload.period,
      howManyQuestions: howManyQuestions,
      passingPoints: passingPoints,
      assignedSections: Array.isArray(payload.assignedSections) ? payload.assignedSections : [],
      prerequisites: Array.isArray(payload.prerequisites) ? payload.prerequisites : [],
      questions,
      coverImage: payload.coverImage || "",
      additionalFiles: payload.additionalFiles || [],
      updatedAt: new Date()
    }, { new: true });

    if (!updated) return res.status(404).json({ message: "Test not found" });
    res.json(updated);
  } catch (err) {
    console.error("❌ Error updating test:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete test
router.delete("/:id", async (req, res) => {
  try {
    const removed = await Test.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: "Test not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Error deleting test:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Archive test
router.patch("/:id/archive", async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { status: "archived", updatedAt: new Date() },
      { new: true }
    );

    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json({ message: "Test archived successfully", test });
  } catch (err) {
    console.error("❌ Error archiving test:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Unarchive test
router.patch("/:id/unarchive", async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { status: "active", updatedAt: new Date() },
      { new: true }
    );

    if (!test) return res.status(404).json({ message: "Test not found" });
    res.json({ message: "Test unarchived successfully", test });
  } catch (err) {
    console.error("❌ Error unarchiving test:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// List archived tests
router.get("/archived/list", async (req, res) => {
  try {
    const tests = await Test.find({ status: "archived" })
      .populate("createdBy", "firstName middleName lastName email role")
      .sort({ updatedAt: -1 })
      .lean({ virtuals: true });

    const withTotals = tests.map(t => ({
      ...t,
      totalQuestions: (t.questions || []).length,
      totalPoints: (t.questions || []).reduce((s, q) => s + (q.points || 0), 0),
    }));

    res.json(withTotals);
  } catch (err) {
    console.error("❌ Error listing archived tests:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;