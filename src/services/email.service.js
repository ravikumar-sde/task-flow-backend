const sgMail = require('@sendgrid/mail');

/**
 * Email Service
 * Handles all email-related operations including sending verification emails
 * Uses SendGrid for reliable email delivery
 */
class EmailService {
  constructor() {
    this.isConfigured = false;
    this.fromEmail = null;
    this.initializeSendGrid();
  }

  /**
   * Initialize SendGrid with API key
   */
  initializeSendGrid() {
    // Check if SendGrid API key is available
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️  SendGrid API key not configured. Email features will be disabled.');
      console.warn('   Set SENDGRID_API_KEY in .env to enable email features.');
      return;
    }

    // Check if sender email is configured
    if (!process.env.EMAIL_USER) {
      console.warn('⚠️  Sender email not configured. Email features will be disabled.');
      console.warn('   Set EMAIL_USER in .env to enable email features.');
      return;
    }

    try {
      // Set SendGrid API key
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      // Set sender email
      this.fromEmail = process.env.EMAIL_USER;
      this.isConfigured = true;

      console.log('✅ SendGrid email service initialized successfully');
      console.log(`   Sender email: ${this.fromEmail}`);
    } catch (error) {
      console.error('❌ Failed to initialize SendGrid:', error.message);
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable() {
    return this.isConfigured;
  }

  /**
   * Generate a random 6-digit verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification email to user using SendGrid
   */
  async sendVerificationEmail(email, name, verificationCode) {
    if (!this.isAvailable()) {
      console.warn(`⚠️  Email service not available. Verification code for ${email}: ${verificationCode}`);
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const msg = {
        to: email,
        from: {
          email: this.fromEmail,
          name: process.env.EMAIL_FROM_NAME || 'Task Flow'
        },
        subject: 'Verify Your Email - Task Flow',
        text: `
Welcome to Task Flow!

Hi ${name},

Thank you for signing up for Task Flow!

Your verification code is: ${verificationCode}

This code will expire in 15 minutes.

If you didn't create an account, please ignore this email.

Best regards,
The Task Flow Team
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .code-box { background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to Task Flow!</h1>
    </div>
    <div class="content">
      <p>Hi <strong>${name}</strong>,</p>
      <p>Thank you for signing up! Please verify your email address to complete your registration.</p>

      <div class="code-box">
        <p style="margin: 0; font-size: 14px; color: #666;">Your verification code is:</p>
        <div class="code">${verificationCode}</div>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">This code will expire in 15 minutes</p>
      </div>

      <p>Enter this code in the verification page to activate your account.</p>

      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
        If you didn't create an account with Task Flow, please ignore this email.
      </p>

      <p style="margin-top: 20px;">
        Best regards,<br>
        The Task Flow Team
      </p>
    </div>
    <div class="footer">
      <p>© 2024 Task Flow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
        `,
      };

      const response = await sgMail.send(msg);
      console.log(`✅ Verification email sent to ${email} via SendGrid`);
      console.log(`   Status: ${response[0].statusCode}`);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode
      };
    } catch (error) {
      console.error(`❌ Failed to send verification email to ${email}:`, error.message);

      // Log detailed error for debugging
      if (error.response) {
        console.error(`   SendGrid Error: ${error.response.body.errors[0].message}`);
      }

      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();

