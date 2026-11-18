// utils/otpService.js
import { sendOTPEmail, sendAccountEditOTPEmail } from "./emailService.js";

const otpStore = new Map(); // email → { otp, expiresAt, purpose }

export function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

export async function sendUserOTP(email, purpose = "account_verification") {
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(email, { otp, expiresAt, purpose });

  try {
    // Use different email templates based on purpose
    if (purpose === "account_edit") {
      await sendAccountEditOTPEmail(email, otp);
    } else {
      await sendOTPEmail(email, otp); // Default student registration
    }
    console.log(`✅ OTP sent to ${email} for ${purpose}: ${otp}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send OTP to ${email}:`, err.message);
    throw err;
  }
}

export function verifyUserOTP(email, userInput, purpose = "account_verification") {
  const record = otpStore.get(email);
  if (!record) return { valid: false, reason: "No OTP found" };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(email);
    return { valid: false, reason: "OTP expired" };
  }
  if (record.otp !== userInput) return { valid: false, reason: "Incorrect OTP" };
  if (record.purpose !== purpose) return { valid: false, reason: "OTP purpose mismatch" };
  
  otpStore.delete(email); // one-time use
  return { valid: true };
}

// Clear expired OTPs periodically (optional)
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(email);
      console.log(`🧹 Cleared expired OTP for ${email}`);
    }
  }
}, 60 * 1000); // Run every minute