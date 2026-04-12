const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
const canonicalPaymentTriggerMigration =
  '20260412173000_consolidate_order_payment_status_trigger.sql';

const files = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const timestampPattern = /^\d{8}(?:\d{6})?_.+\.sql$/;
const errors = [];

for (const file of files) {
  if (!timestampPattern.test(file)) {
    errors.push(
      `Migration filename must start with an 8-digit or 14-digit timestamp: ${file}`,
    );
  }
}

const paymentTriggerMigrations = files.filter((file) => {
  const fullPath = path.join(migrationsDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  return content.includes('update_order_payment_status(');
});

if (
  paymentTriggerMigrations.length > 0 &&
  paymentTriggerMigrations[paymentTriggerMigrations.length - 1] !==
    canonicalPaymentTriggerMigration
) {
  errors.push(
    `The latest migration touching update_order_payment_status() must be ${canonicalPaymentTriggerMigration}. Found ${paymentTriggerMigrations[paymentTriggerMigrations.length - 1]}.`,
  );
}

if (!files.includes(canonicalPaymentTriggerMigration)) {
  errors.push(
    `Required canonical payment trigger migration is missing: ${canonicalPaymentTriggerMigration}`,
  );
}

if (errors.length > 0) {
  console.error('Migration governance check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Migration governance check passed.');
