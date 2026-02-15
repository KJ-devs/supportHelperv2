export interface IndexingResult {
  applicationId: string;
  filesProcessed: number;
  chunksCreated: number;
  duration: number;
  lastCommitSha: string;
}

export interface CodeSearchResult {
  filePath: string;
  chunkIndex: number;
  content: string;
  language: string;
  distance: number;
  metadata: Record<string, any>;
}
