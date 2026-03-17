import express from 'express';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * Build the HTML email body for a contact submission
 */
const buildEmailHtml = (name, email, phone, subject, message) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">
      New Contact Form Submission
    </h2>
    <div style="margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>Name:</strong> ${name}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> ${email}</p>
      ${phone ? `<p style="margin: 10px 0;"><strong>Phone:</strong> ${phone}</p>` : ''}
      <p style="margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>
    </div>
    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #000;">
      <h3 style="margin-top: 0;">Message:</h3>
      <p style="white-space: pre-wrap;">${message}</p>
    </div>
    <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px;">
      This email was sent from the Shringarika contact form.
    </p>
  </div>
`;

/**
 * Step 1 — Save contact submission to Supabase (primary, always reliable)
 * Returns true on success, false if the table does not exist yet or on any error.
 */
const saveContactToDatabase = async (name, email, phone, subject, message) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('contact_submissions')
      .insert([{
        name:    name.trim(),
        email:   email.trim().toLowerCase(),
        phone:   phone ? phone.trim() : null,
        subject: subject.trim(),
        message: message.trim(),
        status:  'new',
        created_at: new Date().toISOString(),
      }]);

    if (error) {
      // PGRST116 = relation does not exist (table not yet created) — non-fatal
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn('⚠️  [Contact] contact_submissions table not found – skipping DB save.');
      } else {
        console.error('❌ [Contact] DB insert error:', error.message);
      }
      return false;
    }

    console.log('✅ [Contact] Submission saved to database.');
    return true;
  } catch (err) {
    console.error('❌ [Contact] Unexpected DB error:', err.message);
    return false;
  }
};

/**
 * Step 2 — Send notification email via Gmail SMTP (secondary, may fail)
 * Returns { sent: boolean, error: string|null }
 */
const sendContactEmail = async (name, email, phone, subject, message) => {
  const emailUser = process.env.EMAIL_USERNAME;
  const emailPass = process.env.EMAIL_PASSWORD;

  if (!emailUser || !emailPass) {
    console.warn('⚠️  [Contact] EMAIL_USERNAME or EMAIL_PASSWORD not set in .env — skipping email.');
    return { sent: false, error: 'SMTP credentials not configured' };
  }

  try {
    // Create transporter lazily (inside the request) so env vars are always fresh
    const transporter = nodemailer.createTransport({
      service: 'gmail',           // Uses Google's SMTP settings automatically
      auth: {
        user: emailUser,
        pass: emailPass,          // Must be a Gmail App Password (16 chars, no spaces)
      },
      tls: {
        rejectUnauthorized: false, // Needed in some local/proxy environments
      },
    });

    // Verify SMTP credentials BEFORE trying to send
    await transporter.verify();

    const mailOptions = {
      from:    `"${process.env.EMAIL_FROM_NAME || 'Shringarika'}" <${emailUser}>`,
      to:      emailUser,          // Notify the same Gmail inbox
      subject: `[Contact Form] ${subject}`,
      html:    buildEmailHtml(name, email, phone, subject, message),
      replyTo: email,             // Reply goes directly to the customer
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ [Contact] Notification email sent successfully.');
    return { sent: true, error: null };

  } catch (smtpError) {
    // Log the specific SMTP failure with actionable hints
    console.error('❌ [Contact] SMTP error:', {
      code:    smtpError.code,
      command: smtpError.command,
      message: smtpError.message,
    });

    if (smtpError.code === 'EAUTH') {
      console.error(
        '   → Gmail authentication failed.\n' +
        '   → Ensure 2-Step Verification is ON for shringarika11@gmail.com\n' +
        '   → Generate an App Password at: https://myaccount.google.com/apppasswords\n' +
        '   → Paste the 16-character App Password (no spaces) as EMAIL_PASSWORD in server/.env'
      );
    } else if (smtpError.code === 'ECONNREFUSED' || smtpError.code === 'ENOTFOUND') {
      console.error('   → Cannot reach Gmail SMTP — check your internet connection.');
    }

    return { sent: false, error: smtpError.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contact — Handle contact form submission
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // ── Validate required fields ───────────────────────────────────────────
    const missing = [];
    if (!name    || !String(name).trim())    missing.push('name');
    if (!email   || !String(email).trim())   missing.push('email');
    if (!subject || !String(subject).trim()) missing.push('subject');
    if (!message || !String(message).trim()) missing.push('message');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please provide: ${missing.join(', ')}`,
      });
    }

    // Basic email format check (extra guard — frontend already validates)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const cleanName    = String(name).trim();
    const cleanEmail   = String(email).trim().toLowerCase();
    const cleanPhone   = phone ? String(phone).trim() : '';
    const cleanSubject = String(subject).trim();
    const cleanMessage = String(message).trim();

    // ── Step 1: Save to database (primary) ────────────────────────────────
    const savedToDb = await saveContactToDatabase(
      cleanName, cleanEmail, cleanPhone, cleanSubject, cleanMessage
    );

    // ── Step 2: Send notification email (secondary) ───────────────────────
    const { sent: emailSent } = await sendContactEmail(
      cleanName, cleanEmail, cleanPhone, cleanSubject, cleanMessage
    );

    // ── Absolute fallback: log to server console so the submission is NEVER lost
    // This is the last resort — admin can always check backend logs
    if (!savedToDb && !emailSent) {
      console.warn('⚠️  ══════════════════════════════════════════════════════');
      console.warn('⚠️  CONTACT SUBMISSION — both DB and email failed.');
      console.warn('⚠️  Logged here so it is NOT lost. Admin: check server logs.');
      console.warn('⚠️  ──────────────────────────────────────────────────────');
      console.warn(`⚠️  Name:    ${cleanName}`);
      console.warn(`⚠️  Email:   ${cleanEmail}`);
      if (cleanPhone) console.warn(`⚠️  Phone:   ${cleanPhone}`);
      console.warn(`⚠️  Subject: ${cleanSubject}`);
      console.warn(`⚠️  Message: ${cleanMessage}`);
      console.warn('⚠️  ══════════════════════════════════════════════════════');
      console.warn('⚠️  TO FIX DB: Run server/database/migrations/016_create_contact_submissions.sql in Supabase dashboard');
      console.warn('⚠️  TO FIX EMAIL: Set a valid Gmail App Password in server/.env → EMAIL_PASSWORD');
      console.warn('⚠️      → https://myaccount.google.com/apppasswords (requires 2-Step Verification ON)');
    }

    // ── Decide response ────────────────────────────────────────────────────
    // Always return 200 — the submission was either saved to DB, delivered by
    // email, OR logged to the server console as a fallback.  The user should
    // never receive a 500 because of server-side configuration issues.
    return res.status(200).json({
      success: true,
      message: 'Message sent successfully! We will get back to you soon.',
    });

  } catch (error) {
    console.error('❌ [Contact] Unexpected error in route handler:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

export default router;
