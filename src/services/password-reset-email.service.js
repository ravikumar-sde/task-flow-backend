const sgMail = require('@sendgrid/mail');

// Separate from verification mail: no code-logging fallback and no provider
// error objects (which may contain the entire message) leave this adapter.
async function sendPasswordResetEmail({ email, token, expiresAt, pageUrl }) {
  if (!process.env.SENDGRID_API_KEY || !process.env.EMAIL_USER || !pageUrl) {
    return { success: false };
  }
  try {
    const url = new URL(pageUrl);
    url.searchParams.set('token', token);
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to: email,
      from: {
        email: process.env.EMAIL_USER,
        name: process.env.EMAIL_FROM_NAME || 'Task Flow',
      },
      subject: 'Reset your password - Task Flow',
      text: `Use this link to reset your password:\n${url.href}\n\nThis link expires at ${expiresAt.toISOString()}. Only the most recently requested link is valid. If you did not request a reset, ignore this email.`,
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}

module.exports = { sendPasswordResetEmail };
