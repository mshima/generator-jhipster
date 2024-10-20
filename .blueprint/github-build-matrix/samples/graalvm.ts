import { extendMatrix, fromMatrix } from '../../../lib/testing/index.js';
import { convertOptionsToJDL } from '../support/jdl.js';

export const graalvmMatrix = Object.fromEntries(
  [
    ...Object.entries(
      extendMatrix(
        fromMatrix({
          buildTool: ['maven', 'gradle'],
          reactive: [undefined, true],
        }),
        { devDatabaseType: ['h2Disk'], nativeSupport: [true], cacheProvider: ['no'] },
      ),
    ),
  ].map(([key, value]) => [key, { os: 'macos-15', jdl: convertOptionsToJDL(value) }]),
);
