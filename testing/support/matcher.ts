import type { RunResult } from 'yeoman-test';

declare global {
  const it: (title: string, fn: () => void) => void;
}

/**
 * Requires a global `it` function to be available.
 */
export const matchWrittenFiles = (
  title: string,
  resultGetter: () => RunResult,
  expectedFilesGetter: () => string[],
  shouldMatch: boolean,
) => {
  const testTitle = shouldMatch ? `writes ${title} files` : `doesn't write ${title} files`;
  it(testTitle, () => {
    const expectedFiles = expectedFilesGetter();
    if (shouldMatch) {
      resultGetter().assertFile(expectedFiles);
    } else {
      resultGetter().assertNoFile(expectedFiles);
    }
  });
};

/**
 * Requires a global `it` function to be available.
 */
export const matchWrittenConfig = (title: string, resultGetter: () => RunResult, config: any, shouldMatch: boolean) => {
  const testTitle = shouldMatch ? `writes ${title} config` : `doesn't write ${title} config`;
  it(testTitle, () => {
    if (shouldMatch) {
      resultGetter().assertJsonFileContent('.yo-rc.json', config);
    } else {
      resultGetter().assertNoJsonFileContent('.yo-rc.json', config);
    }
  });
};
