import { ao3Provider } from './ao3Provider.js';
export class StoryProviderRegistry {
    providers = [ao3Provider];
    providerForUrl(url) {
        return this.providers.find(p => p.canHandleUrl(url)) || null;
    }
    resolve(url) {
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
