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
      args: `jdl${value.applicationType === 'gateway' && !value.reactive ? ' --experimental' : ''}`,
      'cmd-frontend': './npmw run ci:frontend:test',
      'cmd-backend': './npmw run ci:backend:test',
      'cmd-e2e-1': './npmw run e2e:devserver',
      'cmd-e2e-2': './npmw run ci:e2e:package && npm run ci:e2e:prepare && npm run ci:e2e:run',
      jdl: convertOptionsToJDL(value),
    },
  ]),
) satisfies GitHubMatrixGroup;
