import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { checkRole } from "../../middleware/checkRole.js"; // ✅ new
import Section from "../../models/Section.js";
import Student from "../../models/Student.js";
import Test from "../../models/Test.js";
import StudentTestAttempt from "../../models/StudentTestAttempt.js";

const router = express.Router();

// GET /dean/sections - Display sections page
router.get("/", checkRole(["Dean", "Professor"]), async (req, res) => {
  try {
    const user = req.session.user;

    // Fetch real sections for the initial page load
    const sections = await Section.find()
      .sort({ createdAt: -1 })
      .select('name schoolYear course yearLevel campus subject students')
      .lean();

    const transformedSections = sections.map(section => ({
      _id: section._id,
      sectionName: section.name,
      schoolYear: section.schoolYear,
      course: section.course,
      yearLevel: section.yearLevel,
      campus: section.campus,
      subject: section.subject,
      studentCount: section.students.length
    }));

    res.render("dean/Sections", {
      title: "Sections Management",
      user,
      sections: transformedSections
    });
  } catch (error) {
    console.error("Error loading sections page:", error);
    res.status(500).render("Error", {
      message: "Error loading sections page",
      error: {}
    });
  }
});

// GET /dean/sections/details/:id - Section Details with Test Scores
router.get("/details/:id", requireAuth, checkRole(["Dean", "Professor"]), async (req, res) => {
  try {
    const sectionId = req.params.id;
    
    // Get section with populated data
    const section = await Section.findById(sectionId).lean();
    if (!section) {
      return res.status(404).render("Error", {
        message: "Section not found",
        error: {}
      });
    }

    // Get all tests that are assigned to this section OR public tests
    const tests = await Test.find({
      $or: [
        { access: "Public" },
        { assignedSections: section.name }
      ]
    })
    .select('title _id subjectCode questions passingPoints')
    .lean();

    // Calculate total points for each test manually
    const testsWithPoints = tests.map(test => {
      const totalPoints = test.questions ? 
        test.questions.reduce((sum, question) => sum + (question.points || 0), 0) : 0;
      
      return {
        ...test,
        totalPoints: totalPoints
      };
    });

    // FIX: Get actual Student records using the student IDs stored in the section
    const sectionStudentIds = section.students.map(s => s.id).filter(id => id);
    const actualStudents = await Student.find({ 
      _id: { $in: sectionStudentIds } 
    }).select('_id studentID email firstName lastName').lean();

    // Create mapping: student _id -> student data
    const studentMap = {};
    actualStudents.forEach(student => {
      studentMap[student._id.toString()] = student;
    });

    // Get student test attempts using ACTUAL student IDs
    const actualStudentIds = actualStudents.map(s => s._id);
    let studentScores = {};
    
    if (actualStudentIds.length > 0) {
      const testAttempts = await StudentTestAttempt.find({
        student: { $in: actualStudentIds }
      })
      .populate('test', 'title _id')
      .populate('student', 'studentID firstName lastName email')
      .lean();

      // Create a map of studentId -> { testId -> score }
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
            takenAt: attempt.takenAt,
            studentInfo: attempt.student
          };
        }
      });
    }

    // Prepare the students data with test scores
    const studentsWithScores = section.students.map(sectionStudent => {
      // Find the actual student data using the stored ID
      const actualStudent = sectionStudent.id ? studentMap[sectionStudent.id] : null;
      const studentTestScores = actualStudent ? studentScores[actualStudent._id.toString()] || {} : {};
      
      // Create test scores object for this student
      const testScores = {};
      testsWithPoints.forEach(test => {
        testScores[test._id] = studentTestScores[test._id] || {
          score: null,
          passed: false,
          takenAt: null
        };
      });

      return {
        ...sectionStudent,
        actualStudent: actualStudent,
        testScores: testScores
      };
    });

    console.log('🔍 Section Details Debug:');
    console.log('   Section:', section.name);
    console.log('   Section Students:', section.students.length);
    console.log('   Actual Students Found:', actualStudents.length);
    console.log('   Tests Found:', testsWithPoints.length);
    console.log('   Student Scores Found:', Object.keys(studentScores).length);

    res.render("dean/SectionDetails", {
      title: `Section Details - ${section.name}`,
      user: req.session.user,
      section: {
        ...section,
        students: studentsWithScores
      },
      tests: testsWithPoints // Use the tests with calculated points
    });

  } catch (error) {
    console.error('Error loading section details:', error);
    res.status(500).render('Error', { 
      title: 'Error - Test Bank System',
      message: 'Error loading section details',
      error: {}
    });
  }
});

// POST /dean/sections/create - Create new section (Dean only)
router.post("/create", requireAuth, checkRole(["Dean"]), async (req, res) => {
  try {
    console.log("Section creation data:", req.body);
    res.json({
      success: true,
      message: "Section created successfully (static implementation)"
    });
  } catch (error) {
    console.error("Error creating section:", error);
    res.status(500).json({
      success: false,
      message: "Error creating section"
    });
  }
});

// GET /dean/sections/list - Get all sections (Dean+Professor) - DYNAMIC VERSION
router.get("/list",  requireAuth, checkRole(["Dean", "Professor"]), async (req, res) => {
  try {
    // Fetch real sections from database
    const sections = await Section.find()
      .sort({ createdAt: -1 })
      .select('name schoolYear course yearLevel campus subject students createdAt')
      .lean();

    // Transform the data to match your frontend expectations
    const transformedSections = sections.map(section => ({
      _id: section._id,
      sectionName: section.name,
      schoolYear: section.schoolYear,
      course: section.course,
      yearLevel: section.yearLevel,
      campus: section.campus,
      subject: section.subject,
      students: section.students.map(student => ({
        studentId: student.studentId || 'N/A',
        name: student.name,
        id: student.id
      })),
      studentCount: section.students.length,
      createdAt: section.createdAt
    }));

    console.log(`📊 Fetched ${transformedSections.length} sections from database`);

    res.json({ 
      success: true, 
      sections: transformedSections 
    });

  } catch (error) {
    console.error("Error fetching sections:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching sections from database"
    });
  }
});

export default router;