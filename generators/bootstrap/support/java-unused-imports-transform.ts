import { extname } from 'path';
import { passthrough } from 'p-transform';
import { isFileStateModified } from 'mem-fs-editor/state';
import { VinylMemFsEditorFile } from 'mem-fs-editor';
import Tinypool from 'tinypool';
import CoreGenerator from '../../base-core/index.js';

// eslint-disable-next-line import/prefer-default-export
export const createRemoveUnusedImportsTransform = function (
  this: CoreGenerator,
  options: {
    ignoreErrors?: boolean;
  } = {},
) {
  const { ignoreErrors } = options;

  const pool = new Tinypool({
    runtime: 'child_process',
    maxThreads: 1,
    filename: new URL('./java-lint-worker.js', import.meta.url).href,
  });

  return passthrough(
    async (file: VinylMemFsEditorFile) => {
      if (extname(file.path) === '.java' && isFileStateModified(file)) {
        if (file.contents) {
          const fileContents = file.contents.toString('utf8');
          const { result, error } = await pool.run({
            fileContents,
            fileRelativePath: file.relative,
          });
          if (result) {
            file.contents = Buffer.from(result);
          }
          if (error) {
            const errorMessage = `Error parsing file ${file.relative}: ${error} at ${fileContents}`;
            if (ignoreErrors) {
              this?.log?.warn?.(errorMessage);
              return;
            }

            throw new Error(errorMessage);
          }
        }
      }
    },
    () => {
      pool.destroy();
    },
  );
};
