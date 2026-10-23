import { ao3Provider, Ao3Provider } from './ao3Provider.js';
import { ParsedStoryUrl, RemoteStoryMetadata } from '../../src/types/story.js';

export interface StoryProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly baseUrl: string;
  canHandleUrl(url: string): boolean;
  parseUrl(url: string): ParsedStoryUrl | null;
  fetchStoryMetadata(parsed: ParsedStoryUrl, cookie?: string, allowFallback?: boolean): Promise<RemoteStoryMetadata>;
}

export class StoryProviderRegistry {
  private providers: StoryProvider[] = [ao3Provider];

  providerForUrl(url: string): StoryProvider | null {
    return this.providers.find(p => p.canHandleUrl(url)) || null;
  }

  resolve(url: string): { provider: StoryProvider; parsed: ParsedStoryUrl } {
    const provider = this.providerForUrl(url);
    if (!provider) {
      throw new Error(`This story URL is not supported: ${url}`);
    }
    const parsed = provider.parseUrl(url);
    if (!parsed) {
      throw new Error(`Invalid story URL for provider ${provider.displayName}`);
    }
    return { provider, parsed };
  }
}

export const storyProviderRegistry = new StoryProviderRegistry();
