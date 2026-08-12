// The HTTP side of the ContentSource seam (docs/engineering.md § 2): fetches
// the committed content JSON from under the app's base path. In the app the
// caller passes import.meta.env.BASE_URL; tests pass a literal.
import type { ContentSource, ModuleContent, ModuleId, ModuleIndex } from './contract';

export function createHttpContentSource(baseUrl: string): ContentSource {
  return {
    async loadIndex(): Promise<ModuleIndex> {
      const response = await fetch(`${baseUrl}content/index.json`);
      if (!response.ok) {
        throw new Error(`Failed to load module index: HTTP ${response.status}`);
      }
      return (await response.json()) as ModuleIndex;
    },

    async loadModuleContent(id: ModuleId): Promise<ModuleContent | null> {
      const response = await fetch(`${baseUrl}content/modules/${id}.json`);
      // 404 = the Module has no content file yet (pending).
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Failed to load content for ${id}: HTTP ${response.status}`);
      }
      return (await response.json()) as ModuleContent;
    },
  };
}
