import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';
import Student from '../models/Student.js';
import Section from '../models/Section.js';
import Test from '../models/Test.js';
import StudentTestAttempt from '../models/StudentTestAttempt.js';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI;

// Helper function to generate random data
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomScore = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const courses = ['BSIT', 'BSCS', 'BSCE', 'BSEE', 'BSME'];
const yearLevels = ['1', '2', '3', '4'];
const campuses = ['Main', 'South', 'North'];
const departments = ['Computer Science', 'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Mathematics'];
const subjects = ['Data Structures', 'Algorithms', 'Database Management', 'Web Development', 'Calculus', 'Physics', 'Engineering Mechanics', 'Circuit Analysis'];

const seedData = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (but preserve your admin account)
    console.log('🗑️ Clearing existing data (preserving your admin account)...');
    
    // First, find and preserve your admin account
    const existingAdmin = await Admin.findOne({ email: "jama.presentacion.au@phinmaed.com" });
    
    // Clear other data
    await Student.deleteMany({});
    await Section.deleteMany({});
    await Test.deleteMany({});
    await StudentTestAttempt.deleteMany({});
    
    // Only clear other admin accounts, not yours
    await Admin.deleteMany({ email: { $ne: "jama.presentacion.au@phinmaed.com" } });
    
    console.log('✅ Existing data cleared (your admin account preserved)');

    // Create or preserve your Dean account
    console.log('👨‍🏫 Setting up your admin account...');
    let yourAdminAccount;
    
    if (existingAdmin) {
      yourAdminAccount = existingAdmin;
      console.log('✅ Your existing admin account preserved');
    } else {
      // Create your admin account if it doesn't exist
      yourAdminAccount = new Admin({
        lastName: "Test Last",
        firstName: "Test First", 
        middleName: "Test Middle",
        contactNumber: "09816815639",
        email: "jama.presentacion.au@phinmaed.com",
        employeeID: "DTest",
        department: "CIT",
        designation: "Dean",
        employmentStatus: "Full-time",
        password: "$2a$12$rypunVcKVCq.aomFTeBGFOD3E9sX62.SoSnLAYxY1Xt/AUg3tORqq",
        role: "Dean",
        accountStatus: "Active",
        createdBy: "Test, Dean A"
      });
      await yourAdminAccount.save();
      console.log('✅ Your admin account created');
    }

    // Create additional Professors (excluding your account)
    console.log('👨‍🏫 Creating additional Professors...');
    const professors = [
      {
        lastName: 'Santos',
        firstName: 'Maria',
        middleName: 'Cruz',
        contactNumber: '09171234568',
        email: 'prof.santos@university.edu',
        employeeID: 'PROF001',
        department: 'Computer Science',
        designation: 'Professor',
        employmentStatus: 'Full-time',
        password: 'hashed_password_123',
        role: 'Professor',
        accountStatus: 'Active',
        createdBy: 'system'
      },
      {
        lastName: 'Cruz',
        firstName: 'Juan',
        middleName: 'Dela',
        contactNumber: '09171234569',
        email: 'prof.cruz@university.edu',
        employeeID: 'PROF002',
        department: 'Civil Engineering',
        designation: 'Professor',
        employmentStatus: 'Full-time',
        password: 'hashed_password_123',
        role: 'Professor',
        accountStatus: 'Active',
        createdBy: 'system'
      },
      {
        lastName: 'Lim',
        firstName: 'Anna',
        middleName: 'Tan',
        contactNumber: '09171234570',
        email: 'prof.lim@university.edu',
        employeeID: 'PROF003',
        department: 'Electrical Engineering',
        designation: 'Professor',
        employmentStatus: 'Full-time',
        password: 'hashed_password_123',
        role: 'Professor',
        accountStatus: 'Active',
        createdBy: 'system'
      }
    ];

    const createdProfessors = await Admin.insertMany(professors);
    console.log(`✅ Created ${createdProfessors.length} additional professors`);

    // Create Students
    console.log('🎓 Creating Students...');
    const students = [];
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa', 'Robert', 'Maria', 'James', 'Anna', 'Carlos', 'Elena', 'Daniel', 'Michelle'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson'];

    // Add specific test student accounts
    students.push({
      lastName: 'Doe',
      firstName: 'John',
      middleName: 'Test',
      studentID: '2023-TEST01',
      email: 'test.student@university.edu',
      password: '$2a$12$rypunVcKVCq.aomFTeBGFOD3E9sX62.SoSnLAYxY1Xt/AUg3tORqq', // Same hash as your admin password
      course: 'BSIT',
      section: 'BSIT2-A',
      yearLevel: '2',
      campus: 'Main'
    });

    students.push({
      lastName: 'Smith',
      firstName: 'Sarah',
      middleName: 'Average',
      studentID: '2023-TEST02',
      email: 'average.student@university.edu',
      password: '$2a$12$rypunVcKVCq.aomFTeBGFOD3E9sX62.SoSnLAYxY1Xt/AUg3tORqq',
      course: 'BSCS',
      section: 'BSCS3-B',
      yearLevel: '3',
      campus: 'Main'
    });

    students.push({
      lastName: 'Johnson',
      firstName: 'Mike',
      middleName: 'Struggling',
      studentID: '2023-TEST03',
      email: 'struggling.student@university.edu',
      password: '$2a$12$rypunVcKVCq.aomFTeBGFOD3E9sX62.SoSnLAYxY1Xt/AUg3tORqq',
      course: 'BSCE',
      section: 'BSCE1-A',
      yearLevel: '1',
      campus: 'Main'
    });

    // Create remaining students
    for (let i = 1; i <= 97; i++) { // Reduced from 100 to 97 since we added 3 above
      const course = getRandomElement(courses);
      const yearLevel = getRandomElement(yearLevels);
      const campus = getRandomElement(campuses);
      
      students.push({
        lastName: getRandomElement(lastNames),
        firstName: getRandomElement(firstNames),
        middleName: getRandomElement(firstNames),
        studentID: `2023-${String(i).padStart(4, '0')}`,
        email: `student${i}@university.edu`,
        password: 'hashed_password_123',
        course: course,
        section: `${course}${yearLevel}-${getRandomElement(['A', 'B', 'C'])}`,
        yearLevel: yearLevel,
        campus: campus
      });
    }

    const createdStudents = await Student.insertMany(students);
    console.log(`✅ Created ${createdStudents.length} students`);

    // Create Sections
    console.log('📚 Creating Sections...');
    const sectionData = [];
    
    courses.forEach(course => {
      yearLevels.forEach(yearLevel => {
        ['A', 'B', 'C'].forEach(sectionLetter => {
          const sectionName = `${course}${yearLevel}-${sectionLetter}`;
          const sectionStudents = createdStudents
            .filter(student => student.section === sectionName)
            .map(student => ({
              id: student._id.toString(),
              name: student.fullName,
              studentId: student.studentID,
              course: student.course,
              yearLevel: student.yearLevel,
              campus: student.campus
            }));

          sectionData.push({
            name: sectionName,
            schoolYear: '2024-2025',
            course: course,
            yearLevel: yearLevel,
            campus: 'Main',
            subject: getRandomElement(subjects),
            students: sectionStudents
          });
        });
      });
    });

    const createdSections = await Section.insertMany(sectionData);
    console.log(`✅ Created ${createdSections.length} sections`);

    // Create Tests
    console.log('📝 Creating Tests...');
    const tests = [];

    // Data Structures Test
    const dataStructuresTest = new Test({
      title: 'Data Structures and Algorithms Midterm',
      subjectCode: 'CS201',
      description: 'Midterm examination covering arrays, linked lists, stacks, and queues',
      timeLimit: 120,
      deadline: new Date('2024-12-31'),
      access: 'Private',
      status: 'active',
      howManyQuestions: 5,
      passingPoints: 60,
      assignedSections: ['BSIT2-A', 'BSIT2-B', 'BSCS2-A'],
      prerequisites: [],
      createdBy: createdProfessors[0]._id,
      questions: [
        {
          text: 'What is the time complexity of accessing an element in an array by index?',
          type: 'multiple',
          points: 20,
          choices: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'],
          correctAnswer: ['O(1)'],
          answers: []
        },
        {
          text: 'Which data structure follows the LIFO principle?',
          type: 'multiple',
          points: 20,
          choices: ['Queue', 'Stack', 'Array', 'Linked List'],
          correctAnswer: ['Stack'],
          answers: []
        },
        {
          text: 'A binary search tree has O(log n) time complexity for search operations.',
          type: 'truefalse',
          points: 20,
          choices: [],
          correctAnswer: 'True',
          answers: []
        },
        {
          text: 'List three common operations that can be performed on a stack.',
          type: 'enumeration',
          points: 20,
          choices: [],
          correctAnswer: '',
          answers: ['Push', 'Pop', 'Peek']
        },
        {
          text: 'Explain the difference between an array and a linked list in terms of memory allocation and access time.',
          type: 'essay',
          points: 20,
          choices: [],
          correctAnswer: '',
          answers: []
        }
      ]
    });
    tests.push(await dataStructuresTest.save());

    // Database Management Test
    const databaseTest = new Test({
      title: 'Database Management Systems Quiz',
      subjectCode: 'CS301',
      description: 'Quiz on SQL queries and database normalization',
      timeLimit: 90,
      deadline: new Date('2024-11-30'),
      access: 'Private',
      status: 'active',
      howManyQuestions: 4,
      passingPoints: 50,
      assignedSections: ['BSIT3-A', 'BSCS3-A'],
      prerequisites: [],
      createdBy: createdProfessors[0]._id,
      questions: [
        {
          text: 'Which SQL command is used to retrieve data from a database?',
          type: 'multiple',
          points: 25,
          choices: ['GET', 'SELECT', 'RETRIEVE', 'FETCH'],
          correctAnswer: ['SELECT'],
          answers: []
        },
        {
          text: 'Normalization helps reduce data redundancy in databases.',
          type: 'truefalse',
          points: 25,
          choices: [],
          correctAnswer: 'True',
          answers: []
        },
        {
          text: 'List the first three normal forms.',
          type: 'enumeration',
          points: 25,
          choices: [],
          correctAnswer: '',
          answers: ['1NF', '2NF', '3NF']
        },
        {
          text: 'What is a primary key and why is it important in database design?',
          type: 'essay',
          points: 25,
          choices: [],
          correctAnswer: '',
          answers: []
        }
      ]
    });
    tests.push(await databaseTest.save());

    // Calculus Test
    const calculusTest = new Test({
      title: 'Calculus I Final Examination',
      subjectCode: 'MATH101',
      description: 'Comprehensive final exam covering limits, derivatives, and integrals',
      timeLimit: 180,
      deadline: new Date('2024-12-20'),
      access: 'Public',
      status: 'active',
      howManyQuestions: 3,
      passingPoints: 70,
      assignedSections: ['BSCE1-A', 'BSCE1-B', 'BSEE1-A', 'BSME1-A'],
      prerequisites: [],
      createdBy: createdProfessors[1]._id,
      questions: [
        {
          text: 'What is the derivative of f(x) = 3x² + 2x - 5?',
          type: 'identification',
          points: 33,
          choices: [],
          correctAnswer: '',
          answers: ['6x + 2']
        },
        {
          text: 'The limit of 1/x as x approaches infinity is 0.',
          type: 'truefalse',
          points: 33,
          choices: [],
          correctAnswer: 'True',
          answers: []
        },
        {
          text: 'Explain the Fundamental Theorem of Calculus and its significance.',
          type: 'essay',
          points: 34,
          choices: [],
          correctAnswer: '',
          answers: []
        }
      ]
    });
    tests.push(await calculusTest.save());

    // Web Development Test
    const webDevTest = new Test({
      title: 'Web Development Fundamentals',
      subjectCode: 'CS202',
      description: 'Basic web development concepts including HTML, CSS, and JavaScript',
      timeLimit: 60,
      deadline: new Date('2024-10-30'),
      access: 'Public',
      status: 'active',
      howManyQuestions: 4,
      passingPoints: 60,
      assignedSections: ['BSIT2-A', 'BSIT2-B', 'BSCS2-A', 'BSCS2-B'],
      prerequisites: [],
      createdBy: createdProfessors[0]._id,
      questions: [
        {
          text: 'Which HTML tag is used for the largest heading?',
          type: 'multiple',
          points: 25,
          choices: ['<h6>', '<heading>', '<h1>', '<head>'],
          correctAnswer: ['<h1>'],
          answers: []
        },
        {
          text: 'CSS stands for Cascading Style Sheets.',
          type: 'truefalse',
          points: 25,
          choices: [],
          correctAnswer: 'True',
          answers: []
        },
        {
          text: 'List three JavaScript data types.',
          type: 'enumeration',
          points: 25,
          choices: [],
          correctAnswer: '',
          answers: ['String', 'Number', 'Boolean']
        },
        {
          text: 'What is the difference between let and var in JavaScript?',
          type: 'essay',
          points: 25,
          choices: [],
          correctAnswer: '',
          answers: []
        }
      ]
    });
    tests.push(await webDevTest.save());

    console.log(`✅ Created ${tests.length} tests`);

    // Create Student Test Attempts
    console.log('📊 Creating Student Test Attempts...');
    const attempts = [];

    // Generate attempts for the last 3 months
    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Create attempts for regular students
    tests.forEach(test => {
      // Get students in assigned sections
      const eligibleStudents = createdStudents.filter(student => 
        test.assignedSections.includes(student.section)
      );

      // Create attempts for 80% of eligible students
      const studentsWithAttempts = eligibleStudents.slice(0, Math.floor(eligibleStudents.length * 0.8));

      studentsWithAttempts.forEach(student => {
        const takenAt = getRandomDate(threeMonthsAgo, now);
        const score = getRandomScore(50, 95); // Scores between 50-95%
        const passed = score >= test.passingPoints;

        // Create question results
        const questionResults = test.questions.map(question => {
          const isCorrect = Math.random() > 0.3; // 70% chance of correct answer
          const pointsEarned = isCorrect ? question.points : 0;
          
          return {
            questionId: question._id,
            questionText: question.text,
            questionType: question.type,
            studentAnswer: getRandomElement(question.choices || ['Sample answer']),
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect,
            pointsEarned: pointsEarned,
            maxPoints: question.points,
            feedback: {
              text: isCorrect ? 'Great job!' : 'Review this concept',
              file: ''
            }
          };
        });

        attempts.push({
          student: student._id,
          test: test._id,
          score: score,
          passed: passed,
          questionResults: questionResults,
          takenAt: takenAt
        });
      });
    });

    // Create specific attempts for test students
    const testStudent1 = createdStudents.find(s => s.studentID === '2023-TEST01');
    const testStudent2 = createdStudents.find(s => s.studentID === '2023-TEST02');
    const testStudent3 = createdStudents.find(s => s.studentID === '2023-TEST03');

    // Test Student 1 (High performer)
    if (testStudent1) {
      tests.forEach(test => {
        if (test.assignedSections.includes(testStudent1.section)) {
          const takenAt = getRandomDate(threeMonthsAgo, now);
          const score = getRandomScore(85, 95); // High scores
          const passed = score >= test.passingPoints;

          const questionResults = test.questions.map(question => {
            const isCorrect = Math.random() > 0.1; // 90% chance of correct answer
            const pointsEarned = isCorrect ? question.points : 0;
            
            return {
              questionId: question._id,
              questionText: question.text,
              questionType: question.type,
              studentAnswer: getRandomElement(question.choices || ['Well-explained answer']),
              correctAnswer: question.correctAnswer,
              isCorrect: isCorrect,
              pointsEarned: pointsEarned,
              maxPoints: question.points,
              feedback: {
                text: isCorrect ? 'Excellent work!' : 'Minor improvement needed',
                file: ''
              }
            };
          });

          attempts.push({
            student: testStudent1._id,
            test: test._id,
            score: score,
            passed: passed,
            questionResults: questionResults,
            takenAt: takenAt
          });
        }
      });
    }

    // Test Student 2 (Average performer)
    if (testStudent2) {
      tests.forEach(test => {
        if (test.assignedSections.includes(testStudent2.section)) {
          const takenAt = getRandomDate(threeMonthsAgo, now);
          const score = getRandomScore(65, 80); // Average scores
          const passed = score >= test.passingPoints;

          const questionResults = test.questions.map(question => {
            const isCorrect = Math.random() > 0.3; // 70% chance of correct answer
            const pointsEarned = isCorrect ? question.points : 0;
            
            return {
              questionId: question._id,
              questionText: question.text,
              questionType: question.type,
              studentAnswer: getRandomElement(question.choices || ['Average answer']),
              correctAnswer: question.correctAnswer,
              isCorrect: isCorrect,
              pointsEarned: pointsEarned,
              maxPoints: question.points,
              feedback: {
                text: isCorrect ? 'Good work!' : 'Needs more practice',
                file: ''
              }
            };
          });

          attempts.push({
            student: testStudent2._id,
            test: test._id,
            score: score,
            passed: passed,
            questionResults: questionResults,
            takenAt: takenAt
          });
        }
      });
    }

    // Test Student 3 (Struggling performer)
    if (testStudent3) {
      tests.forEach(test => {
        if (test.assignedSections.includes(testStudent3.section)) {
          const takenAt = getRandomDate(threeMonthsAgo, now);
          const score = getRandomScore(40, 65); // Lower scores
          const passed = score >= test.passingPoints;

          const questionResults = test.questions.map(question => {
            const isCorrect = Math.random() > 0.6; // 40% chance of correct answer
            const pointsEarned = isCorrect ? question.points : 0;
            
            return {
              questionId: question._id,
              questionText: question.text,
              questionType: question.type,
              studentAnswer: getRandomElement(question.choices || ['Incomplete answer']),
              correctAnswer: question.correctAnswer,
              isCorrect: isCorrect,
              pointsEarned: pointsEarned,
              maxPoints: question.points,
              feedback: {
                text: isCorrect ? 'Good effort!' : 'Needs significant improvement',
                file: ''
              }
            };
          });

          attempts.push({
            student: testStudent3._id,
            test: test._id,
            score: score,
            passed: passed,
            questionResults: questionResults,
            takenAt: takenAt
          });
        }
      });
    }

    const createdAttempts = await StudentTestAttempt.insertMany(attempts);
    console.log(`✅ Created ${createdAttempts.length} test attempts`);

    // Create some archived tests
    console.log('📁 Creating Archived Tests...');
    const archivedTest = new Test({
      title: 'Introduction to Programming - Old Version',
      subjectCode: 'CS101',
      description: 'Archived introductory programming test',
      timeLimit: 90,
      deadline: new Date('2023-12-31'),
      access: 'Public',
      status: 'archived',
      howManyQuestions: 3,
      passingPoints: 60,
      assignedSections: ['BSIT1-A'],
      prerequisites: [],
      createdBy: createdProfessors[0]._id,
      questions: [
        {
          text: 'What is a variable in programming?',
          type: 'essay',
          points: 33,
          choices: [],
          correctAnswer: '',
          answers: []
        },
        {
          text: 'Python is a compiled language.',
          type: 'truefalse',
          points: 33,
          choices: [],
          correctAnswer: 'False',
          answers: []
        },
        {
          text: 'List three data types in JavaScript.',
          type: 'enumeration',
          points: 34,
          choices: [],
          correctAnswer: '',
          answers: ['String', 'Number', 'Boolean']
        }
      ]
    });
    await archivedTest.save();
    console.log('✅ Created archived test');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👨‍🏫 Admins: Your account + ${createdProfessors.length} Professors`);
    console.log(`   🎓 Students: ${createdStudents.length} (including 3 test students)`);
    console.log(`   📚 Sections: ${createdSections.length}`);
    console.log(`   📝 Tests: ${tests.length + 1} (including 1 archived)`);
    console.log(`   📊 Test Attempts: ${createdAttempts.length}`);
    
    console.log('\n🔑 Login Credentials:');
    console.log('\n👨‍🏫 Admin Account:');
    console.log(`   Email: jama.presentacion.au@phinmaed.com`);
    console.log(`   Password: [Your existing password]`);
    
    console.log('\n🎓 Test Student Accounts:');
    console.log(`   1. High Performer:`);
    console.log(`      Email: test.student@university.edu`);
    console.log(`      Password: [Same as admin password]`);
    console.log(`      Performance: 85-95% scores`);
    
    console.log(`   2. Average Performer:`);
    console.log(`      Email: average.student@university.edu`);
    console.log(`      Password: [Same as admin password]`);
    console.log(`      Performance: 65-80% scores`);
    
    console.log(`   3. Struggling Performer:`);
    console.log(`      Email: struggling.student@university.edu`);
    console.log(`      Password: [Same as admin password]`);
    console.log(`      Performance: 40-65% scores`);
    
    console.log('\n🚀 You can now test both admin and student functionalities!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the seeding script
seedData();