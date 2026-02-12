#!/bin/bash

# Deploy to Staging Environment
# This script deploys the application to the staging environment

set -e  # Exit on any error

echo "========================================="
echo "Deploying to Staging Environment"
echo "========================================="

# Configuration
ENVIRONMENT="staging"
DOCKER_IMAGE="orderfriends/api:staging"
HEALTH_CHECK_URL="${STAGING_API_URL:-https://staging-api.orderfriends.app}/health"
MAX_HEALTH_CHECK_ATTEMPTS=10
HEALTH_CHECK_INTERVAL=5

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

# Step 1: Pre-deployment checks
print_status "Running pre-deployment checks..."

if [ -z "$SUPABASE_URL" ]; then
    print_error "SUPABASE_URL environment variable is not set"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    print_error "SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
    exit 1
fi

print_status "Pre-deployment checks passed ✓"

# Step 2: Build Docker image (if not already built by CI)
if [ "$SKIP_BUILD" != "true" ]; then
    print_status "Building Docker image..."
    docker build -t $DOCKER_IMAGE .
    print_status "Docker image built successfully ✓"
else
    print_status "Skipping build (SKIP_BUILD=true)"
fi

# Step 3: Stop existing container (if exists)
print_status "Stopping existing container..."
docker-compose -f docker-compose.staging.yml down || true
print_status "Existing container stopped ✓"

# Step 4: Start new container
print_status "Starting new container..."
docker-compose -f docker-compose.staging.yml up -d
print_status "Container started ✓"

# Step 5: Wait for application to be ready
print_status "Waiting for application to be ready..."
sleep 10

# Step 6: Health check
print_status "Running health checks..."
ATTEMPT=1
HEALTHY=false

while [ $ATTEMPT -le $MAX_HEALTH_CHECK_ATTEMPTS ]; do
    print_status "Health check attempt $ATTEMPT/$MAX_HEALTH_CHECK_ATTEMPTS..."

    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
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
    print_error "Rolling back deployment..."
    docker-compose -f docker-compose.staging.yml down
    exit 1
fi

# Step 7: Run smoke tests
print_status "Running smoke tests..."
API_BASE="${STAGING_API_URL:-https://staging-api.orderfriends.app}"
curl -f -s "$API_BASE/health" > /dev/null || { print_error "Smoke test failed: /health"; exit 1; }
curl -f -s "$API_BASE/api-docs" > /dev/null || { print_error "Smoke test failed: /api-docs"; exit 1; }
print_status "Smoke tests passed ✓"

# Step 8: Deployment summary
echo ""
echo "========================================="
echo -e "${GREEN}Deployment to Staging Successful!${NC}"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Docker Image: $DOCKER_IMAGE"
echo "Health Check: $HEALTH_CHECK_URL"
echo "Deployed at: $(date +'%Y-%m-%d %H:%M:%S')"
echo ""
echo "Next steps:"
echo "1. Verify the deployment: curl $HEALTH_CHECK_URL"
echo "2. Check logs: docker-compose -f docker-compose.staging.yml logs -f"
echo "3. Monitor application performance"
echo "========================================="
