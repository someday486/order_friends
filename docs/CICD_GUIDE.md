# CI/CD Pipeline Guide

## Overview

The Order Friends project uses GitHub Actions for Continuous Integration and Continuous Deployment (CI/CD). This guide explains the pipeline, how to use it, and how to configure deployments.

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Workflow Jobs](#workflow-jobs)
3. [Branch Strategy](#branch-strategy)
4. [Deployment Process](#deployment-process)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Scripts](#deployment-scripts)
7. [Rollback Procedures](#rollback-procedures)
8. [Monitoring and Alerts](#monitoring-and-alerts)
9. [Troubleshooting](#troubleshooting)

## Pipeline Overview

The CI/CD pipeline automatically runs on every push and pull request, performing the following tasks:

1. **Automated Testing** - Runs unit tests, E2E tests, and linting
2. **Security Audit** - Checks for vulnerabilities in dependencies
3. **Build Verification** - Ensures the application builds successfully
4. **Docker Image Creation** - Builds and tags Docker images
5. **Automated Deployment** - Deploys to staging/production environments
6. **Health Checks** - Verifies deployment success

### Pipeline Trigger Events

```yaml
on:
  push:
    branches: [main, develop, feature/*]
  pull_request:
    branches: [main, develop]
```

## Workflow Jobs

### 1. Test Job

**Runs on:** All branches and PRs
**Purpose:** Validate code quality and functionality

**Steps:**
- Checkout code
- Setup Node.js (tested on versions 20.x and 22.x)
- Install dependencies (`npm ci`)
- Run linter (`npm run lint`)
- Run unit tests (`npm run test`)
- Run E2E tests (`npm run test:e2e`)
- Generate coverage report
- Upload coverage to Codecov

**Environment Variables Required:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. Security Job

**Runs on:** All branches and PRs
**Purpose:** Check for security vulnerabilities

**Steps:**
- Run `npm audit --production`
- Check for critical/high severity vulnerabilities
- Upload audit report as artifact

**Failure Condition:** Critical vulnerabilities found

### 3. Build Job

**Runs on:** All branches and PRs
**Depends on:** Test job
**Purpose:** Verify application builds successfully

**Steps:**
- Install dependencies
- Build application (`npm run build`)
- Upload build artifacts (retained for 7 days)

### 4. Docker Job

**Runs on:** `main` and `develop` branches only
**Depends on:** Build and Security jobs
**Purpose:** Create Docker images for deployment

**Steps:**
- Setup Docker Buildx
- Login to Docker Hub (if credentials provided)
- Build and push Docker image
- Tag images based on branch and commit SHA

**Required Secrets:**
- `DOCKERHUB_USERNAME` (optional)
- `DOCKERHUB_TOKEN` (optional)

### 5. Deploy Staging Job

**Runs on:** `develop` branch pushes only
**Depends on:** Test, Build, Security, Docker jobs
**Purpose:** Deploy to staging environment

**Steps:**
- Download build artifacts
- Deploy using deployment script
- Run health checks
- Verify deployment

**Environment:** staging
**URL:** https://staging-api.orderfriends.app

### 6. Deploy Production Job

**Runs on:** `main` branch pushes only
**Depends on:** Test, Build, Security, Docker jobs
**Purpose:** Deploy to production environment

**Steps:**
- Download build artifacts
- Run database migrations
- Deploy using deployment script
- Run health checks
- Verify deployment
- Send deployment notifications

**Environment:** production
**URL:** https://api.orderfriends.app

## Branch Strategy

### Branch Workflow

```
feature/* → develop → main
```

1. **Feature Branches** (`feature/*`)
   - Create from `develop`
   - Run tests and build on every push
   - No automatic deployment

2. **Develop Branch**
   - Integration branch for features
   - Automatically deploys to **staging** on push
   - Runs full CI pipeline

3. **Main Branch**
   - Production-ready code only
   - Automatically deploys to **production** on push
   - Requires all checks to pass

### Workflow Example

```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature

# Make changes and commit
git add .
git commit -m "feat: Add new feature"
git push origin feature/my-new-feature

# Create PR to develop
# After PR approval and merge to develop:
# - Staging deployment happens automatically

# When ready for production:
# Create PR from develop to main
# After PR approval and merge to main:
# - Production deployment happens automatically
```

## Deployment Process

### Staging Deployment

**Trigger:** Push to `develop` branch
**Process:**

1. All tests must pass
2. Security audit must pass
3. Build must succeed
4. Docker image is built and tagged
5. Deployment script runs
6. Health checks verify deployment
7. Smoke tests run (if configured)

**Monitoring:**
- Check GitHub Actions logs
- Monitor staging API: https://staging-api.orderfriends.app/health
- Review application logs

### Production Deployment

**Trigger:** Push to `main` branch
**Process:**

1. All tests must pass (100% pass rate required)
2. Security audit must pass
3. Build must succeed
4. Docker image is built and tagged
5. Database migrations run (if any)
6. Deployment script runs
7. Health checks verify deployment
8. Final verification checks
9. Deployment notification sent

**Safety Features:**
- Requires GitHub environment approval
- Health check retries (15 attempts max)
- Automatic rollback on failure
- Database migration safeguards

## Environment Configuration

### GitHub Secrets

Configure these secrets in your GitHub repository settings:

#### Required Secrets

```
SUPABASE_URL              # Supabase project URL
SUPABASE_ANON_KEY         # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY # Supabase service role key
JWT_SECRET                # JWT signing secret
```

#### Optional Secrets

```
DOCKERHUB_USERNAME        # Docker Hub username
DOCKERHUB_TOKEN           # Docker Hub access token
CODECOV_TOKEN             # Codecov upload token
SENTRY_DSN                # Sentry error tracking DSN
SLACK_WEBHOOK_URL         # Slack webhook for notifications
```

### GitHub Environments

Configure two environments in GitHub repository settings:

#### Staging Environment

- **Name:** `staging`
- **URL:** https://staging-api.orderfriends.app
- **Protection Rules:** Optional
- **Secrets:** Same as repository secrets (can override if different)

#### Production Environment

- **Name:** `production`
- **URL:** https://api.orderfriends.app
- **Protection Rules:**
  - Require approval before deployment
  - Restrict to `main` branch only
- **Secrets:** Production-specific values

### Setting up GitHub Environments

1. Go to repository **Settings → Environments**
2. Click **New environment**
3. Enter environment name (`staging` or `production`)
4. Configure protection rules:
   - **Production:** Enable "Required reviewers" (at least 1 reviewer)
   - **Production:** Check "Allow administrators to bypass"
5. Add environment-specific secrets if needed

## Deployment Scripts

### Manual Deployment

You can also deploy manually using the deployment scripts:

#### Deploy to Staging

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
export STAGING_API_URL="https://staging-api.orderfriends.app"

# Run deployment script
./scripts/deployment/deploy-staging.sh
```

#### Deploy to Production

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
export JWT_SECRET="your-jwt-secret"
export SENTRY_DSN="your-sentry-dsn"
export PRODUCTION_API_URL="https://api.orderfriends.app"

# Run deployment script (with confirmation)
./scripts/deployment/deploy-production.sh

# Skip confirmation (CI mode)
SKIP_CONFIRMATION=true ./scripts/deployment/deploy-production.sh
```

### Script Options

All deployment scripts support these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `SKIP_BUILD` | Skip Docker image building | `false` |
| `SKIP_CONFIRMATION` | Skip deployment confirmation | `false` |
| `BACKUP_ENABLED` | Create deployment backup | `true` |
| `MAX_HEALTH_CHECK_ATTEMPTS` | Max health check retries | `10` (staging), `15` (prod) |
| `HEALTH_CHECK_INTERVAL` | Seconds between health checks | `5` |

## Rollback Procedures

### Automatic Rollback

The production deployment script automatically rolls back if:
- Health checks fail
- Critical endpoint verification fails
- Any deployment step errors

### Manual Rollback

If you need to manually rollback a deployment:

```bash
# Rollback staging
./scripts/deployment/rollback.sh staging

# Rollback production
./scripts/deployment/rollback.sh production
```

**Rollback Process:**

1. Confirms rollback action with user
2. Checks for previous deployment image
3. Stops current deployment
4. Restores previous version
5. Runs health checks
6. Verifies critical endpoints
7. Sends notification (if configured)

### Emergency Rollback

If scripts fail, you can manually rollback using Docker:

```bash
# For production
docker-compose -f docker-compose.prod.yml down
docker tag orderfriends/api:previous orderfriends/api:latest
docker-compose -f docker-compose.prod.yml up -d

# For staging
docker-compose -f docker-compose.staging.yml down
docker tag orderfriends/api:staging-previous orderfriends/api:staging
docker-compose -f docker-compose.staging.yml up -d
```

## Monitoring and Alerts

### Health Endpoint

Monitor application health:

```bash
# Staging
curl https://staging-api.orderfriends.app/health

# Production
curl https://api.orderfriends.app/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "info": {
    "supabase": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "supabase": {
      "status": "up"
    }
  }
}
```

### Deployment Notifications

Configure Slack notifications by setting `SLACK_WEBHOOK_URL` secret:

1. Create Slack incoming webhook
2. Add webhook URL to GitHub secrets
3. Notifications will be sent for:
   - Successful production deployments
   - Failed deployments
   - Rollback events

### Sentry Monitoring

Application errors are tracked in Sentry:

1. Set `SENTRY_DSN` environment variable
2. Monitor errors at https://sentry.io
3. Configure alerts for critical errors

## Troubleshooting

### Tests Failing in CI

**Problem:** Tests pass locally but fail in CI

**Solutions:**
1. Check environment variables are set in GitHub secrets
2. Verify Node.js version matches (20.x or 22.x)
3. Check for race conditions in tests
4. Review CI logs for specific error messages

### Security Audit Failures

**Problem:** CI fails due to npm audit

**Solutions:**
1. Run `npm audit` locally to see vulnerabilities
2. Update vulnerable packages: `npm audit fix`
3. For unfixable issues, document in security advisory
4. Consider overriding check for non-critical vulnerabilities

### Docker Build Failures

**Problem:** Docker image build fails

**Solutions:**
1. Test Docker build locally: `docker build -t test .`
2. Check Dockerfile for syntax errors
3. Verify all dependencies are in package.json
4. Check Docker Hub credentials if pushing fails

### Deployment Health Check Failures

**Problem:** Deployment fails health checks

**Solutions:**
1. Check application logs: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Check database connectivity
4. Ensure health endpoint is responding
5. Increase `MAX_HEALTH_CHECK_ATTEMPTS` if needed

### Environment Variable Issues

**Problem:** Application fails due to missing env vars

**Solutions:**
1. Verify all required secrets are set in GitHub
2. Check environment-specific overrides
3. Ensure `.env.example` is up to date
4. Review deployment script logs

## Best Practices

### Before Merging to Develop

- [ ] All tests pass locally
- [ ] Linter passes (`npm run lint`)
- [ ] Code reviewed by team member
- [ ] Feature tested locally
- [ ] Documentation updated if needed

### Before Merging to Main

- [ ] Tested thoroughly in staging
- [ ] All CI checks pass on develop branch
- [ ] Database migrations tested
- [ ] Performance impact assessed
- [ ] Rollback plan prepared
- [ ] Team notified of deployment

### After Deployment

- [ ] Monitor health endpoint
- [ ] Check Sentry for errors
- [ ] Review application logs
- [ ] Verify critical user flows
- [ ] Monitor performance metrics

## Pipeline Metrics

### Current Performance

| Metric | Target | Current |
|--------|--------|---------|
| Test Pass Rate | 100% | ✅ 100% (76/76 tests) |
| Build Success Rate | >95% | TBD |
| Deployment Success Rate | >99% | TBD |
| Average Pipeline Duration | <10 min | TBD |
| Security Vulnerabilities | 0 critical | ✅ 0 |

### Monitoring Recommendations

1. **Track pipeline duration** - Optimize slow steps
2. **Monitor failure rates** - Investigate recurring failures
3. **Review security audits** - Keep dependencies updated
4. **Analyze deployment frequency** - Aim for frequent, small deployments

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [NestJS Deployment Guide](https://docs.nestjs.com/deployment)
- [Supabase Documentation](https://supabase.com/docs)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-06
**Maintained by:** DevOps Team
