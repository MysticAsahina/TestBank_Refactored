import mongoose from "mongoose";
import dotenv from "dotenv";
import Test from "../models/Test.js";
import Student from "../models/Student.js";
import Section from "../models/Section.js";
import StudentTestAttempt from "../models/StudentTestAttempt.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/testbank");
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
};

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomScore = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const subjects = [
  { code: "CS101", name: "Computer Science Fundamentals" },
  { code: "MATH102", name: "Discrete Mathematics" },
  { code: "ENG103", name: "Technical Writing" },
  { code: "HIST104", name: "Philippine History" },
  { code: "PHYS105", name: "Physics 1" },
  { code: "CHEM106", name: "Chemistry for Engineers" }
];

const periods = [
  "1st Sem : P1", "1st Sem : P2", "1st Sem : P3",
  "2nd Sem : P1", "2nd Sem : P2", "2nd Sem : P3", "Summer"
];

const sectionNames = ["BSIT3-A", "BSCE2-B", "BSEE4-C", "BSME1-A"];

const generateFeedback = (isCorrect) => ({
  text: isCorrect ? "Good job! You got it right." : "Review this topic again.",
  file: ""
});

const seedData = async () => {
  try {
    await connectDB();

    await Section.deleteMany({});
    await Student.deleteMany({});
    await Test.deleteMany({});
    await StudentTestAttempt.deleteMany({});

    console.log("🧹 Cleared old dummy data");

    // ✅ Create valid Sections according to your schema
    const sections = await Section.insertMany(
      sectionNames.map((name) => ({
        name,
        schoolYear: "2024-2025",
        course: name.startsWith("BSIT") ? "BSIT" :
                name.startsWith("BSCE") ? "BSCE" :
                name.startsWith("BSEE") ? "BSEE" : "BSME",
        yearLevel: name.match(/\d/)?.[0] || "1",
        campus: "Main",
        subject: randomFrom(subjects).name,
        students: []
      }))
    );
    console.log(`📘 Created ${sections.length} sections`);

    // ✅ Create Students
    const studentDocs = [];
    let counter = 1;

    for (const sec of sections) {
      for (let i = 0; i < 8; i++) {
        const student = new Student({
          lastName: `Lastname${counter}`,
          firstName: `Firstname${counter}`,
          middleName: "M",
          studentID: `STU${1000 + counter}`,
          email: `student${counter}@school.edu`,
          password: "hashedpassword",
          course: sec.course,
          section: sec.name,
          yearLevel: sec.yearLevel,
          campus: sec.campus
        });
        studentDocs.push(student);
        counter++;
      }
    }

    await Student.insertMany(studentDocs);
    console.log(`👩‍🎓 Created ${studentDocs.length} students`);

    // ✅ Create Tests
    const testDocs = [];
    for (const subj of subjects) {
      const test = new Test({
        title: `Midterm Test in ${subj.name}`,
        subjectCode: subj.code,
        description: `Covers topics related to ${subj.name}`,
        timeLimit: 45,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        access: "Public",
        status: "active",
        howManyQuestions: 5,
        passingPoints: 50,
        period: randomFrom(periods),
        assignedSections: sectionNames,
        createdBy: null,
        questions: Array.from({ length: 5 }).map((_, i) => ({
          text: `Question ${i + 1} for ${subj.name}`,
          type: randomFrom(["multiple", "truefalse", "identification"]),
          points: 20,
          choices: ["A", "B", "C", "D"],
          correctAnswer: randomFrom(["A", "B", "C", "D"]),
          feedbackWhenCorrect: generateFeedback(true),
          feedbackWhenIncorrect: generateFeedback(false)
        }))
      });
      testDocs.push(test);
    }

    await Test.insertMany(testDocs);
    console.log(`🧪 Created ${testDocs.length} tests`);

    // ✅ Create Student Test Attempts
    const attempts = [];

    for (const student of studentDocs) {
      const studentSection = sections.find((s) => s.name === student.section);
      const assignedTests = testDocs.filter((t) =>
        t.assignedSections.includes(studentSection.name)
      );

      for (const test of assignedTests) {
        const totalPoints = test.questions.reduce((sum, q) => sum + q.points, 0);
        const score = randomScore(30, 100);
        const passed = score >= test.passingPoints;

        const questionResults = test.questions.map((q) => {
          const isCorrect = Math.random() > 0.4;
          return {
            questionId: new mongoose.Types.ObjectId(),
            questionText: q.text,
            questionType: q.type,
            studentAnswer: isCorrect
              ? q.correctAnswer
              : randomFrom(q.choices.filter((c) => c !== q.correctAnswer)),
            correctAnswer: q.correctAnswer,
            isCorrect,
            pointsEarned: isCorrect ? q.points : 0,
            maxPoints: q.points,
            feedback: generateFeedback(isCorrect)
          };
        });

        attempts.push({
          student: student._id,
          test: test._id,
          score,
          passed,
          questionResults,
          takenAt: new Date(Date.now() - randomScore(0, 30) * 86400000),
          isRetake: Math.random() < 0.2
        });
      }
    }

    await StudentTestAttempt.insertMany(attempts);
    console.log(`📊 Inserted ${attempts.length} StudentTestAttempt records`);

    console.log("✅ Seeding completed successfully!");
    process.exit();
  } catch (err) {
    console.error("❌ Error seeding data:", err);
    process.exit(1);
  }
};

seedData();