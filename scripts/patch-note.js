const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();
const patchNotesDir = path.join(repoRoot, 'docs', 'patch-notes');
const templatePath = path.join(patchNotesDir, 'TEMPLATE.md');
const patchNoteEntryPattern = /^docs\/patch-notes\/\d{4}-\d{2}-\d{2}\.md$/;
const relevantPathPatterns = [
  /^apps\/web\//,
  /^src\//,
  /^supabase\/migrations\//,
  /^package\.json$/,
  /^apps\/web\/package\.json$/,
  /^apps\/web\/package-lock\.json$/,
  /^README\.md$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^\.github\/workflows\/ci\.yml$/,
];

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').trim();
}

function runGit(command) {
  return execSync(command, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function getSeoulDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

function getTodayPatchNoteRelativePath() {
  return `docs/patch-notes/${getSeoulDateString()}.md`;
}

function getTodayPatchNoteAbsolutePath() {
  return path.join(repoRoot, getTodayPatchNoteRelativePath());
}

function getDefaultTemplate() {
  return [
    '# YYYY-MM-DD 패치노트',
    '',
    '## 신규 기능',
    '- ',
    '',
    '## 개선 사항',
    '- ',
    '',
    '## 버그 수정',
    '- ',
    '',
    '## 운영 메모',
    '- 지원이나 배포 대응에 꼭 필요한 경우에만 작성합니다.',
    '',
  ].join('\n');
}

function readTemplate() {
  if (!fs.existsSync(templatePath)) {
    return getDefaultTemplate();
  }

  return fs.readFileSync(templatePath, 'utf8');
}

function buildTodayTemplate() {
  return readTemplate().replace(/^#\s+YYYY-MM-DD/m, `# ${getSeoulDateString()}`);
}

function ensureTodayPatchNote() {
  const relativePath = getTodayPatchNoteRelativePath();
  const absolutePath = getTodayPatchNoteAbsolutePath();
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

  if (!fs.existsSync(absolutePath)) {
    fs.writeFileSync(absolutePath, buildTodayTemplate(), 'utf8');
    return { created: true, relativePath, absolutePath };
  }

  return { created: false, relativePath, absolutePath };
}

function getChangedFiles(command) {
  try {
    const output = runGit(command);
    if (!output) {
      return [];
    }

    return output
      .split(/\r?\n/)
      .map(normalizePath)
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function isRelevantPath(filePath) {
  if (!filePath || patchNoteEntryPattern.test(filePath)) {
    return false;
  }

  if (filePath === 'docs/patch-notes/README.md' || filePath === 'docs/patch-notes/TEMPLATE.md') {
    return false;
  }

  return relevantPathPatterns.some((pattern) => pattern.test(filePath));
}

function hasRelevantChanges(files) {
  return files.some(isRelevantPath);
}

function hasPatchNoteEntry(files) {
  return files.some((filePath) => patchNoteEntryPattern.test(filePath));
}

function getCommitSubject(messageFilePath) {
  const message = fs.readFileSync(messageFilePath, 'utf8');
  const lines = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  return lines[0] || '';
}

function parseCommitSubject(subject) {
  const match = subject.match(/^([a-zA-Z]+)(\([^)]+\))?!?:\s*(.+)$/);
  if (!match) {
    return {
      type: 'other',
      summary: subject.trim(),
    };
  }

  return {
    type: match[1].toLowerCase(),
    summary: match[3].trim(),
  };
}

function getSectionTitle(type) {
  if (type === 'feat') {
    return '## 신규 기능';
  }

  if (type === 'fix') {
    return '## 버그 수정';
  }

  return '## 개선 사항';
}

function insertBulletIntoSection(fileContents, sectionTitle, bullet) {
  const lines = fileContents.split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) => line.trim() === sectionTitle);

  if (sectionIndex === -1) {
    const suffix = fileContents.endsWith('\n') ? '' : '\n';
    return `${fileContents}${suffix}\n${sectionTitle}\n${bullet}\n`;
  }

  let nextSectionIndex = lines.length;
  for (let index = sectionIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      nextSectionIndex = index;
      break;
    }
  }

  const existingSectionLines = lines.slice(sectionIndex + 1, nextSectionIndex).map((line) => line.trim());
  if (existingSectionLines.includes(bullet)) {
    return fileContents;
  }

  let insertIndex = nextSectionIndex;
  for (let index = sectionIndex + 1; index < nextSectionIndex; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed === '- ') {
      lines.splice(index, 1);
      insertIndex -= 1;
      break;
    }
  }

  lines.splice(insertIndex, 0, bullet);
  return `${lines.join('\n')}\n`;
}

function appendFromCommitMessage(messageFilePath) {
  const stagedFiles = getChangedFiles('git diff --cached --name-only --diff-filter=ACMR');
  if (!hasRelevantChanges(stagedFiles)) {
    console.log('Patch note append skipped: no relevant staged changes.');
    return;
  }

  const subject = getCommitSubject(messageFilePath);
  if (!subject || subject.startsWith('Merge ') || subject.startsWith('Revert ')) {
    console.log('Patch note append skipped: commit subject is not suitable for an automatic draft.');
    return;
  }

  const { type, summary } = parseCommitSubject(subject);
  if (!summary) {
    console.log('Patch note append skipped: empty commit summary.');
    return;
  }

  const { relativePath, absolutePath } = ensureTodayPatchNote();
  const sectionTitle = getSectionTitle(type);
  const bullet = `- ${summary}`;
  const originalContents = fs.readFileSync(absolutePath, 'utf8');
  const updatedContents = insertBulletIntoSection(originalContents, sectionTitle, bullet);

  if (updatedContents === originalContents) {
    console.log(`Patch note draft already includes: ${bullet}`);
    return;
  }

  fs.writeFileSync(absolutePath, updatedContents, 'utf8');
  runGit(`git add -- "${relativePath}"`);
  console.log(`Patch note draft appended to ${relativePath}: ${bullet}`);
}

function resolveBaseSha(baseSha, headSha) {
  if (!baseSha || /^0+$/.test(baseSha)) {
    try {
      return runGit(`git rev-parse ${headSha}^`);
    } catch (error) {
      return headSha;
    }
  }

  return baseSha;
}

function verifyRange(baseSha, headSha) {
  const resolvedBaseSha = resolveBaseSha(baseSha, headSha);
  const changedFiles = getChangedFiles(`git diff --name-only ${resolvedBaseSha}...${headSha}`);

  if (!hasRelevantChanges(changedFiles)) {
    console.log('Patch note check passed: no relevant changes detected.');
    return;
  }

  if (hasPatchNoteEntry(changedFiles)) {
    console.log('Patch note check passed: dated patch note entry detected.');
    return;
  }

  console.error('Patch note check failed.');
  console.error('Relevant product or workflow changes were detected, but no dated patch note was updated.');
  console.error('Please update docs/patch-notes/YYYY-MM-DD.md before pushing or opening the PR.');
  process.exit(1);
}

function verifyUpstream() {
  let upstreamRef = '';
  try {
    upstreamRef = runGit('git rev-parse --abbrev-ref --symbolic-full-name @{upstream}');
  } catch (error) {
    upstreamRef = '';
  }

  if (upstreamRef) {
    verifyRange(upstreamRef, 'HEAD');
    return;
  }

  let previousCommit = '';
  try {
    previousCommit = runGit('git rev-parse HEAD^');
  } catch (error) {
    previousCommit = '';
  }

  if (!previousCommit) {
    console.log('Patch note check skipped: no upstream or previous commit available.');
    return;
  }

  verifyRange(previousCommit, 'HEAD');
}

function main() {
  const [, , command, firstArg, secondArg] = process.argv;

  if (command === 'ensure-today') {
    const result = ensureTodayPatchNote();
    console.log(
      result.created
        ? `Created today's patch note: ${result.relativePath}`
        : `Today's patch note already exists: ${result.relativePath}`,
    );
    return;
  }

  if (command === 'append-from-commit') {
    if (!firstArg) {
      console.error('append-from-commit requires a commit message file path.');
      process.exit(1);
    }

    appendFromCommitMessage(firstArg);
    return;
  }

  if (command === 'verify-range') {
    if (!firstArg || !secondArg) {
      console.error('verify-range requires base and head revisions.');
      process.exit(1);
    }

    verifyRange(firstArg, secondArg);
    return;
  }

  if (command === 'verify-upstream') {
    verifyUpstream();
    return;
  }

  console.error('Unknown patch-note command.');
  process.exit(1);
}

main();
