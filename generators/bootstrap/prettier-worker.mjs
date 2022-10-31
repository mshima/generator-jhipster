import prettier from 'prettier';
import prettierPluginJava from 'prettier-plugin-java';
import prettierPluginPackagejson from 'prettier-plugin-packagejson';

export default async function format({ filepath, fileContent, options, prettierOptions }) {
  prettierOptions = {
    plugins: [],
    // Config from disk
    ...prettierOptions,
    // for better errors
    filepath,
  };
  if (options.packageJson) {
    prettierOptions.plugins.push(prettierPluginPackagejson);
  }
  if (options.java) {
    prettierOptions.plugins.push(prettierPluginJava);
  }
  return prettier.format(fileContent, prettierOptions);
}
