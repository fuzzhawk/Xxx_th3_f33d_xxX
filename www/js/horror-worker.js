// The horror forge's worker: draws monster frames off the main thread (see prefetch in horror.js).
// It rebuilds the genome from the seed, so its pixels are the same as the main thread's would be.
import { framePixels, registerPost } from './horror.js';
import { grimePixels } from './grime.js';
registerPost('hm', grimePixels);
self.onmessage = (e) => {
  const { id, seed, size, opts, anim, k, dir } = e.data;
  let d = null;
  try { d = framePixels(seed, size, opts, anim, k, dir); } catch (err) { self.postMessage({ id, err: String(err) }); return; }
  self.postMessage({ id, d }, [d.buffer]);
};
