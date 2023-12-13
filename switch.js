import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const replacements = [
  { esmocha: 'esmocha.fn', vitest: 'vitest.fn' },
  { esmocha: "from 'esmocha';", vitest: "from 'vitest';" },
];

const imports = [
  { esmocha: 'after', vitest: 'afterAll as after' },
  { esmocha: 'before', vitest: 'beforeAll as before' },
  { esmocha: 'esmocha', vitest: 'vitest' },
];

const source = 'esmocha';
const dest = 'vitest';

const files = globSync('**/*.spec.{,m}{j,t}s');
for (const file of files) {
  const data = readFileSync(file).toString();
  let newData = data;
  for (const replacement of replacements) {
    newData = newData.replace(replacement[source], replacement[dest]);
  }
  for (const replacement of imports) {
    newData = newData
      .replace(`{ ${replacement[source]} }`, `{ ${replacement[dest]} }`)
      .replace(`{ ${replacement[source]},`, `{ ${replacement[dest]},`)
      .replace(`, ${replacement[source]},`, `, ${replacement[dest]},`)
      .replace(`, ${replacement[source]} }`, `, ${replacement[dest]} }`)
  }
  if (newData && newData !== data) {
    writeFileSync(file, newData);
  }
}
