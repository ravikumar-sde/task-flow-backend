const nodemailer = require('nodemailer');

/**
 * Email Service
 * Handles sending emails for verification, notifications, etc.
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    // Check if email configuration is available
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️  Email configuration not found. Email features will be disabled.');
      console.warn('   Add EMAIL_HOST, EMAIL_USER, EMAIL_PASS to .env to enable email verification.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable() {
    return this.transporter !== null;
  }

  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, name, verificationCode) {
    if (!this.isAvailable()) {
      console.warn('⚠️  Email service not available. Skipping verification email.');
      console.log(`📧 Verification code for ${email}: ${verificationCode}`);
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Task Flow App'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - Task Flow App',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .code-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
              .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Welcome to Task Flow!</h1>
              </div>
              <div class="content">
                <h2>Hi ${name},</h2>
                <p>Thank you for signing up! To complete your registration, please verify your email address.</p>
                
                <div class="code-box">
                  <p style="margin: 0; font-size: 14px; color: #666;">Your verification code is:</p>
                  <div class="code">${verificationCode}</div>
                </div>
                
                <p>Enter this code in the verification page to activate your account.</p>
                <p><strong>This code will expire in 15 minutes.</strong></p>
                
                <p>If you didn't create an account with us, please ignore this email.</p>
                
                <p>Best regards,<br>The Task Flow App Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Hi ${name},
          
          Thank you for signing up for Task Flow App!
          
          Your verification code is: ${verificationCode}
          
          This code will expire in 15 minutes.
          
          If you didn't create an account with us, please ignore this email.
          
          Best regards,
          The Task Flow App Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${email}: ${info.messageId}`);
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send verification email to ${email}:`, error.message);
      // Log the code to console for development
      console.log(`📧 Verification code for ${email}: ${verificationCode}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email (for future use)
   */
  async sendPasswordResetEmail(email, name, resetToken) {
    // Implementation for password reset email
    // Can be implemented later
  }
}

// Export singleton instance
module.exports = new EmailService();

