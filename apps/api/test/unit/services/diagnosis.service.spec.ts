import { Test, TestingModule } from '@nestjs/testing';
import { DiagnosisService, Diagnosis } from '../../../src/modules/agent-v2/diagnosis.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ToolCallResult } from '../../../src/modules/agent-v2/agent-tools';
import { AgenticLoopResult } from '../../../src/modules/agent-v2/agentic-loop.service';

describe('DiagnosisService', () => {
  let service: DiagnosisService;
  let prisma: jest.Mocked<PrismaService>;

  const mockDiagnosis: Diagnosis = {
    rootCause: 'Null pointer dereference in auth middleware',
    affectedFiles: [
      {
        filePath: 'src/auth/auth.middleware.ts',
        relevance: 'primary',
        description: 'Main auth logic with null reference bug',
      },
    ],
    confidence: 0.85,
    suggestedFix: 'Add null check before accessing user.id',
    remainingQuestions: ['Is there a race condition?'],
  };

  const mockLoopResult: AgenticLoopResult = {
    finalContent: 'Investigation complete.',
    toolCallLog: [
      {
        toolCallId: 'tool-1',
        name: 'read_file',
        input: { file_path: 'src/auth/auth.middleware.ts' },
        result: 'file content',
        durationMs: 120,
      },
    ],
    iterations: 2,
    messages: [],
  };

  beforeEach(async () => {
    const mockPrisma = {
      ticket: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiagnosisService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DiagnosisService>(DiagnosisService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveDiagnosis', () => {
    it('updates ticket diagnosis field in Prisma', async () => {
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});

      await service.saveDiagnosis('ticket-123', 'tenant-123', mockDiagnosis, mockLoopResult);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: expect.objectContaining({
          diagnosis: expect.objectContaining({
            rootCause: mockDiagnosis.rootCause,
            confidence: mockDiagnosis.confidence,
          }),
        }),
      });
    });

    it('sets diagnosisUpdatedAt timestamp', async () => {
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});

      await service.saveDiagnosis('ticket-123', 'tenant-123', mockDiagnosis, mockLoopResult);

      const updateCall = (prisma.ticket.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.diagnosisUpdatedAt).toBeInstanceOf(Date);
    });

    it('includes investigationLog derived from toolCallLog', async () => {
      (prisma.ticket.update as jest.Mock).mockResolvedValue({});

      await service.saveDiagnosis('ticket-123', 'tenant-123', mockDiagnosis, mockLoopResult);

      const updateCall = (prisma.ticket.update as jest.Mock).mock.calls[0][0];
      const savedDiagnosis = updateCall.data.diagnosis;
      expect(savedDiagnosis.investigationLog).toHaveLength(1);
      expect(savedDiagnosis.investigationLog[0].toolName).toBe('read_file');
      expect(savedDiagnosis.investigationLog[0].summary).toContain('src/auth/auth.middleware.ts');
    });
  });

  describe('getDiagnosis', () => {
    it('returns Diagnosis when field is set', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        diagnosis: mockDiagnosis,
      });

      const result = await service.getDiagnosis('ticket-123');

      expect(result).toEqual(mockDiagnosis);
      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        select: { diagnosis: true },
      });
    });

    it('returns null when diagnosis field is empty', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({
        diagnosis: null,
      });

      const result = await service.getDiagnosis('ticket-123');

      expect(result).toBeNull();
    });

    it('returns null when ticket does not exist', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getDiagnosis('ticket-999');

      expect(result).toBeNull();
    });
  });

  describe('extractDiagnosisFromToolCalls', () => {
    it('returns last update_diagnosis call result', () => {
      const toolCallLog: ToolCallResult[] = [
        {
          toolCallId: 'tool-1',
          name: 'read_file',
          input: { file_path: 'src/auth.ts' },
          result: 'content',
          durationMs: 100,
        },
        {
          toolCallId: 'tool-2',
          name: 'update_diagnosis',
          input: {
            root_cause: 'First diagnosis',
            confidence: 0.5,
            affected_files: [],
          },
          result: { status: 'diagnosis_updated' },
          durationMs: 10,
        },
        {
          toolCallId: 'tool-3',
          name: 'update_diagnosis',
          input: {
            root_cause: 'Final diagnosis — null check missing',
            confidence: 0.9,
            affected_files: [
              {
                file_path: 'src/auth.ts',
                relevance: 'primary',
                description: 'Missing null check',
              },
            ],
            suggested_fix: 'Add null check',
          },
          result: { status: 'diagnosis_updated' },
          durationMs: 10,
        },
      ];

      const result = service.extractDiagnosisFromToolCalls(toolCallLog);

      expect(result).not.toBeNull();
      expect(result?.rootCause).toBe('Final diagnosis — null check missing');
      expect(result?.confidence).toBe(0.9);
      expect(result?.affectedFiles).toHaveLength(1);
      expect(result?.suggestedFix).toBe('Add null check');
    });

    it('returns null when no update_diagnosis in toolCallLog', () => {
      const toolCallLog: ToolCallResult[] = [
        {
          toolCallId: 'tool-1',
          name: 'read_file',
          input: { file_path: 'src/auth.ts' },
          result: 'content',
          durationMs: 100,
        },
        {
          toolCallId: 'tool-2',
          name: 'search_code',
          input: { query: 'token' },
          result: [],
          durationMs: 50,
        },
      ];

      const result = service.extractDiagnosisFromToolCalls(toolCallLog);

      expect(result).toBeNull();
    });

    it('handles empty toolCallLog', () => {
      const result = service.extractDiagnosisFromToolCalls([]);

      expect(result).toBeNull();
    });

    it('returns null when update_diagnosis input is missing required fields', () => {
      const toolCallLog: ToolCallResult[] = [
        {
          toolCallId: 'tool-1',
          name: 'update_diagnosis',
          input: {
            // Missing root_cause and confidence
            affected_files: [],
          },
          result: {},
          durationMs: 10,
        },
      ];

      const result = service.extractDiagnosisFromToolCalls(toolCallLog);

      expect(result).toBeNull();
    });

    it('handles missing affected_files gracefully', () => {
      const toolCallLog: ToolCallResult[] = [
        {
          toolCallId: 'tool-1',
          name: 'update_diagnosis',
          input: {
            root_cause: 'Simple bug',
            confidence: 0.7,
            // No affected_files
          },
          result: {},
          durationMs: 10,
        },
      ];

      const result = service.extractDiagnosisFromToolCalls(toolCallLog);

      expect(result).not.toBeNull();
      expect(result?.rootCause).toBe('Simple bug');
      expect(result?.affectedFiles).toEqual([]);
    });
  });
});
