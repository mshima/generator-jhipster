import { readFileSync, writeFileSync } from 'fs';
import { applyPatch, structuredPatch } from 'diff';

const splitHunk = ({ lines, ...hunk }, contextSize) => {
  let contextLines = [];
  // let nextHunkContextLines = [];
  let hunkLines = [];
  const hunks = [];
  for (const line of lines) {
    if (line.startsWith(' ')) {
      contextLines.push(line);
      if (contextLines.length >= contextSize && hunkLines.length > 0) {
        hunks.push({ lines: [...hunkLines, ...contextLines], ...hunk });
        hunkLines = [];
      }
    } else {
      hunkLines.push(...contextLines);
      hunkLines.push(line);
      contextLines = [];
    }
  }
  if (hunkLines.length > 0) {
    hunks.push({ lines: [...contextLines, ...hunkLines], ...hunk });
  }
  return hunks;
};

export default function ({ templateFile, fileContents, modifiedContents, contextSize = 2, fuzzFactor = 0 }) {
  const patch = structuredPatch(templateFile, templateFile, fileContents, modifiedContents, undefined, undefined, {
    context: contextSize,
    newlineIsToken: false,
    // ignoreWhitespace: true,
    // oneChangePerToken: true,
    // maxEditLength: 3,
  });
  patch.hunks = patch.hunks
    .map(({ lines, ...remainning }) => ({
      ...remainning,
      lines: lines
        .map(line => (line === '-' ? ' ' : line.replace('-import', ' import').replace('+import', ' import')))
        .filter(line => line !== '+'),
    }))
    .filter(({ lines }) => lines.some(line => line.startsWith('+') || line.startsWith('-')));

  // apply hunk by hunk, since if a hunk fails, the rest of the file will be skipped
  const content = readFileSync(templateFile, 'utf8').toString();
  let applied = content;
  let failures = 0;
  let success = 0;
  for (const hunk of patch.hunks.map(hunk => splitHunk(hunk, contextSize)).flat()) {
    const result = applyPatch(
      applied,
      { ...patch, hunks: [hunk] },
      {
        fuzzFactor,
        /*
        compareLine: (lineNumber, line, operation, patchContent) => {
          line = line?.replace(/<%[_]? (?:}|} else {|if \((?:.*)\) {|} else if \((?:.*)\) {) [_]?%>/, '')?.trim();
          console.log(operation, line);
          return line === patchContent?.trim();
        },
        */
      },
    );
    if (result) {
      applied = result;
      success++;
    } else {
      failures++;
    }
  }

  if (content !== applied) {
    writeFileSync(templateFile, applied);
  }

  return { success, failures };
}
