#!/bin/bash

# Deploy to Production Environment
# This script deploys the application to the production environment
# IMPORTANT: This should only be run after thorough testing in staging

set -e  # Exit on any error

echo "========================================="
echo "Deploying to Production Environment"
echo "========================================="

# Configuration
ENVIRONMENT="production"
DOCKER_IMAGE="orderfriends/api:latest"
HEALTH_CHECK_URL="${PRODUCTION_API_URL:-https://api.orderfriends.app}/health"
MAX_HEALTH_CHECK_ATTEMPTS=15
HEALTH_CHECK_INTERVAL=5
BACKUP_ENABLED="${BACKUP_ENABLED:-true}"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to rollback deployment
rollback() {
    print_error "Deployment failed! Rolling back..."
    docker-compose -f docker-compose.prod.yml down

    if docker image inspect orderfriends/api:previous > /dev/null 2>&1; then
        print_status "Restoring previous deployment..."
        docker tag orderfriends/api:previous orderfriends/api:latest
        docker-compose -f docker-compose.prod.yml up -d
        print_status "Rolled back to previous version"
    else
        print_error "No previous image available for rollback"
    fi

    exit 1
}

# Trap errors and rollback
trap rollback ERR

# Step 1: Pre-deployment validation
print_status "Running pre-deployment validation..."

# Confirm production deployment
if [ "$SKIP_CONFIRMATION" != "true" ]; then
    print_warning "You are about to deploy to PRODUCTION!"
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        print_error "Deployment cancelled by user"
        exit 1
    fi
fi

# Check required environment variables
if [ -z "$SUPABASE_URL" ]; then
    print_error "SUPABASE_URL environment variable is not set"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    print_error "SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    print_error "JWT_SECRET environment variable is not set"
    exit 1
fi

if [ -z "$SENTRY_DSN" ]; then
    print_warning "SENTRY_DSN is not set - error monitoring will be disabled"
fi

print_status "Pre-deployment validation passed ✓"

# Step 2: Create backup
if [ "$BACKUP_ENABLED" = "true" ]; then
    print_status "Creating deployment backup..."
    echo "$(date +'%Y-%m-%d %H:%M:%S')" > .deployment.backup
    # Tag current image as 'previous' for rollback
    if docker image inspect orderfriends/api:latest > /dev/null 2>&1; then
        docker tag orderfriends/api:latest orderfriends/api:previous
        print_status "Current image tagged as 'previous' for rollback"
    fi
    # Backup environment config
    cp .env ".env.backup.$(date +'%Y%m%d_%H%M%S')" 2>/dev/null || true
    print_status "Backup created ✓"
fi

# Step 3: Run database migrations (if any)
print_status "Checking for database migrations..."
if command -v supabase &> /dev/null; then
    supabase db push --linked || { print_error "Migration failed"; exit 1; }
    print_status "Database migrations completed ✓"
else
    print_warning "Supabase CLI not found - skipping migrations (run manually if needed)"
fi

# Step 4: Build Docker image (if not already built by CI)
if [ "$SKIP_BUILD" != "true" ]; then
    print_status "Building Docker image..."
    docker build -t $DOCKER_IMAGE .
    print_status "Docker image built successfully ✓"
else
    print_status "Skipping build (SKIP_BUILD=true)"
fi

# Step 5: Stop existing container gracefully
print_status "Stopping existing container gracefully..."
docker-compose -f docker-compose.prod.yml down --timeout 30 || true
print_status "Existing container stopped ✓"

# Step 6: Start new container
print_status "Starting new container..."
docker-compose -f docker-compose.prod.yml up -d
print_status "Container started ✓"

# Step 7: Wait for application to be ready
print_status "Waiting for application to stabilize..."
sleep 15

# Step 8: Health check
print_status "Running health checks..."
ATTEMPT=1
HEALTHY=false

while [ $ATTEMPT -le $MAX_HEALTH_CHECK_ATTEMPTS ]; do
    print_status "Health check attempt $ATTEMPT/$MAX_HEALTH_CHECK_ATTEMPTS..."

    HEALTH_RESPONSE=$(curl -f -s "$HEALTH_CHECK_URL" || echo "failed")

    if [ "$HEALTH_RESPONSE" != "failed" ]; then
        print_status "Health check response: $HEALTH_RESPONSE"
        HEALTHY=true
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -le $MAX_HEALTH_CHECK_ATTEMPTS ]; then
        sleep $HEALTH_CHECK_INTERVAL
    fi
done

if [ "$HEALTHY" = true ]; then
    print_status "Health check passed ✓"
else
    print_error "Health check failed after $MAX_HEALTH_CHECK_ATTEMPTS attempts"
    rollback
fi

# Step 9: Run smoke tests
print_status "Running smoke tests..."
API_BASE="${PRODUCTION_API_URL:-https://api.orderfriends.app}"
curl -f -s "$API_BASE/health" > /dev/null || { print_error "Smoke test failed: /health"; rollback; }
curl -f -s "$API_BASE/api-docs" > /dev/null || { print_error "Smoke test failed: /api-docs"; rollback; }
print_status "Smoke tests passed ✓"

# Step 10: Verify critical endpoints
print_status "Verifying critical endpoints..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/brands")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
    print_status "Endpoint /brands responding ($STATUS) ✓"
else
    print_error "Endpoint /brands returned unexpected status: $STATUS"
    rollback
fi
print_status "Critical endpoints verified ✓"

# Step 11: Monitor initial traffic
print_status "Monitoring initial traffic for 30 seconds..."
sleep 30

# Final health check
if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
    print_status "Final health check passed ✓"
else
    print_error "Final health check failed"
    rollback
fi

# Step 12: Deployment summary
echo ""
echo "========================================="
echo -e "${GREEN}✓ Production Deployment Successful!${NC}"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Docker Image: $DOCKER_IMAGE"
echo "Health Check: $HEALTH_CHECK_URL"
echo "Deployed at: $(date +'%Y-%m-%d %H:%M:%S')"
echo ""
echo "Next steps:"
echo "1. Monitor logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "2. Check Sentry for errors: https://sentry.io"
echo "3. Monitor application metrics"
echo "4. Verify user functionality"
echo "========================================="

# Step 13: Send deployment notification (optional)
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    print_info "Sending deployment notification..."
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"✅ Production deployment successful! Environment: $ENVIRONMENT, Time: $(date +'%Y-%m-%d %H:%M:%S')\"}" \
        || print_warning "Failed to send Slack notification"
fi

# Cleanup
rm -f .deployment.backup

print_status "Deployment process completed successfully!"
