/**
 * Test Email Sending
 * Run this script to test email configuration
 */

require('dotenv').config();
const emailService = require('./src/services/email.service');

async function testEmail() {
  console.log('\n🧪 Testing Email Configuration...\n');
  
  // Check configuration
  console.log('📋 Email Configuration:');
  console.log(`   Host: ${process.env.EMAIL_HOST}`);
  console.log(`   Port: ${process.env.EMAIL_PORT}`);
  console.log(`   Secure: ${process.env.EMAIL_SECURE}`);
  console.log(`   User: ${process.env.EMAIL_USER}`);
  console.log(`   Pass: ${process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET'}`);
  console.log(`   From Name: ${process.env.EMAIL_FROM_NAME}`);
  console.log('');
  
  // Check if service is available
  if (!emailService.isAvailable()) {
    console.error('❌ Email service is not available!');
    console.error('   Please check your .env configuration.');
    process.exit(1);
  }
  
  console.log('✅ Email service is available\n');
  
  // Generate test verification code
  const testCode = emailService.generateVerificationCode();
  console.log(`📧 Generated verification code: ${testCode}\n`);
  
  // Send test email
  const testEmail = 'xmartrvsingh@gmail.com';
  const testName = 'Test User';
  
  console.log(`📤 Sending test email to: ${testEmail}...`);
  console.log('   Please wait...\n');
  
  try {
    const result = await emailService.sendVerificationEmail(testEmail, testName, testCode);
    
    if (result.success) {
      console.log('✅ SUCCESS! Email sent successfully!');
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`\n📬 Check inbox at: ${testEmail}`);
      console.log('   (Also check spam/junk folder)\n');
    } else {
      console.error('❌ FAILED! Email was not sent.');
      console.error(`   Error: ${result.error || result.message}`);
      console.log(`\n📧 Verification code (for testing): ${testCode}\n`);
    }
  } catch (error) {
    console.error('❌ ERROR! Exception occurred:');
    console.error(`   ${error.message}`);
    console.error('\n📋 Full error:');
    console.error(error);
  }
  
  process.exit(0);
}

// Run test
testEmail();

