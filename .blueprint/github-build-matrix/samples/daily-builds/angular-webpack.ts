import type { GitHubMatrixGroup } from '../../../../lib/testing/github-matrix.ts';
import { extendFilteredMatrix, fromMatrix } from '../../../../lib/testing/support/matrix-utils.ts';
import { convertOptionsToJDL } from '../../support/jdl.ts';

export default Object.fromEntries(
  [
    ...Object.entries(
      extendFilteredMatrix(
        fromMatrix({
          applicationType: ['monolith', 'gateway'],
          buildTool: ['maven', 'gradle'],
          reactive: [false, true],
        }),
        data => !data.reactive,
        {
          websocket: [undefined, 'spring-websocket'],
        },
      ),
    ),
  ].map(([key, value]) => [
    key,
    {
      jdl: convertOptionsToJDL(value),
    },
  ]),
) satisfies GitHubMatrixGroup;
