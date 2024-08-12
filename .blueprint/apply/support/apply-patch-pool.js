import { Piscina } from 'piscina';

export class ApplyPatchPool extends Piscina {
  constructor(options = {}) {
    super({
      maxThreads: 3,
      filename: new URL('./apply-patch-worker.js', import.meta.url).href,
      ...options,
    });
  }

  apply(data) {
    return this.run(data);
  }
}
