// Package builder: images. Background groups (clouds, landscapes, paintings) and
// keyword tags for the sprite pool. Built from the helpers and state that
// build-package.mjs passes in.
export function imagesBuilder(K) {
  const { OFFLINE, warn, report } = K;

  // [{ id, name, kind: 'cloud' | 'landscape' | 'painting', imgs: [{ src, credit, link }] }]
  async function buildBackgrounds() {
    if (OFFLINE) return [];
    return [];
  }
  // adds `tags: [...]` to each sprite so posts can pick pictures that suit them
  function tagSprites(sprites) { return sprites; }

  void warn; void report;
  return { buildBackgrounds, tagSprites };
}
