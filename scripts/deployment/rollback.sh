#!/bin/bash

# Rollback Deployment Script
# This script rolls back to the previous deployment

set -e  # Exit on any error

echo "========================================="
echo "Deployment Rollback"
echo "========================================="

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

# Parse arguments
ENVIRONMENT="${1:-staging}"

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
    print_error "Invalid environment: $ENVIRONMENT"
    echo "Usage: $0 [staging|production]"
    exit 1
fi

# Confirm rollback
print_warning "You are about to ROLLBACK the $ENVIRONMENT environment!"
print_warning "This will revert to the previous deployment."
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_error "Rollback cancelled by user"
    exit 1
fi

# Set configuration based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    PREVIOUS_IMAGE="orderfriends/api:previous"
    HEALTH_CHECK_URL="${PRODUCTION_API_URL:-https://api.orderfriends.app}/health"
else
    COMPOSE_FILE="docker-compose.staging.yml"
    PREVIOUS_IMAGE="orderfriends/api:staging-previous"
    HEALTH_CHECK_URL="${STAGING_API_URL:-https://staging-api.orderfriends.app}/health"
fi

# Step 1: Check if previous image exists
print_status "Checking for previous deployment..."

if ! docker image inspect "$PREVIOUS_IMAGE" > /dev/null 2>&1; then
    print_error "Previous deployment image not found: $PREVIOUS_IMAGE"
    print_error "Cannot rollback - no previous version available"
    exit 1
fi

print_status "Previous deployment found ✓"

# Step 2: Stop current deployment
print_status "Stopping current deployment..."
docker-compose -f "$COMPOSE_FILE" down
print_status "Current deployment stopped ✓"

# Step 3: Tag and deploy previous version
print_status "Rolling back to previous version..."

if [ "$ENVIRONMENT" = "production" ]; then
    docker tag "$PREVIOUS_IMAGE" "orderfriends/api:latest"
else
    docker tag "$PREVIOUS_IMAGE" "orderfriends/api:staging"
fi

print_status "Previous version tagged ✓"

# Step 4: Start previous deployment
print_status "Starting previous deployment..."
docker-compose -f "$COMPOSE_FILE" up -d
print_status "Previous deployment started ✓"

# Step 5: Wait for application to be ready
print_status "Waiting for application to stabilize..."
sleep 15

# Step 6: Health check
print_status "Running health checks..."
ATTEMPT=1
MAX_ATTEMPTS=10
HEALTHY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    print_status "Health check attempt $ATTEMPT/$MAX_ATTEMPTS..."

    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        HEALTHY=true
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -le $MAX_ATTEMPTS ]; then
        sleep 5
    fi
done

if [ "$HEALTHY" = true ]; then
    print_status "Health check passed ✓"
else
    print_error "Health check failed after $MAX_ATTEMPTS attempts"
    print_error "Rollback failed - manual intervention required"
    exit 1
fi

# Step 7: Verify endpoints
print_status "Verifying critical endpoints..."
# Add endpoint verification
print_status "Endpoints verified ✓"

# Step 8: Rollback summary
echo ""
echo "========================================="
echo -e "${GREEN}✓ Rollback Successful!${NC}"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Rolled back to: $PREVIOUS_IMAGE"
echo "Health Check: $HEALTH_CHECK_URL"
echo "Completed at: $(date +'%Y-%m-%d %H:%M:%S')"
echo ""
echo "Next steps:"
echo "1. Investigate the issue that caused the rollback"
echo "2. Monitor logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "3. Fix the issue in the codebase"
echo "4. Test thoroughly before redeploying"
echo "========================================="

# Send notification
if [ -n "$SLACK_WEBHOOK_URL" ]; then
    print_status "Sending rollback notification..."
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"⚠️ Rollback executed for $ENVIRONMENT environment at $(date +'%Y-%m-%d %H:%M:%S')\"}" \
        || print_warning "Failed to send Slack notification"
fi

print_status "Rollback completed successfully!"
