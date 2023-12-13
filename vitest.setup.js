import Module from 'node:module';
import { pathToFileURL } from 'node:url';

Module.register(pathToFileURL(require.resolve('@node-loaders/esbuild')));
