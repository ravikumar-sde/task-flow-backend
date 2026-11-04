const { randomBytes, createHash } = require('node:crypto');
const { normalizeEmail } = require('validator');
const UserModel = require('../database/models/UserModel');
const RecoveryLimitModel = require('../database/models/RecoveryLimitModel');
const resetEmail = require('../services/password-reset-email.service');
const config = require('../config/server');

const MESSAGE = 'If an eligible account exists, a password-reset link will be sent.';
const hashToken = token => createHash('sha256').update(token).digest('hex');

class PasswordRecoveryUseCase {
  constructor({ users = UserModel, limits = RecoveryLimitModel,
    mail = resetEmail, settings = config.recovery,
    clock = () => new Date(), log = console } = {}) {
    Object.assign(this, { users, limits, mail, settings, clock, log });
  }

  async request({ email, ip }) {
    try {
      // Match express-validator's default normalization even for internal calls.
      const normalized = typeof email === 'string' ? normalizeEmail(email.trim()) : false;
      if (!normalized) return { message: MESSAGE };
      // Consume both dimensions for eligible and ineligible accounts alike.
      const emailAllowed = await this.limits.consume('email', normalized, this.settings.emailLimit);
      const ipAllowed = await this.limits.consume('ip', ip || 'unknown', this.settings.ipLimit);
      if (!emailAllowed || !ipAllowed) return { message: MESSAGE };

      const token = randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(this.clock().getTime() + this.settings.expiryMinutes * 60000);
      // Eligibility and replacement are one atomic write. OAuth accounts with
      // retained password hashes remain ineligible. No password field is changed.
      const user = await this.users.findOneAndUpdate({
        email: normalized,
        authProvider: 'local',
        password: { $type: 'string', $ne: '' },
      }, { $set: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      } }, { new: true });
      if (!user) return { message: MESSAGE };

      let delivered = false;
      try {
        const result = await this.mail.sendPasswordResetEmail({
          email: user.email, token, expiresAt, pageUrl: this.settings.pageUrl,
        });
        delivered = result?.success === true;
      } catch {
        // Injected providers must not leak error messages either.
      }
      if (!delivered) {
        this.log.warn('Password reset delivery failed');
        // Never clear a replacement issued concurrently by another request.
        await this.users.updateOne({ _id: user._id, passwordResetTokenHash: tokenHash }, {
          $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' },
        });
      }
    } catch {
      this.log.warn('Password reset request failed');
    }
    return { message: MESSAGE };
  }
}

module.exports = { PasswordRecoveryUseCase, MESSAGE, hashToken };
