const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const UserModel = require('../database/models/UserModel');
require('dotenv').config();

/**
 * Passport Configuration
 * Sets up OAuth strategies for Google, GitHub, etc.
 */

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/v1/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract user info from Google profile
          const email = profile.emails[0].value;
          const name = profile.displayName;
          const providerId = profile.id;
          const avatar = profile.photos[0]?.value;

          // Find or create user
          let user = await UserModel.findOne({ providerId, authProvider: 'google' });

          if (!user) {
            // Check if user exists with same email
            user = await UserModel.findOne({ email });

            if (user) {
              // Link Google account to existing user
              user.providerId = providerId;
              user.authProvider = 'google';
              if (avatar) user.avatar = avatar;
              user.isEmailVerified = true;
              await user.save();
            } else {
              // Create new user
              user = await UserModel.create({
                name,
                email,
                providerId,
                authProvider: 'google',
                avatar,
                isEmailVerified: true,
              });
            }
          }

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/v1/auth/github/callback',
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract user info from GitHub profile
          const email = profile.emails[0].value;
          const name = profile.displayName || profile.username;
          const providerId = profile.id;
          const avatar = profile.photos[0]?.value;

          // Find or create user
          let user = await UserModel.findOne({ providerId, authProvider: 'github' });

          if (!user) {
            // Check if user exists with same email
            user = await UserModel.findOne({ email });

            if (user) {
              // Link GitHub account to existing user
              user.providerId = providerId;
              user.authProvider = 'github';
              if (avatar) user.avatar = avatar;
              user.isEmailVerified = true;
              await user.save();
            } else {
              // Create new user
              user = await UserModel.create({
                name,
                email,
                providerId,
                authProvider: 'github',
                avatar,
                isEmailVerified: true,
              });
            }
          }

          done(null, user);
        } catch (error) {
          done(error, null);
        }
      }
    )
  );
}

module.exports = passport;

