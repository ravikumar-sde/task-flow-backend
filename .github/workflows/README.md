# GitHub Actions Workflows

## 🎯 Purpose

Automated CI/CD pipelines for the Trello Backend project.

## 📋 Workflows

| Workflow | File | Triggers | Purpose |
|----------|------|----------|---------|
| **CI Pipeline** | `ci.yml` | Push to `develop`, PR to `main` | Lint, test, build, security |
| **PR Checks** | `pr-checks.yml` | PR to `main` or `develop` | Validation, quality, integration tests |
| **Develop Deploy** | `develop-deploy.yml` | Push to `develop` | Build, security scan, deploy prep |

## 🚀 Quick Reference

### When workflows run:

```
Push to develop
├── ✅ CI Pipeline
└── ✅ Develop Deploy

PR to main
├── ✅ CI Pipeline
└── ✅ PR Checks

PR to develop
└── ✅ PR Checks
```

## 📊 Status Badges

Add to your main README.md:

```markdown
![CI](https://github.com/YOUR_USERNAME/TrelloBackend/actions/workflows/ci.yml/badge.svg)
![PR Checks](https://github.com/YOUR_USERNAME/TrelloBackend/actions/workflows/pr-checks.yml/badge.svg)
```

## 🔧 Configuration

See [GITHUB_ACTIONS_GUIDE.md](./GITHUB_ACTIONS_GUIDE.md) for detailed configuration.

## ✅ What Gets Checked

- ✅ Code linting (ESLint)
- ✅ Unit tests
- ✅ Integration tests with MongoDB
- ✅ Security vulnerabilities (npm audit)
- ✅ Code formatting (Prettier)
- ✅ Build process
- ✅ Dependency health
- ✅ PR title format
- ✅ Merge conflicts
- ✅ Bundle size

## 🚨 Common Issues

**Tests fail in CI but pass locally?**
- Check environment variables
- Verify MongoDB connection
- Check Node.js version (workflows use v18)

**Security audit fails?**
- Run `npm audit fix` locally
- Update dependencies
- Check for breaking changes

**Build fails?**
- Ensure all dependencies are in package.json
- Check for missing environment variables
- Verify build script exists

## 📚 Learn More

- [GitHub Actions Guide](./GITHUB_ACTIONS_GUIDE.md) - Complete documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)

