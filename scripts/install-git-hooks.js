const { execSync } = require('child_process');

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

try {
  run('git rev-parse --is-inside-work-tree');
  execSync('git config core.hooksPath .githooks', {
    stdio: 'inherit',
  });
  console.log('Configured git hooks path: .githooks');
} catch (error) {
  console.log('Skipped git hook installation: git repository not available.');
}
