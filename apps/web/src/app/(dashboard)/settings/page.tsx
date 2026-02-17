import { type Metadata } from 'next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettings } from '@/components/settings/general-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { TeamSettings } from '@/components/settings/team-settings';
import { IntegrationSettings } from '@/components/settings/integration-settings';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your account and application settings',
};

export default function SettingsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Manage your account and application preferences.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm">Notifications</TabsTrigger>
          <TabsTrigger value="team" className="text-xs sm:text-sm">Team</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs sm:text-sm">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 sm:space-y-6">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 sm:space-y-6">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="team" className="space-y-4 sm:space-y-6">
          <TeamSettings />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 sm:space-y-6">
          <IntegrationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
