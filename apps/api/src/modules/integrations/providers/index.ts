import { SlackProvider } from './slack.provider';
import { DiscordProvider } from './discord.provider';
import { NotionProvider } from './notion.provider';
import { HubSpotProvider } from './hubspot.provider';
import { JiraProvider } from './jira.provider';

export const INTEGRATION_PROVIDERS = {
  slack: SlackProvider,
  discord: DiscordProvider,
  notion: NotionProvider,
  hubspot: HubSpotProvider,
  jira: JiraProvider,
} as const;

export type IntegrationType = keyof typeof INTEGRATION_PROVIDERS;

export { SlackProvider, DiscordProvider, NotionProvider, HubSpotProvider, JiraProvider };
export { IntegrationProvider } from './integration-provider.interface';
export { BaseIntegrationProvider } from './base-provider.abstract';
