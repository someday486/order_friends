const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

const rootEntries = fs.readdirSync(repoRoot, { withFileTypes: true });
const forbiddenRootDocPattern =
  /(_SUMMARY|_SUMMARIES|_FIXES|_TASK|_TASKS|_ROADMAP|_ROADMAPS|_IMPROVEMENTS|_PROGRESS)\.md$/i;
const rootMarkdownViolations = rootEntries
  .filter((entry) => entry.isFile() && forbiddenRootDocPattern.test(entry.name))
  .map((entry) => entry.name);

const docsRoot = path.join(repoRoot, 'docs');
const allowedDocsRootFiles = new Set([
  'README.md',
  'DOCUMENT_REGISTRY.md',
  'ENGINEERING_WORKFLOW.md',
]);

const docsRootViolations = fs
  .readdirSync(docsRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !allowedDocsRootFiles.has(entry.name))
  .map((entry) => entry.name);

const requiredPaths = [
  'AGENTS.md',
  'docs/README.md',
  'docs/DOCUMENT_REGISTRY.md',
  'docs/ENGINEERING_WORKFLOW.md',
  'docs/patch-notes/TEMPLATE.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
];

const missingRequiredPaths = requiredPaths.filter((relativePath) => !fs.existsSync(path.join(repoRoot, relativePath)));

const errors = [];

if (rootMarkdownViolations.length > 0) {
  errors.push(
    `Forbidden root markdown files found: ${rootMarkdownViolations.join(', ')}. Move temporary notes into docs/archive/ or delete them.`,
  );
}

if (docsRootViolations.length > 0) {
  errors.push(
    `Unexpected markdown files directly under docs/: ${docsRootViolations.join(', ')}. Move them into the correct docs subfolder.`,
  );
}

if (missingRequiredPaths.length > 0) {
  errors.push(`Required workflow files are missing: ${missingRequiredPaths.join(', ')}`);
}

if (errors.length > 0) {
  console.error('Documentation governance check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Documentation governance check passed.');
