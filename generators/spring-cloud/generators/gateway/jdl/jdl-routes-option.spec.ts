import { before, it, describe, expect } from 'esmocha';
import { createImporterFromContent, ImportState } from '../../../../../jdl/jdl-importer.js';
import { convertSingleContentToJDL } from '../../../../../jdl/converters/json-to-jdl-converter.js';

const optionName = 'routes';

describe('generators - spring-cloud:gateway - jdl', () => {
  describe(`parsing ${optionName}`, () => {
    let state: ImportState;

    before(() => {
      const importer = createImporterFromContent(
        `application { config { ${optionName} ["blog:blog_host:123", "store:store_host", "notification"] } }`,
      );
      state = importer.import();
    });

    it('should set expected value', () => {
      expect(state.exportedApplicationsWithEntities.jhipster.config[optionName]).toEqual([
        'blog:blog_host:123',
        'store:store_host',
        'notification',
      ]);
    });
  });
  describe(`export ${optionName}`, () => {
    let jdl: string;

    before(() => {
      jdl = convertSingleContentToJDL({
        'generator-jhipster': { baseName: 'bar', [optionName]: ['blog:blog_host:123', 'store:store_host', 'notification'] },
      });
    });

    it('should set expected value', () => {
      expect(jdl).toEqual(`application {
  config {
    baseName bar
    routes ["blog:blog_host:123", "store:store_host", "notification"]
  }
}
`);
    });
  });
});
