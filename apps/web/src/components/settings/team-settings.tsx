'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { UserPlus, Users } from 'lucide-react';

const teamMembers = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@support.com',
    role: 'Admin',
    avatar: null,
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@support.com',
    role: 'Agent',
    avatar: null,
  },
  {
    id: '3',
    name: 'Charlie Davis',
    email: 'charlie@support.com',
    role: 'Agent',
    avatar: null,
  },
];

const roleVariants: Record<string, 'default' | 'secondary'> = {
  Admin: 'default',
  Agent: 'secondary',
};

export function TeamSettings() {
  const isEmpty = teamMembers.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage your team and their permissions.</CardDescription>
        </div>
        <Button onClick={handleInviteMember}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState
            icon={Users}
            title="No team members"
            description="Start building your team by inviting members to collaborate."
            actionLabel="Invite Member"
            variant="compact"
          />
        ) : (
          <div className="space-y-4">
            {teamMembers.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={member.avatar || undefined} />
                  <AvatarFallback>
                    {member.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={roleVariants[member.role]}>{member.role}</Badge>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
