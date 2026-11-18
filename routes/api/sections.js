import express from "express";
import Section from "../../models/Section.js";
import Student from "../../models/Student.js";
import Test from "../../models/Test.js";
import StudentTestAttempt from "../../models/StudentTestAttempt.js";

const router = express.Router();

/**
 * GET /api/sections
 * List all sections
 */
router.get("/sections", async (req, res) => {
  try {
    const sections = await Section.find().sort({ createdAt: -1 }).lean();
    res.json(sections);
  } catch (err) {
    console.error("Error listing sections:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/sections/:id
 * Get single section with student test scores
 */
router.get("/sections/:id", async (req, res) => {
  try {
    const section = await Section.findById(req.params.id).lean();
    if (!section) return res.status(404).json({ message: "Section not found" });

    // Get all tests that are assigned to this section OR public tests
    const tests = await Test.find({
      $or: [
        { access: "Public" },
        { assignedSections: section.name }
      ]
    }).select('title _id subjectCode').lean();

    // FIX: Use the actual student IDs stored in the section
    const studentIds = section.students.map(s => s.id).filter(id => id);
    
    // Get all student test attempts for students in this section
    const testAttempts = await StudentTestAttempt.find({
      student: { $in: studentIds }
    })
    .populate('test', 'title _id')
    .populate('student', 'studentID firstName lastName')
    .lean();

    // Create a map of studentId -> { testId -> score }
    const studentScores = {};
    testAttempts.forEach(attempt => {
      if (attempt.student && attempt.test) {
        const studentId = attempt.student._id.toString();
        const testId = attempt.test._id.toString();
        
        if (!studentScores[studentId]) {
          studentScores[studentId] = {};
        }
        studentScores[studentId][testId] = {
          score: attempt.score,
          passed: attempt.passed,
          takenAt: attempt.takenAt
        };
      }
    });

    // Prepare the response with pivot table structure
    const response = {
      ...section,
      tests: tests.map(test => ({
        _id: test._id,
        title: test.title,
        subjectCode: test.subjectCode
      })),
      students: section.students.map(student => {
        const studentTestScores = student.id ? studentScores[student.id] || {} : {};
        
        // Create test scores object for this student
        const testScores = {};
        tests.forEach(test => {
          testScores[test._id] = studentTestScores[test._id] || {
            score: null,
            passed: false,
            takenAt: null
          };
        });

        return {
          ...student,
          testScores: testScores
        };
      })
    };

    res.json(response);
  } catch (err) {
    console.error("Error getting section with scores:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/sections
 * Create a new section
 * Body:
 *  { name, schoolYear, course, campus, subject, yearLevel, students: [...] }
 */
router.post("/sections", async (req, res) => {
  try {
    const { name, schoolYear, course, campus, subject, yearLevel, students } = req.body;

    // Validate required fields
    if (!name || !schoolYear || !course || !subject || !yearLevel) {
      return res.status(400).json({ 
        message: "name, schoolYear, course, subject, and yearLevel are required" 
      });
    }

    // VALIDATION: Check for duplicate section (for new sections)
    const existingSection = await Section.findOne({
      name: name,
      schoolYear: schoolYear,
      course: course,
      campus: campus,
      subject: subject,
      yearLevel: yearLevel
    });

    if (existingSection) {
      console.log('❌ Duplicate section found:', existingSection._id);
      return res.status(400).json({ 
        success: false,
        message: 'A section with the same Subject, School Year, Course, Section, Campus, and Year Level already exists. Please use different values.' 
      });
    }

    const section = new Section({
      name,
      schoolYear,
      course,
      subject,
      yearLevel,
      campus,
      students: Array.isArray(students) ? students : []
    });

    await section.save();
    console.log('✅ Section created successfully:', section._id);
    res.status(201).json(section);

  } catch (err) {
    console.error("❌ Error creating section:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/sections/:id
 * Update an existing section
 */
/**
 * PUT /api/sections/:id
 * Update an existing section
 */
router.put("/sections/:id", async (req, res) => {
  try {
    const sectionId = req.params.id;
    const payload = req.body;
    
    console.log('🔧 Editing section:', sectionId);
    console.log('📝 New data:', { 
      name: payload.name,
      schoolYear: payload.schoolYear,
      course: payload.course,
      campus: payload.campus,
      subject: payload.subject,
      yearLevel: payload.yearLevel
    });

    // Get the current section data for comparison
    const currentSection = await Section.findById(sectionId);
    if (!currentSection) {
      return res.status(404).json({ message: "Section not found" });
    }

    console.log('📋 Current section data:', {
      name: currentSection.name,
      schoolYear: currentSection.schoolYear,
      course: currentSection.course,
      campus: currentSection.campus,
      subject: currentSection.subject,
      yearLevel: currentSection.yearLevel
    });

    // Check if ANY fields have actually changed
    const hasChanges = 
      currentSection.name !== payload.name ||
      currentSection.schoolYear !== payload.schoolYear ||
      currentSection.course !== payload.course ||
      currentSection.campus !== payload.campus ||
      currentSection.subject !== payload.subject ||
      currentSection.yearLevel !== payload.yearLevel;

    console.log('🔄 Has changes:', hasChanges);

    // Only check for duplicates if fields have actually changed
    if (hasChanges) {
      console.log('🔍 Checking for duplicates...');
      
      const existingSection = await Section.findOne({
        name: payload.name,
        schoolYear: payload.schoolYear,
        course: payload.course,
        campus: payload.campus,
        subject: payload.subject,
        yearLevel: payload.yearLevel,
        _id: { $ne: sectionId }
      });

      if (existingSection) {
        console.log('❌ Duplicate section found:', existingSection._id);
        console.log('📊 Duplicate section data:', {
          name: existingSection.name,
          schoolYear: existingSection.schoolYear,
          course: existingSection.course,
          campus: existingSection.campus,
          subject: existingSection.subject,
          yearLevel: existingSection.yearLevel
        });
        
        return res.status(400).json({ 
          success: false,
          message: 'A section with the same Subject, School Year, Course, Section, Campus, and Year Level already exists. Please use different values.' 
        });
      }
    } else {
      console.log('✅ No changes to unique fields, skipping duplicate check');
    }

    const update = {
      name: payload.name,
      schoolYear: payload.schoolYear,
      course: payload.course,
      campus: payload.campus,
      subject: payload.subject,
      yearLevel: payload.yearLevel,
      students: Array.isArray(payload.students) ? payload.students : [],
      updatedAt: new Date()
    };

    const updated = await Section.findByIdAndUpdate(sectionId, update, { new: true });
    
    console.log('✅ Section updated successfully:', updated._id);
    res.json(updated);
    
  } catch (err) {
    console.error("Error updating section:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * DELETE /api/sections/:id
 */
router.delete("/sections/:id", async (req, res) => {
  try {
    const removed = await Section.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: "Section not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Error deleting section:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/students
 * Simple endpoint returning available students (for the modal).
 * You can seed students collection or adapt to your existing Student model/sources.
 * Supports optional ?q=search query to filter by name or studentId.
 */
router.get("/students", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const filter = q ? {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { studentId: { $regex: q, $options: "i" } }
      ]
    } : {};
    const students = await Student.find(filter).limit(200).lean();
    res.json(students);
  } catch (err) {
    console.error("Error listing students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;