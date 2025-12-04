# GitHub Actions CI/CD Pipeline Guide

## 📋 Overview

This repository includes **3 GitHub Actions workflows** that automatically run tests, checks, and validations on your code.

---

## 🔄 Workflows

### 1. **CI Pipeline** (`ci.yml`)
**Triggers:**
- ✅ Push to `develop` branch
- ✅ Pull request to `main` branch

**Jobs:**
- **Lint** - Code quality checks
- **Test** - Run unit tests
- **Build** - Verify build process
- **Security** - npm audit for vulnerabilities
- **Coverage** - Code coverage analysis
- **Dependencies** - Check outdated packages

### 2. **Pull Request Checks** (`pr-checks.yml`)
**Triggers:**
- ✅ Pull request to `main` branch
- ✅ Pull request to `develop` branch

**Jobs:**
- **Validate** - Check PR title format and merge conflicts
- **Code Quality** - Prettier formatting, complexity analysis
- **Integration Tests** - Full API tests with MongoDB
- **Size Check** - Bundle and repository size analysis

### 3. **Develop Deploy** (`develop-deploy.yml`)
**Triggers:**
- ✅ Push to `develop` branch

**Jobs:**
- **Build and Test** - Complete build with MongoDB
- **Security Scan** - Advanced security checks
- **Notify Success** - Success notifications
- **Notify Failure** - Failure notifications

---

## 🚀 Quick Start

### 1. Enable GitHub Actions

1. Push your code to GitHub
2. Go to your repository
3. Click on **"Actions"** tab
4. GitHub Actions will automatically detect the workflows

### 2. Add Status Badges (Optional)

Add these badges to your `README.md`:

```markdown
![CI Pipeline](https://github.com/YOUR_USERNAME/TrelloBackend/actions/workflows/ci.yml/badge.svg)
![PR Checks](https://github.com/YOUR_USERNAME/TrelloBackend/actions/workflows/pr-checks.yml/badge.svg)
![Develop Deploy](https://github.com/YOUR_USERNAME/TrelloBackend/actions/workflows/develop-deploy.yml/badge.svg)
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## 🔧 Configuration

### Environment Variables

The workflows use these environment variables for testing:

```yaml
NODE_ENV: test
JWT_SECRET: test-secret-key-for-ci
JWT_REFRESH_SECRET: test-refresh-secret-key-for-ci
MONGODB_URI: mongodb://localhost:27017/trello_test
PORT: 3001
```

### Adding Secrets

For production deployments, add secrets in GitHub:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add these secrets:
   - `MONGODB_URI` - Production MongoDB connection string
   - `JWT_SECRET` - Production JWT secret
   - `JWT_REFRESH_SECRET` - Production refresh token secret
   - `GOOGLE_CLIENT_ID` - Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET` - Google OAuth secret
   - `GITHUB_CLIENT_ID` - GitHub OAuth client ID
   - `GITHUB_CLIENT_SECRET` - GitHub OAuth secret

---

## 📊 Workflow Details

### CI Pipeline Jobs

#### 1. Lint
- Runs ESLint (if configured)
- Checks code style
- **Continues on error** (won't fail the build)

#### 2. Test
- Runs `npm test`
- Uses test environment variables
- Requires tests to pass

#### 3. Build
- Runs `npm run build` (if script exists)
- Verifies application can build

#### 4. Security
- Runs `npm audit`
- Checks for known vulnerabilities
- Suggests fixes

#### 5. Coverage
- Runs tests with coverage
- Generates coverage report
- Depends on test job

#### 6. Dependencies
- Lists outdated packages
- Shows dependency tree

### PR Checks Jobs

#### 1. Validate
- Checks PR title format (conventional commits)
- Detects merge conflicts
- Validates PR structure

#### 2. Code Quality
- Runs Prettier formatting check
- Analyzes code complexity
- Reports file sizes

#### 3. Integration Tests
- Starts MongoDB service
- Runs full integration tests
- Tests API endpoints

#### 4. Size Check
- Analyzes repository size
- Checks node_modules size
- Reports largest directories

### Develop Deploy Jobs

#### 1. Build and Test
- Full build with MongoDB
- Runs all tests
- Creates build artifacts
- Archives artifacts for 7 days

#### 2. Security Scan
- Advanced security audit
- Checks for hardcoded secrets
- Scans for API keys in code

#### 3. Notify Success/Failure
- Reports pipeline status
- Provides deployment readiness info

---

## 🎯 Workflow Triggers

### Scenario 1: Push to Develop
```bash
git checkout develop
git add .
git commit -m "feat: add new feature"
git push origin develop
```

**Triggers:**
- ✅ CI Pipeline
- ✅ Develop Deploy

### Scenario 2: Create PR to Main
```bash
git checkout -b feature/new-feature
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
# Create PR on GitHub: feature/new-feature → main
```

**Triggers:**
- ✅ CI Pipeline
- ✅ PR Checks

### Scenario 3: Create PR to Develop
```bash
git checkout -b fix/bug-fix
git add .
git commit -m "fix: resolve bug"
git push origin fix/bug-fix
# Create PR on GitHub: fix/bug-fix → develop
```

**Triggers:**
- ✅ PR Checks

---

## ✅ Success Criteria

All workflows will pass if:
- ✅ Code has no linting errors (if ESLint configured)
- ✅ All tests pass
- ✅ Build completes successfully
- ✅ No critical security vulnerabilities
- ✅ No merge conflicts
- ✅ MongoDB connection works (for integration tests)

---

## 🚨 Troubleshooting

### Workflow Fails on Test Job

**Problem:** Tests fail in CI but pass locally

**Solutions:**
1. Check environment variables are set correctly
2. Ensure MongoDB service is running
3. Verify test scripts in `package.json`
4. Check Node.js version compatibility

### Workflow Fails on Security Audit

**Problem:** npm audit finds vulnerabilities

**Solutions:**
1. Run `npm audit fix` locally
2. Update dependencies: `npm update`
3. Check for breaking changes
4. Add `--force` if needed (carefully)

### Workflow Fails on Build

**Problem:** Build script not found

**Solutions:**
1. Add build script to `package.json` or
2. Remove build job from workflow or
3. Use `--if-present` flag (already configured)

---

## 📝 Adding Tests

To make the most of these workflows, add test scripts to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testPathPattern=integration",
    "lint": "eslint src/**/*.js",
    "lint:fix": "eslint src/**/*.js --fix"
  }
}
```

---

## 🔄 Continuous Improvement

### Recommended Next Steps

1. **Add Unit Tests** - Install Jest and write tests
2. **Configure ESLint** - Add linting rules
3. **Add Prettier** - Code formatting
4. **Code Coverage** - Aim for >80% coverage
5. **Integration Tests** - Test API endpoints
6. **E2E Tests** - Full user flow tests

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Node.js CI/CD Best Practices](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs)
- [MongoDB in GitHub Actions](https://docs.github.com/en/actions/using-containerized-services/creating-mongodb-service-containers)

---

**Your CI/CD pipeline is ready! 🎉**

