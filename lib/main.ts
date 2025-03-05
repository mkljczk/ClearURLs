import { Provider } from './provider';
import { sha256 } from './tools';
import type { SerializedRules } from './types';

interface URLPurifyConfig {
  hashUrl?: string;
  ruleUrl?: string;
  hashFromMemory?: string;
  rulesFromMemory?: SerializedRules;
  onFetchedRules?: (newHash: string, newRules: SerializedRules) => void;
  referralMarketing?: boolean;
}

class URLPurify {
  private referralMarketing: boolean;
  private onFetchedRules?: (newHash: string, newRules: SerializedRules) => void;

  private providers: Record<string, Provider> = {};

  constructor({
    hashUrl,
    ruleUrl,
    hashFromMemory,
    rulesFromMemory,
    onFetchedRules,
    referralMarketing = true,
  }: URLPurifyConfig) {
    if (!ruleUrl && !rulesFromMemory)
      throw new Error(
        'Either rule URL or a prefetched ruleset must be provided',
      );

    this.referralMarketing = referralMarketing;
    this.onFetchedRules = onFetchedRules;

    if (rulesFromMemory) this.createProviders(rulesFromMemory);

    if (ruleUrl) {
      if (hashFromMemory && hashUrl) {
        this.fetchHash(hashUrl).then((newHash) => {
          if (newHash !== hashFromMemory) {
            this.fetchRules(ruleUrl).then(this.createProviders);
          }
        });
      } else {
        this.fetchRules(ruleUrl).then(this.createProviders);
      }
    }
  }

  private createProviders = (rules: SerializedRules) => {
    this.providers = {};

    for (const [name, provider] of Object.entries(rules.providers)) {
      this.providers[name] = new Provider(
        name,
        provider,
        this.referralMarketing,
      );
    }
  };

  clearUrl = (url: string) => {
    let result: ReturnType<
      InstanceType<typeof Provider>['removeFieldsFormURL']
    > = {
      url: url,
      redirect: false,
    };

    /*
     * Call the removeFieldsFormURL method for every provider.
     */
    for (const provider of Object.values(this.providers)) {
      if (provider.matchURL(result.url)) {
        result = provider.removeFieldsFormURL(result.url);
      }

      /*
       * Ensure that the function doesn't get into a loop.
       */
      if (result.redirect) {
        return result.url;
      }
    }

    // Default case
    return result.url;
  };

  fetchHash = async (url: string) => {
    const response = await fetch(url);
    return await response.text();
  };

  fetchRules = async (url: string): Promise<SerializedRules> => {
    const response = await fetch(url);
    const rulesText = await response.text();
    const rules = JSON.parse(rulesText);

    sha256(rulesText).then((hash) => {
      if (this.onFetchedRules) {
        this.onFetchedRules(hash, rules);
      }
    });

    return rules;
  };
}

export { URLPurify };
