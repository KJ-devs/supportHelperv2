'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  ListOrdered,
  Terminal,
  Bot,
  History,
  MessageCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Play,
  ExternalLink,
  Copy,
  Check,
  GitPullRequest,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn, formatDateTime, formatRelativeTime, formatDuration } from '@/lib/utils';
import type {
  TicketDetail,
  ReproductionStep,
  LogEntry,
  AIAnalysis,
  ActivityEvent,
  AgentMessage,
  TicketEvent,
  FixProposedEventData,
} from '@/types/ticket';

interface TicketTabsProps {
  ticket: TicketDetail;
  onJumpToTimestamp?: (timestamp: number) => void;
}

// Description Tab
function DescriptionTab({ description }: { description: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Reproduction Steps Tab
function ReproductionStepsTab({
  steps,
  onJumpToTimestamp,
}: {
  steps: ReproductionStep[];
  onJumpToTimestamp?: (timestamp: number) => void;
}) {
  if (steps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <ListOrdered className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reproduction steps recorded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ol className="space-y-4">
          {steps.map(step => (
            <li key={step.id} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                {step.order}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">{step.action}</p>
                {step.expected && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Expected: </span>
                    <span className="text-green-600">{step.expected}</span>
                  </div>
                )}
                {step.actual && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Actual: </span>
                    <span className="text-red-600">{step.actual}</span>
                  </div>
                )}
                {step.timestamp !== undefined && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => onJumpToTimestamp?.(step.timestamp!)}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Jump to {formatDuration(step.timestamp)}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// Logs Tab
function LogsTab({ logs }: { logs: LogEntry[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogEntry['level'] | 'all'>('all');

  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

  const copyToClipboard = useCallback((log: LogEntry) => {
    const text = `[${log.level.toUpperCase()}] ${log.timestamp} - ${log.message}${
      log.stackTrace ? `\n${log.stackTrace}` : ''
    }`;
    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const levelIcons: Record<LogEntry['level'], typeof Info> = {
    info: Info,
    warn: AlertTriangle,
    error: AlertCircle,
    debug: Bug,
  };

  const levelColors: Record<LogEntry['level'], string> = {
    info: 'text-blue-500 bg-blue-500/10',
    warn: 'text-yellow-500 bg-yellow-500/10',
    error: 'text-red-500 bg-red-500/10',
    debug: 'text-gray-500 bg-gray-500/10',
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No logs recorded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map(level => (
            <Button
              key={level}
              variant={filter === level ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(level)}
              className="h-7"
            >
              {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
              {level !== 'all' && (
                <Badge variant="secondary" className="ml-1 h-4 px-1">
                  {logs.filter(l => l.level === level).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Logs List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredLogs.map(log => {
            const Icon = levelIcons[log.level];
            return (
              <div
                key={log.id}
                className={cn(
                  'p-3 rounded-lg border text-sm font-mono group',
                  log.level === 'error' && 'border-red-200 bg-red-50/50 dark:bg-red-950/20',
                  log.level === 'warn' && 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={cn('p-1 rounded', levelColors[log.level])}>
                      <Icon className="h-3 w-3" />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDateTime(log.timestamp)}
                    </span>
                    {log.source && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {log.source}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => copyToClipboard(log)}
                  >
                    {copiedId === log.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <p className="mt-2 break-all">{log.message}</p>
                {log.stackTrace && (
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                    {log.stackTrace}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// AI Analysis Tab
function AIAnalysisTab({ analysis }: { analysis: AIAnalysis | null }) {
  if (!analysis) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>AI analysis not available for this ticket</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Summary */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Summary
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Root Cause */}
        {analysis.rootCause && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Root Cause Analysis
            </h4>
            <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200">
              <p className="text-sm">{analysis.rootCause}</p>
            </div>
          </div>
        )}

        {/* Suggested Solution */}
        {analysis.suggestedSolution && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Suggested Solution
            </h4>
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
              <p className="text-sm">{analysis.suggestedSolution}</p>
            </div>
          </div>
        )}

        {/* Code Snippets */}
        {analysis.codeSnippets && analysis.codeSnippets.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Code Examples</h4>
            <div className="space-y-3">
              {analysis.codeSnippets.map((snippet, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-sm text-muted-foreground">{snippet.description}</p>
                  <pre className="p-3 bg-muted rounded-lg text-sm overflow-x-auto">
                    <code className={`language-${snippet.language}`}>{snippet.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Docs */}
        {analysis.relatedDocs && analysis.relatedDocs.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Related Documentation</h4>
            <div className="space-y-2">
              {analysis.relatedDocs.map((doc, i) => (
                <a
                  key={i}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm">{doc.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{Math.round(doc.relevance * 100)}%</Badge>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Confidence */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">Analysis Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${analysis.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">{Math.round(analysis.confidence * 100)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Fix Proposed Event Row
function FixProposedRow({
  data,
  createdAt,
  isLast,
}: {
  data: FixProposedEventData;
  createdAt: string;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="relative flex flex-col items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
          <GitPullRequest className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        {!isLast && <div className="flex-1 w-px bg-border mt-2" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Fix proposé</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(createdAt)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
          <a
            href={data.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            PR #{data.prNumber}
            {data.title ? `: ${data.title}` : ''}
          </a>
          <span className="text-xs text-muted-foreground">branche: {data.branch}</span>
        </div>
      </div>
    </div>
  );
}

// Activity History Tab
function ActivityHistoryTab({
  events,
  ticketEvents,
}: {
  events: ActivityEvent[];
  ticketEvents?: TicketEvent[];
}) {
  const eventIcons: Record<ActivityEvent['type'], typeof History> = {
    created: Check,
    assigned: MessageCircle,
    status_changed: History,
    priority_changed: AlertTriangle,
    comment: MessageCircle,
    tag_added: FileText,
    tag_removed: FileText,
    linked_github: ExternalLink,
    ai_analysis: Bot,
    resolved: Check,
    fix_proposed: GitPullRequest,
  };

  // Raw TicketEvent items of type fix_proposed from the API
  const fixProposedEvents = (ticketEvents ?? []).filter(e => e.type === 'fix_proposed');

  const totalCount = events.length + fixProposedEvents.length;

  if (totalCount === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activity recorded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {events.map((event, index) => {
            const Icon = eventIcons[event.type] || History;
            const isLast = index === events.length - 1 && fixProposedEvents.length === 0;

            // Special rendering for fix_proposed coming via activityHistory
            if (event.type === 'fix_proposed' && event.metadata) {
              const data = event.metadata as unknown as FixProposedEventData;
              return (
                <FixProposedRow
                  key={event.id}
                  data={data}
                  createdAt={event.createdAt}
                  isLast={isLast}
                />
              );
            }

            return (
              <div key={event.id} className="flex gap-3">
                <div className="relative flex flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {!isLast && <div className="flex-1 w-px bg-border mt-2" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={event.user.avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {event.user.name
                          .split(' ')
                          .map(n => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{event.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
                </div>
              </div>
            );
          })}

          {/* Raw TicketEvents of type fix_proposed from the API */}
          {fixProposedEvents.map((event, index) => {
            const data = event.data as unknown as FixProposedEventData;
            const isLast = index === fixProposedEvents.length - 1;
            return (
              <FixProposedRow
                key={event.id}
                data={data}
                createdAt={event.createdAt}
                isLast={isLast}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Agent Conversation Tab
function AgentConversationTab({ messages }: { messages: AgentMessage[] }) {
  const roleColors = {
    user: 'bg-blue-500',
    agent: 'bg-green-500',
    system: 'bg-gray-500',
  };

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No agent conversation recorded</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0',
                  roleColors[message.role]
                )}
              >
                {message.role === 'agent' ? (
                  <Bot className="h-4 w-4" />
                ) : message.role === 'user' ? (
                  <MessageCircle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  'flex-1 max-w-[80%] p-3 rounded-lg',
                  message.role === 'user' && 'bg-primary text-primary-foreground',
                  message.role === 'agent' && 'bg-muted',
                  message.role === 'system' && 'bg-muted/50 border border-dashed'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p
                  className={cn(
                    'text-xs mt-2',
                    message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  {formatDateTime(message.timestamp)}
                </p>
                {message.metadata?.sentiment && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'mt-2 text-xs',
                      message.metadata.sentiment === 'positive' &&
                        'border-green-500 text-green-500',
                      message.metadata.sentiment === 'negative' && 'border-red-500 text-red-500'
                    )}
                  >
                    {message.metadata.sentiment}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Tabs Component
export function TicketTabs({ ticket, onJumpToTimestamp }: TicketTabsProps) {
  return (
    <Tabs defaultValue="description" className="w-full">
      <TabsList className="grid grid-cols-6 w-full">
        <TabsTrigger value="description" className="text-xs sm:text-sm">
          <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
          Description
        </TabsTrigger>
        <TabsTrigger value="steps" className="text-xs sm:text-sm">
          <ListOrdered className="h-4 w-4 mr-1 hidden sm:inline" />
          Steps
        </TabsTrigger>
        <TabsTrigger value="logs" className="text-xs sm:text-sm">
          <Terminal className="h-4 w-4 mr-1 hidden sm:inline" />
          Logs
          {ticket.logs.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {ticket.logs.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="ai" className="text-xs sm:text-sm">
          <Bot className="h-4 w-4 mr-1 hidden sm:inline" />
          AI Analysis
        </TabsTrigger>
        <TabsTrigger value="activity" className="text-xs sm:text-sm">
          <History className="h-4 w-4 mr-1 hidden sm:inline" />
          Activity
        </TabsTrigger>
        <TabsTrigger value="conversation" className="text-xs sm:text-sm">
          <MessageCircle className="h-4 w-4 mr-1 hidden sm:inline" />
          Agent
        </TabsTrigger>
      </TabsList>

      <TabsContent value="description" className="mt-4">
        <DescriptionTab description={ticket.description} />
      </TabsContent>

      <TabsContent value="steps" className="mt-4">
        <ReproductionStepsTab
          steps={ticket.reproductionSteps}
          onJumpToTimestamp={onJumpToTimestamp}
        />
      </TabsContent>

      <TabsContent value="logs" className="mt-4">
        <LogsTab logs={ticket.logs} />
      </TabsContent>

      <TabsContent value="ai" className="mt-4">
        <AIAnalysisTab analysis={ticket.aiAnalysis} />
      </TabsContent>

      <TabsContent value="activity" className="mt-4">
        <ActivityHistoryTab events={ticket.activityHistory} ticketEvents={ticket.events} />
      </TabsContent>

      <TabsContent value="conversation" className="mt-4">
        <AgentConversationTab messages={ticket.agentConversation} />
      </TabsContent>
    </Tabs>
  );
}

// Loading Skeleton
export function TicketTabsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 flex-1" />
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
