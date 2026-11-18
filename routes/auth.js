import express from 'express';
import bcrypt from 'bcryptjs';
import Student from '../models/Student.js';
import Admin from '../models/Admin.js';
import { sendOTPEmail } from '../utils/emailService.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Temporary OTP stores (use Redis or DB in production)
const otpStore = new Map();
const resetOtpStore = new Map();

/* ================================================================
   🧩 STUDENT REGISTRATION + OTP
================================================================ */
router.post('/register', async (req, res) => {
    try {
        const {
            lastName,
            firstName,
            middleName,
            suffix,
            studentID,
            email,
            password,
            course,
            section,
            yearLevel,
            campus, 
        } = req.body;

        console.log('📝 Registration attempt:', { studentID, email });

        // Validate required fields
        const requiredFields = ['lastName', 'firstName', 'studentID', 'email', 'password', 'course', 'section', 'yearLevel', 'campus'];
        const missing = requiredFields.filter(f => !req.body[f]);
        if (missing.length > 0)
            return res.status(400).json({ success: false, message: `Missing: ${missing.join(', ')}` });

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return res.status(400).json({ success: false, message: 'Invalid email format!' });

        // Validate Student ID (e.g., 12-3456-789012)
        if (!/^\d{2}-\d{4}-\d{6}$/.test(studentID))
            return res.status(400).json({ success: false, message: 'Student ID must match: 12-3456-789012' });

        // Check duplicates
        const existing = await Student.findOne({ $or: [{ studentID }, { email }] });
        if (existing)
            return res.status(400).json({ success: false, message: 'Student ID or Email already exists!' });

        // Hash password
        const hashed = await bcrypt.hash(password, 12);

        // Create new student (not yet saved)
        const newStudent = new Student({
            lastName, firstName, middleName, suffix: suffix || '',
            studentID, email, password: hashed, course, section, yearLevel, campus
        });

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + 10 * 60 * 1000;

        otpStore.set(studentID, { studentData: newStudent, otp, expiry });
        console.log(`🔐 OTP for ${studentID}: ${otp}`);

        // Send OTP via email
        await sendOTPEmail(email, otp);
        res.status(200).json({
            success: true,
            message: 'OTP sent to your email! Please verify to complete registration.'
        });

    } catch (err) {
        console.error('❌ Registration error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during registration!' });
    }
});

/* ================================================================
   🧩 VERIFY OTP (STUDENT REGISTRATION)
================================================================ */
router.post('/verify-otp', async (req, res) => {
    try {
        const { studentId, otpCode } = req.body;
        const otpData = otpStore.get(studentId);

        if (!otpData)
            return res.status(400).json({ success: false, message: 'OTP expired or invalid!' });

        if (Date.now() > otpData.expiry) {
            otpStore.delete(studentId);
            return res.status(400).json({ success: false, message: 'OTP expired!' });
        }

        if (otpData.otp !== otpCode)
            return res.status(400).json({ success: false, message: 'Incorrect OTP!' });

        await otpData.studentData.save();
        otpStore.delete(studentId);

        console.log(`✅ Student ${studentId} registered successfully`);
        res.status(200).json({ success: true, message: 'Registration completed!' });

    } catch (err) {
        console.error('❌ OTP verification error:', err);
        res.status(500).json({ success: false, message: 'Server error verifying OTP!' });
    }
});

/* ================================================================
   🔁 RESEND OTP
================================================================ */
router.post('/resend-otp', async (req, res) => {
    try {
        const { studentId } = req.body;
        const otpData = otpStore.get(studentId);

        if (!otpData)
            return res.status(400).json({ success: false, message: 'Registration session expired!' });

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpData.otp = newOtp;
        otpData.expiry = Date.now() + 10 * 60 * 1000;

        console.log(`🔁 Resent OTP for ${studentId}: ${newOtp}`);
        await sendOTPEmail(otpData.studentData.email, newOtp);

        res.status(200).json({ success: true, message: 'New OTP sent!' });

    } catch (err) {
        console.error('❌ Resend OTP error:', err);
        res.status(500).json({ success: false, message: 'Failed to resend OTP!' });
    }
});

/* ================================================================
   🔐 LOGIN (ROLE-BASED)
================================================================ */
router.post('/login', async (req, res) => {
    try {
        const { userID, password } = req.body;

        if (!userID || !password)
            return res.status(400).render('Login', { title: 'Login', error: 'Please enter ID & password!', success: null });

        let user = null;
        let role = '';
        let userModel = '';

        // 1️⃣ Check Admins (Dean/Professor)
        user = await Admin.findOne({ $or: [{ employeeID: userID }, { email: userID }] });
        if (user) {
            role = user.role; // 'Professor' or 'Dean'
            userModel = 'Admin';
        } else {
            // 2️⃣ Check Students
            user = await Student.findOne({ $or: [{ studentID: userID }, { email: userID }] });
            if (user) {
                role = 'Student';
                userModel = 'Student';
            }
        }

        // No user found
        if (!user)
            return res.status(400).render('Login', { title: 'Login', error: 'Invalid credentials!', success: null });

        // Check account status for Admin
        if (userModel === 'Admin' && user.accountStatus && user.accountStatus !== 'Active') {
            return res.status(400).render('Login', {
                title: 'Login',
                error: `Account is ${user.accountStatus}. Contact admin.`,
                success: null
            });
        }

        // Check password
        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(400).render('Login', { title: 'Login', error: 'Invalid credentials!', success: null });

        // Create session
        req.session.user = {
            id: user._id,
            userID: user.studentID || user.employeeID,
            fullName: user.fullName,
            email: user.email,
            role,
            userModel,
            ...(role === 'Student' && {
                course: user.course,
                section: user.section,
                yearLevel: user.yearLevel,
                campus: user.campus
            }),
            ...(role !== 'Student' && {
                department: user.department,
                designation: user.designation,
                employmentStatus: user.employmentStatus
            })
        };

        console.log(`✅ Login success: ${user.fullName} (${role})`);

        // Redirect by role
        switch (role) {
            case 'Dean': return res.redirect('/dean/dashboard');
            case 'Professor': return res.redirect('/professor/dashboard');
            case 'Student': return res.redirect('/student/dashboard');
            default: return res.redirect('/');
        }

    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).render('Login', {
            title: 'Login - Test Bank System',
            error: 'Internal server error!',
            success: null
        });
    }
});

/* ================================================================
   🚪 LOGOUT
================================================================ */
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('❌ Logout error:', err);
        res.redirect('/login');
    });
});

/* ================================================================
   🔒 TEST ROUTES (FOR ROLE CHECK)
================================================================ */
router.get('/dean-only', requireAuth, requireRole(['Dean']), (req, res) => {
    res.render('dean/Dashboard', { title: 'Dean Dashboard', user: req.session.user });
});

router.get('/professor-only', requireAuth, requireRole(['Professor', 'Dean']), (req, res) => {
    res.render('professor/Dashboard', { title: 'Professor Dashboard', user: req.session.user });
});

router.get('/student-only', requireAuth, requireRole(['Student']), (req, res) => {
    res.render('student/Dashboard', { title: 'Student Dashboard', user: req.session.user });
});



// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).render('ForgotPassword', {
                error: 'Please enter your email address!',
                success: null,
                showOtpForm: false
            });
        }

        // Find user by email
        let user = await Student.findOne({ email }) || 
                   await Admin.findOne({ email });

        if (!user) {
            return res.status(400).render('ForgotPassword', {
                error: 'No account found with this email address!',
                success: null,
                showOtpForm: false
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store OTP
        resetOtpStore.set(email, {
            userId: user._id,
            userType: user.studentID ? 'Student' : 'Admin',
            otp: otp,
            expiry: otpExpiry
        });

        // Send OTP email
        try {
            await sendOTPEmail(email, otp);
            console.log(`🔐 Password reset OTP for ${email}: ${otp}`);

            res.render('ForgotPassword', {
                error: null,
                success: 'OTP sent to your email! Please check your inbox.',
                showOtpForm: true,
                email: email
            });

        } catch (emailError) {
            console.error('Email error:', emailError);
            res.status(500).render('ForgotPassword', {
                error: 'Failed to send OTP email. Please try again later.',
                success: null,
                showOtpForm: false
            });
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).render('ForgotPassword', {
            error: 'Internal server error!',
            success: null,
            showOtpForm: false
        });
    }
});

// Reset Password - Verify OTP and Update Password
router.post('/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;

        if (!email || !otp || !newPassword || !confirmPassword) {
            return res.status(400).render('ForgotPassword', {
                error: 'All fields are required!',
                success: null,
                showOtpForm: true,
                email: email
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).render('ForgotPassword', {
                error: 'Passwords do not match!',
                success: null,
                showOtpForm: true,
                email: email
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).render('ForgotPassword', {
                error: 'Password must be at least 6 characters long!',
                success: null,
                showOtpForm: true,
                email: email
            });
        }

        // Verify OTP
        const otpData = resetOtpStore.get(email);
        if (!otpData) {
            return res.status(400).render('ForgotPassword', {
                error: 'OTP expired! Please request a new one.',
                success: null,
                showOtpForm: false
            });
        }

        if (otpData.otp !== otp) {
            return res.status(400).render('ForgotPassword', {
                error: 'Invalid OTP code!',
                success: null,
                showOtpForm: true,
                email: email
            });
        }

        if (Date.now() > otpData.expiry) {
            resetOtpStore.delete(email);
            return res.status(400).render('ForgotPassword', {
                error: 'OTP has expired! Please request a new one.',
                success: null,
                showOtpForm: false
            });
        }

        // Find user and update password
        let user;
        if (otpData.userType === 'Student') {
            user = await Student.findById(otpData.userId);
        } else {
            user = await Admin.findById(otpData.userId);
        }

        if (!user) {
            return res.status(400).render('ForgotPassword', {
                error: 'User not found!',
                success: null,
                showOtpForm: false
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        await user.save();

        // Clear OTP
        resetOtpStore.delete(email);

        console.log(`✅ Password reset successful for: ${email}`);

        res.redirect('/login?success=Password reset successfully! Please login with your new password.');

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).render('ForgotPassword', {
            error: 'Internal server error during password reset!',
            success: null,
            showOtpForm: true,
            email: req.body.email
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});


// Temporary route to create Dean account (remove in production)
router.post('/setup-dean', async (req, res) => {
    try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ employeeID: 'Admin' });
        
        if (existingAdmin) {
            return res.json({
                success: false,
                message: 'Admin account already exists!'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('Admin', 12);

        // Create Dean account
        const deanAdmin = new Admin({
            lastName: 'Administrator',
            firstName: 'System',
            middleName: 'A',
            contactNumber: '09171234567',
            email: 'admin@testbanksystem.com',
            employeeID: 'Admin',
            department: 'Administration',
            designation: 'Dean',
            employmentStatus: 'Full-time',
            password: hashedPassword,
            role: 'Dean',
            accountStatus: 'Active',
            createdBy: 'System'
        });

        await deanAdmin.save();

        console.log('✅ Dean account created successfully');
        res.json({
            success: true,
            message: 'Dean account created successfully!',
            credentials: {
                ID: 'Admin',
                Password: 'Admin'
            }
        });

    } catch (error) {
        console.error('❌ Error creating Dean account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create Dean account',
            error: error.message
        });
    }
});
// Diagnostic route to check existing admin accounts
router.get('/check-accounts', async (req, res) => {
    try {
        const adminAccounts = await Admin.find({});
        const studentAccounts = await Student.find({});
        
        res.json({
            adminAccounts: adminAccounts.map(admin => ({
                employeeID: admin.employeeID,
                fullName: admin.fullName,
                role: admin.role,
                email: admin.email
            })),
            studentAccounts: studentAccounts.map(student => ({
                studentID: student.studentID,
                fullName: student.fullName,
                email: student.email
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Temporary route to access Manage Accounts page directly
router.get('/test-manage-accounts', (req, res) => {
    // Create a mock Dean session for testing
    req.session.user = {
        id: 'temp-dean-id',
        userID: '0001',
        email: 'dean@test.com',
        fullName: 'Test Dean',
        role: 'Dean',
        department: 'Computer Science',
        designation: 'Dean',
        employmentStatus: 'Full-time'
    };
    
    res.render('dean/ManageAccounts', {
        title: 'Manage Accounts',
        user: req.session.user
    });
});

// Temporary route to create test Professor account
router.get('/create-test-professor', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash('prof123', 12);

        const professor = new Admin({
            lastName: 'Smith',
            firstName: 'Jane',
            middleName: 'P',
            contactNumber: '09176543210',
            email: 'jane.smith@university.edu',
            employeeID: 'PROF001',
            department: 'Computer Science',
            designation: 'Professor',
            employmentStatus: 'Full-time',
            password: hashedPassword,
            role: 'Professor',
            accountStatus: 'Active',
            createdBy: 'System'
        });

        await professor.save();

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Professor Created</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container mt-5">
                    <div class="alert alert-success">
                        <h4>✅ Test Professor Account Created!</h4>
                        <p><strong>Login Credentials:</strong></p>
                        <ul>
                            <li><strong>ID:</strong> PROF001</li>
                            <li><strong>Password:</strong> prof123</li>
                            <li><strong>Role:</strong> Professor</li>
                        </ul>
                        <div class="mt-3">
                            <a href="/auth/test-manage-accounts" class="btn btn-primary me-2">View Manage Accounts</a>
                            <a href="/login" class="btn btn-success">Go to Login</a>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Temporary route to create test Dean account
router.get('/create-test-dean', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash('dean123', 12);

        const dean = new Admin({
            lastName: 'Wilson',
            firstName: 'Robert',
            middleName: 'D',
            contactNumber: '09179876543',
            email: 'robert.wilson@university.edu',
            employeeID: 'DEAN002',
            department: 'Administration',
            designation: 'Dean',
            employmentStatus: 'Full-time',
            password: hashedPassword,
            role: 'Dean',
            accountStatus: 'Active',
            createdBy: 'System'
        });

        await dean.save();

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Dean Created</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container mt-5">
                    <div class="alert alert-success">
                        <h4>✅ Test Dean Account Created!</h4>
                        <p><strong>Login Credentials:</strong></p>
                        <ul>
                            <li><strong>ID:</strong> DEAN002</li>
                            <li><strong>Password:</strong> dean123</li>
                            <li><strong>Role:</strong> Dean</li>
                        </ul>
                        <div class="mt-3">
                            <a href="/auth/test-manage-accounts" class="btn btn-primary me-2">View Manage Accounts</a>
                            <a href="/login" class="btn btn-success">Go to Login</a>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Temporary route to view all accounts (for testing)
router.get('/view-all-accounts', async (req, res) => {
    try {
        const adminAccounts = await Admin.find({});
        const studentAccounts = await Student.find({});
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>All Accounts</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container mt-4">
                    <h1>All System Accounts</h1>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <h3>Admin Accounts (Professors & Deans)</h3>
                            <div class="table-responsive">
                                <table class="table table-striped">
                                    <thead>
                                        <tr>
                                            <th>Employee ID</th>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Department</th>
                                            <th>Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${adminAccounts.map(admin => `
                                            <tr>
                                                <td>${admin.employeeID}</td>
                                                <td>${admin.fullName}</td>
                                                <td><span class="badge ${admin.role === 'Dean' ? 'bg-warning' : 'bg-success'}">${admin.role}</span></td>
                                                <td>${admin.department}</td>
                                                <td>${admin.email}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <h3>Student Accounts</h3>
                            <div class="table-responsive">
                                <table class="table table-striped">
                                    <thead>
                                        <tr>
                                            <th>Student ID</th>
                                            <th>Name</th>
                                            <th>Course</th>
                                            <th>Section</th>
                                            <th>Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${studentAccounts.map(student => `
                                            <tr>
                                                <td>${student.studentID}</td>
                                                <td>${student.fullName}</td>
                                                <td>${student.course}</td>
                                                <td>${student.section}</td>
                                                <td>${student.email}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-3">
                        <a href="/auth/test-manage-accounts" class="btn btn-primary me-2">Test Manage Accounts Page</a>
                        <a href="/auth/create-test-professor" class="btn btn-success me-2">Create Test Professor</a>
                        <a href="/auth/create-test-dean" class="btn btn-warning me-2">Create Test Dean</a>
                        <a href="/login" class="btn btn-info">Go to Login</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});
/* ================================================================
   🔐 VERIFY CURRENT PASSWORD
================================================================ */

// Verify current password before allowing OTP send
router.post('/verify-current-password', async (req, res) => {
    try {
        const { email, currentPassword } = req.body;
        
        if (!email || !currentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email and current password are required'
            });
        }

        // Find user by email
        let user = await Student.findOne({ email }) || 
                   await Admin.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const validCurrentPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validCurrentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        res.json({
            success: true,
            message: 'Current password verified successfully'
        });

    } catch (error) {
        console.error('Verify current password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/* ================================================================
   🔐 CHANGE PASSWORD OTP FLOW
================================================================ */

// Temporary store for password change OTPs
const passwordChangeOtpStore = new Map();

// Send OTP for password change
router.post('/send-password-otp', async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        
        if (!email || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Find user by email
        let user = await Student.findOne({ email }) || 
                   await Admin.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const validCurrentPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validCurrentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store OTP with user data
        passwordChangeOtpStore.set(email, {
            userId: user._id,
            userType: user.studentID ? 'Student' : 'Admin',
            currentPassword: currentPassword,
            newPassword: newPassword,
            otp: otp,
            expiry: otpExpiry
        });

        console.log(`🔐 Password change OTP for ${email}: ${otp}`);

        // Send OTP via email
        try {
            await sendOTPEmail(email, otp);
            
            res.json({
                success: true,
                message: 'OTP sent to your email successfully'
            });

        } catch (emailError) {
            console.error('Email error:', emailError);
            res.status(500).json({
                success: false,
                message: 'Failed to send OTP email'
            });
        }

    } catch (error) {
        console.error('Send password OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Verify OTP and change password
router.post('/verify-password-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Get OTP data
        const otpData = passwordChangeOtpStore.get(email);
        
        if (!otpData) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired or invalid. Please request a new OTP.'
            });
        }

        // Check if OTP expired
        if (Date.now() > otpData.expiry) {
            passwordChangeOtpStore.delete(email);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new OTP.'
            });
        }

        // Verify OTP
        if (otpData.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP code'
            });
        }

        // Find user
        let user;
        if (otpData.userType === 'Student') {
            user = await Student.findById(otpData.userId);
        } else {
            user = await Admin.findById(otpData.userId);
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password again (for security)
        const validCurrentPassword = await bcrypt.compare(otpData.currentPassword, user.password);
        if (!validCurrentPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password verification failed'
            });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(otpData.newPassword, 12);

        // Update password
        user.password = hashedNewPassword;
        await user.save();

        // Clear OTP data
        passwordChangeOtpStore.delete(email);

        console.log(`✅ Password changed successfully for: ${email}`);

        res.json({
            success: true,
            message: 'Password changed successfully!'
        });

    } catch (error) {
        console.error('Verify password OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Resend OTP for password change
router.post('/resend-password-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Get existing OTP data
        const otpData = passwordChangeOtpStore.get(email);
        
        if (!otpData) {
            return res.status(400).json({
                success: false,
                message: 'No active OTP session found. Please start the password change process again.'
            });
        }

        // Generate new OTP
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpData.otp = newOtp;
        otpData.expiry = Date.now() + 5 * 60 * 1000; // 5 minutes

        console.log(`🔁 Resent password change OTP for ${email}: ${newOtp}`);

        // Send new OTP via email
        try {
            await sendOTPEmail(email, newOtp);
            
            res.json({
                success: true,
                message: 'New OTP sent successfully'
            });

        } catch (emailError) {
            console.error('Email error:', emailError);
            res.status(500).json({
                success: false,
                message: 'Failed to send OTP email'
            });
        }

    } catch (error) {
        console.error('Resend password OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

export default router;