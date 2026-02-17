'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Github, Slack, Mail, Plug } from 'lucide-react';

const integrations = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync issues and pull requests with support tickets',
    icon: Github,
    connected: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications and updates in Slack channels',
    icon: Slack,
    connected: false,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Convert emails into support tickets automatically',
    icon: Mail,
    connected: true,
  },
];

export function IntegrationSettings() {
  const connectedIntegrations = integrations.filter(i => i.connected);
  const isEmpty = connectedIntegrations.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          Connect external services to enhance your support workflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={Plug}
            title="No integrations configured"
            description="Connect external services like GitHub, Slack, or email to streamline your support workflow."
            className="min-h-[200px]"
          />
        ) : (
          <div className="space-y-4">
            {integrations.map(integration => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <integration.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{integration.name}</p>
                    {integration.connected && <Badge variant="success">Connected</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              <Button variant={integration.connected ? 'outline' : 'default'}>
                {integration.connected ? 'Configure' : 'Connect'}
              </Button>
            </div>
          ))}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
