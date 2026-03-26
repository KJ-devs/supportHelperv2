import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface TriggerCondition {
  field: 'type' | 'severity' | 'keywords';
  operator: 'equals' | 'in' | 'contains';
  value: string | string[];
}

interface TriggerRules {
  conditions: TriggerCondition[];
  matchMode: 'all' | 'any';
  priority: number;
}

interface TicketContext {
  type: string | null;
  severity: string | null;
  keywords: string[];
}

interface ResolvedAgent {
  id: string;
  name: string;
  systemPrompt: string;
  toolset: string[];
  model: string | null;
  temperature: number | null;
  maxIterations: number | null;
}

@Injectable()
export class AgentRoutingService {
  private readonly logger = new Logger(AgentRoutingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveAgent(tenantId: string, ticket: TicketContext): Promise<ResolvedAgent | null> {
    const agents = await this.prisma.agentDefinition.findMany({
      where: {
        OR: [{ tenantId }, { isSystem: true }],
        isActive: true,
      },
    });

    // Filter agents that have trigger rules defined
    const withRules = agents.filter(
      a => a.triggerRules !== null && typeof a.triggerRules === 'object'
    );

    // Sort by priority (highest first)
    const sorted = withRules.sort((a, b) => {
      const pa = (a.triggerRules as unknown as TriggerRules)?.priority ?? 0;
      const pb = (b.triggerRules as unknown as TriggerRules)?.priority ?? 0;
      return pb - pa;
    });

    for (const agent of sorted) {
      const rules = agent.triggerRules as unknown as TriggerRules;
      if (this.matchesTriggerRules(rules, ticket)) {
        this.logger.log(`Routed ticket to agent "${agent.name}" (priority: ${rules.priority})`);
        return {
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          toolset: agent.toolset,
          model: agent.model,
          temperature: agent.temperature,
          maxIterations: agent.maxIterations,
        };
      }
    }

    return null; // fallback to default N2
  }

  private matchesTriggerRules(rules: TriggerRules, ticket: TicketContext): boolean {
    if (!rules.conditions || rules.conditions.length === 0) return false;

    const results = rules.conditions.map(c => this.evaluateCondition(c, ticket));

    return rules.matchMode === 'all' ? results.every(Boolean) : results.some(Boolean);
  }

  private evaluateCondition(cond: TriggerCondition, ticket: TicketContext): boolean {
    switch (cond.field) {
      case 'type':
        return this.matchValue(ticket.type, cond);
      case 'severity':
        return this.matchValue(ticket.severity, cond);
      case 'keywords':
        return this.matchKeywords(ticket.keywords, cond);
      default:
        return false;
    }
  }

  private matchValue(fieldValue: string | null, cond: TriggerCondition): boolean {
    if (fieldValue === null) return false;

    switch (cond.operator) {
      case 'equals':
        return fieldValue === cond.value;
      case 'in':
        return Array.isArray(cond.value) && cond.value.includes(fieldValue);
      case 'contains':
        return typeof cond.value === 'string' && fieldValue.includes(cond.value);
      default:
        return false;
    }
  }

  private matchKeywords(keywords: string[], cond: TriggerCondition): boolean {
    switch (cond.operator) {
      case 'contains':
        return (
          typeof cond.value === 'string' && keywords.some(k => k.includes(cond.value as string))
        );
      case 'in':
        return Array.isArray(cond.value) && cond.value.some(v => keywords.includes(v));
      case 'equals':
        return typeof cond.value === 'string' && keywords.includes(cond.value);
      default:
        return false;
    }
  }
}
