import { SlackProvider } from './slack.provider';
import { DiscordProvider } from './discord.provider';
import { NotionProvider } from './notion.provider';

export const INTEGRATION_PROVIDERS = {
  slack: SlackProvider,
  discord: DiscordProvider,
  notion: NotionProvider,
} as const;

export type IntegrationType = keyof typeof INTEGRATION_PROVIDERS;

export { SlackProvider, DiscordProvider, NotionProvider };
export { IntegrationProvider } from './integration-provider.interface';
export { BaseIntegrationProvider } from './base-provider.abstract';
