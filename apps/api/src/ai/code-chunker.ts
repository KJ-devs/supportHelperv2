export interface CodeChunk {
  content: string;
  chunkIndex: number;
  language: string;
  startLine: number;
  endLine: number;
  metadata: {
    type: 'function' | 'class' | 'module' | 'section' | 'block';
    name?: string;
  };
}

const MAX_CHUNK_CHARS = 6000; // ~1500 tokens at ~4 chars/token
const DEFAULT_MAX_CHUNK_LINES = 80;
const DEFAULT_OVERLAP_LINES = 15;

/**
 * Chunk a source code file into semantic pieces for embedding.
 *
 * Strategy:
 * - TypeScript/JavaScript: Split by top-level declarations
 * - Markdown: Split by headings
 * - Prisma: Split by model/enum blocks
 * - JSON: Single chunk for small files, skip large non-config ones
 * - Other: Split by line count with overlap
 */
export function chunkCodeFile(
  content: string,
  filePath: string,
  options?: { maxChunkLines?: number; overlapLines?: number },
): CodeChunk[] {
  const maxChunkLines = options?.maxChunkLines ?? DEFAULT_MAX_CHUNK_LINES;
  const overlapLines = options?.overlapLines ?? DEFAULT_OVERLAP_LINES;
  const ext = getExtension(filePath);
  const language = detectLanguage(filePath);

  if (!content.trim()) {
    return [];
  }

  let chunks: CodeChunk[];

  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
      chunks = chunkTypeScript(content, language, maxChunkLines, overlapLines);
      break;
    case '.md':
      chunks = chunkMarkdown(content, language);
      break;
    case '.json':
      chunks = chunkJson(content, filePath, language);
      break;
    case '.prisma':
      chunks = chunkPrisma(content, language);
      break;
    default:
      chunks = chunkByLines(content, language, maxChunkLines, overlapLines);
      break;
  }

  // Add context prefix and enforce max chunk size
  const finalChunks: CodeChunk[] = [];
  for (const chunk of chunks) {
    const prefix = `// File: ${filePath} (lines ${chunk.startLine}-${chunk.endLine})\n`;
    const prefixedContent = prefix + chunk.content;

    if (prefixedContent.length > MAX_CHUNK_CHARS) {
      // Sub-chunk oversized chunks
      const subChunks = splitOversizedChunk(
        chunk,
        filePath,
        maxChunkLines,
        overlapLines,
      );
      finalChunks.push(...subChunks);
    } else {
      finalChunks.push({ ...chunk, content: prefixedContent });
    }
  }

  // Reassign chunk indices
  return finalChunks.map((c, i) => ({ ...c, chunkIndex: i }));
}

function chunkTypeScript(
  content: string,
  language: string,
  maxChunkLines: number,
  overlapLines: number,
): CodeChunk[] {
  const lines = content.split('\n');
  // Regex to detect top-level declarations (no leading whitespace)
  const boundaryRegex =
    /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+(\w+)/;

  const boundaries: { line: number; name: string; type: CodeChunk['metadata']['type'] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i];
    // Only match lines at indent level 0
    if (trimmed.length > 0 && trimmed[0] !== ' ' && trimmed[0] !== '\t') {
      const match = trimmed.match(boundaryRegex);
      if (match) {
        let type: CodeChunk['metadata']['type'] = 'block';
        if (/class\s/.test(trimmed)) type = 'class';
        else if (/function\s/.test(trimmed)) type = 'function';
        else if (/interface\s|type\s/.test(trimmed)) type = 'module';
        boundaries.push({ line: i, name: match[1], type });
      }
    }
  }

  if (boundaries.length === 0) {
    return chunkByLines(content, language, maxChunkLines, overlapLines);
  }

  const chunks: CodeChunk[] = [];

  // If the first boundary doesn't start at line 0, include the import block
  // as part of the first chunk
  const firstBoundary = boundaries[0].line;

  for (let b = 0; b < boundaries.length; b++) {
    const start = b === 0 ? 0 : boundaries[b].line;
    const end =
      b < boundaries.length - 1 ? boundaries[b + 1].line - 1 : lines.length - 1;

    const chunkLines = lines.slice(start, end + 1);
    const chunkContent = chunkLines.join('\n');

    chunks.push({
      content: chunkContent,
      chunkIndex: b,
      language,
      startLine: start + 1,
      endLine: end + 1,
      metadata: {
        type: boundaries[b].type,
        name: boundaries[b].name,
      },
    });
  }

  // If nothing was captured before the first boundary and first boundary > 0,
  // that's already included in chunk 0 (we set start = 0 for b === 0)

  return chunks;
}

function chunkMarkdown(content: string, language: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  let currentStart = 0;
  let currentName = 'header';

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{2,})\s+(.+)/);
    if (headingMatch && i > 0) {
      // End previous chunk
      const chunkLines = lines.slice(currentStart, i);
      if (chunkLines.some((l) => l.trim().length > 0)) {
        chunks.push({
          content: chunkLines.join('\n'),
          chunkIndex: chunks.length,
          language,
          startLine: currentStart + 1,
          endLine: i,
          metadata: { type: 'section', name: currentName },
        });
      }
      currentStart = i;
      currentName = headingMatch[2].trim();
    }
  }

  // Last section
  const lastLines = lines.slice(currentStart);
  if (lastLines.some((l) => l.trim().length > 0)) {
    chunks.push({
      content: lastLines.join('\n'),
      chunkIndex: chunks.length,
      language,
      startLine: currentStart + 1,
      endLine: lines.length,
      metadata: { type: 'section', name: currentName },
    });
  }

  return chunks;
}

function chunkJson(
  content: string,
  filePath: string,
  language: string,
): CodeChunk[] {
  const lines = content.split('\n');
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
  const indexableJsonFiles = ['package.json', 'tsconfig.json', 'turbo.json'];

  if (lines.length > 100 && !indexableJsonFiles.includes(fileName)) {
    return []; // Skip large non-config JSON
  }

  return [
    {
      content: content,
      chunkIndex: 0,
      language,
      startLine: 1,
      endLine: lines.length,
      metadata: { type: 'module', name: fileName },
    },
  ];
}

function chunkPrisma(content: string, language: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  const blockRegex = /^(model|enum|type|generator|datasource)\s+(\w+)/;

  let currentStart = 0;
  let currentName: string | undefined;
  let currentType: CodeChunk['metadata']['type'] = 'module';

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(blockRegex);
    if (match) {
      // Save previous block if there's content
      if (i > currentStart) {
        const blockLines = lines.slice(currentStart, i);
        if (blockLines.some((l) => l.trim().length > 0)) {
          chunks.push({
            content: blockLines.join('\n'),
            chunkIndex: chunks.length,
            language,
            startLine: currentStart + 1,
            endLine: i,
            metadata: { type: currentType, name: currentName },
          });
        }
      }
      currentStart = i;
      currentName = match[2];
      currentType = match[1] === 'model' || match[1] === 'type' ? 'class' : 'module';
    }
  }

  // Last block
  const lastBlock = lines.slice(currentStart);
  if (lastBlock.some((l) => l.trim().length > 0)) {
    chunks.push({
      content: lastBlock.join('\n'),
      chunkIndex: chunks.length,
      language,
      startLine: currentStart + 1,
      endLine: lines.length,
      metadata: { type: currentType, name: currentName },
    });
  }

  return chunks;
}

function chunkByLines(
  content: string,
  language: string,
  maxChunkLines: number,
  overlapLines: number,
): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + maxChunkLines, lines.length);
    const chunkLines = lines.slice(start, end);

    chunks.push({
      content: chunkLines.join('\n'),
      chunkIndex: chunks.length,
      language,
      startLine: start + 1,
      endLine: end,
      metadata: { type: 'block' },
    });

    if (end >= lines.length) break;
    start = end - overlapLines;
  }

  return chunks;
}

function splitOversizedChunk(
  chunk: CodeChunk,
  filePath: string,
  maxChunkLines: number,
  overlapLines: number,
): CodeChunk[] {
  const lines = chunk.content.split('\n');
  const subChunks: CodeChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + maxChunkLines, lines.length);
    const subLines = lines.slice(start, end);
    const prefix = `// File: ${filePath} (lines ${chunk.startLine + start}-${chunk.startLine + end - 1})\n`;

    subChunks.push({
      content: prefix + subLines.join('\n'),
      chunkIndex: 0, // Will be reassigned by caller
      language: chunk.language,
      startLine: chunk.startLine + start,
      endLine: chunk.startLine + end - 1,
      metadata: { ...chunk.metadata },
    });

    if (end >= lines.length) break;
    start = end - overlapLines;
  }

  return subChunks;
}

function getExtension(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot === -1) return '';
  return normalized.slice(lastDot).toLowerCase();
}

export function detectLanguage(filePath: string): string {
  const ext = getExtension(filePath);
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.md': 'markdown',
    '.prisma': 'prisma',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
  };
  return map[ext] || 'plaintext';
}
