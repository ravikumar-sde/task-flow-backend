const nodemailer = require('nodemailer');

/**
 * Email Service
 * Handles all email-related operations including sending verification emails
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter with SMTP configuration
   */
  initializeTransporter() {
    // Check if email configuration is available
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️  Email service not configured. Email features will be disabled.');
      console.warn('   Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in .env to enable email features.');
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
   * Generate a random 6-digit verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification email to user
   */
  async sendVerificationEmail(email, name, verificationCode) {
    if (!this.isAvailable()) {
      console.warn(`⚠️  Email service not available. Verification code for ${email}: ${verificationCode}`);
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const mailOptions = {
        from: `"Task Flow" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - Task Flow',
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
              .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
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
        text: `
          Welcome to Task Flow App!
          
          Hi ${name},
          
          Thank you for signing up for Task Flow App!
          
          Your verification code is: ${verificationCode}
          
          This code will expire in 15 minutes.
          
          If you didn't create an account, please ignore this email.
          
          Best regards,
          The Task Flow App Team
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${email}. Message ID: ${info.messageId}`);
      
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send verification email to ${email}:`, error.message);
      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();

