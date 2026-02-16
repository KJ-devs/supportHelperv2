export interface GeneratedFile {
  filePath: string;
  operation: 'modify' | 'create' | 'delete';
  originalContent?: string;
  generatedContent: string;
  changeType: string;
}

export interface GeneratedCodeResult {
  files: GeneratedFile[];
  totalApiCalls: number;
  generationTimeMs: number;
}
