export interface ActionPlan {
  summary: string;
  rootCause: string;
  files: ActionPlanFile[];
  testingStrategy: string;
  risks: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface ActionPlanFile {
  filePath: string;
  operation: 'modify' | 'create' | 'delete';
  description: string;
  changeType: 'bug_fix' | 'enhancement' | 'refactor' | 'test';
  order: number;
}

export type AgentTaskStatus =
  | 'analyzing'
  | 'plan_ready'
  | 'plan_approved'
  | 'generating'
  | 'code_ready'
  | 'code_approved'
  | 'pushing'
  | 'pr_created'
  | 'completed'
  | 'failed'
  | 'expired';
