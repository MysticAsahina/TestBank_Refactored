import express from "express";
import Admin from "../../models/Admin.js";
import { requireAuth } from "../../middleware/auth.js";
import { checkRole } from "../../middleware/checkRole.js"; // ✅ fixed import
import { sendPasswordSetupEmail } from "../../utils/passwordResetService.js";
import { sendUserOTP, verifyUserOTP } from "../../utils/otpService.js";

const router = express.Router();

// ✅ Only authenticated Deans can access Manage Accounts
router.use(requireAuth);
router.use(checkRole(["Dean"]));

// ====================== Manage Accounts Page ======================
router.get("/", async (req, res) => {
  try {
    const professors = await Admin.find({ role: "Professor" }).lean();
    const deans = await Admin.find({ role: "Dean" }).lean();

    const alert = req.session.alert || null;
    req.session.alert = null; // clear after use

    res.render("dean/ManageAccounts", {
      title: "Manage Accounts - Test Bank System",
      user: req.session.user,
      professors,
      deans,
      alert,
    });
  } catch (err) {
    console.error("❌ Error loading accounts:", err);
    req.session.alert = {
      type: "danger",
      message: "Failed to load accounts",
    };
    res.redirect("/dean/dashboard");
  }
});

// ====================== Add User ======================
router.post("/add-user", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      middleName,
      email,
      contactNumber,
      employeeID,
      department,
      role,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !employeeID || !department || !role) {
      req.session.alert = {
        type: "danger",
        message: "All required fields must be filled",
      };
      return res.redirect("/dean/manage-accounts");
    }

    // 🔍 Check for duplicates first
    const existingUser = await Admin.findOne({
      $or: [{ email }, { employeeID }],
    });

    if (existingUser) {
      req.session.alert = {
        type: "danger",
        message: "A user with this email or employee ID already exists.",
      };
      return res.redirect("/dean/manage-accounts");
    }

    const newUser = new Admin({
      firstName,
      lastName,
      middleName: middleName || "",
      email,
      contactNumber: contactNumber || "",
      employeeID,
      department,
      role,
      designation: role,
      employmentStatus: "Full-time",
      accountStatus: "Active",
      password: "$2a$12$rypunVcKVCq.aomFTeBGFOD3E9sX62.SoSnLAYxY1Xt/AUg3tORqq", // Default: "password123"
      createdBy: req.session.user?.fullName || "System",
    });

    await newUser.save();
    console.log(`✅ New ${role} added: ${employeeID}`);

    // Send password setup email
    try {
      await sendPasswordSetupEmail(newUser.email, newUser._id);
    } catch (emailError) {
      console.error("❌ Failed to send setup email:", emailError);
      // Continue anyway - this is not critical
    }

    req.session.alert = {
      type: "success",
      message: `${role} added successfully! Password setup email sent.`,
    };
    res.redirect("/dean/manage-accounts");
  } catch (err) {
    console.error("❌ Error adding user:", err);
    req.session.alert = {
      type: "danger",
      message: "An error occurred while adding the user.",
    };
    res.redirect("/dean/manage-accounts");
  }
});

// ====================== Send OTP (for edit verification) ======================
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is required" 
      });
    }

    // Use "account_edit" purpose for professor/dean account edits
    await sendUserOTP(email, "account_edit");
    res.json({ 
      success: true, 
      message: "Verification OTP sent successfully to your email" 
    });
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send OTP. Please try again." 
    });
  }
});

// ====================== Save edited user (with OTP verification) ======================
router.post("/edit-user", async (req, res) => {
  try {
    const { id, email, firstName, lastName, department, contactNumber, otp } = req.body;

    // Validate required fields
    if (!id || !email || !firstName || !lastName || !department || !otp) {
      return res.status(400).json({
        success: false,
        message: "All fields including OTP are required",
      });
    }

    // 1️⃣ OTP Validation with "account_edit" purpose
    const result = verifyUserOTP(email, otp, "account_edit");
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: `OTP verification failed: ${result.reason}`,
      });
    }

    // 2️⃣ Duplicate Email Check (exclude current user)
    const existing = await Admin.findOne({ 
      email, 
      _id: { $ne: id } 
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already exists in another account",
      });
    }

    // 3️⃣ Update user
    const updatedUser = await Admin.findByIdAndUpdate(
      id,
      { 
        firstName, 
        lastName, 
        email, 
        department, 
        contactNumber: contactNumber || "" 
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    console.log(`✏️ User updated: ${updatedUser.email}`);
    res.json({ 
      success: true, 
      message: "User updated successfully" 
    });
  } catch (err) {
    console.error("❌ Error editing user:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error while updating user" 
    });
  }
});

// ====================== Delete User ======================
router.post("/delete/:id", async (req, res) => {
  try {
    const user = await Admin.findById(req.params.id);
    
    if (!user) {
      req.session.alert = {
        type: "danger",
        message: "User not found",
      };
      return res.redirect("/dean/manage-accounts");
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.session.user._id.toString()) {
      req.session.alert = {
        type: "danger",
        message: "You cannot delete your own account",
      };
      return res.redirect("/dean/manage-accounts");
    }

    await Admin.findByIdAndDelete(req.params.id);
    console.log("🗑️ Account deleted:", req.params.id);
    
    req.session.alert = {
      type: "success",
      message: "User deleted successfully",
    };
    res.redirect("/dean/manage-accounts");
  } catch (err) {
    console.error("❌ Error deleting account:", err);
    req.session.alert = {
      type: "danger",
      message: "Failed to delete account",
    };
    res.redirect("/dean/manage-accounts");
  }
});

export default router;