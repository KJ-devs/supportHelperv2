# GitHub Sync Worker Tests (US-217)

## Files
- `apps/worker/src/workers/__tests__/github-sync.worker.spec.ts` (28 tests, new)
- `apps/worker/src/workers/__tests__/integration-sync.worker.spec.ts` (27 tests, +8 added)

## Key Patterns

### ESM Mock for @octokit/rest
`@octokit/rest` v21 is ESM-only; ts-jest cannot parse it directly. Must mock at module level:
```ts
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    issues: { listForRepo: jest.fn(), create: jest.fn(), ... },
  })),
}));
```
Place the `jest.mock()` call BEFORE all imports.

### GithubSyncWorker Test Strategy
- Mock `GithubService` entirely (not `Octokit`) — the worker only depends on GithubService methods
- Mock `PrismaService` with all needed models: `githubConnection`, `ticket`, `githubIssue`
- `GithubSyncWorker.process()` returns `{ success: false, error: ... }` on failure (never throws)
- Worker events (`onActive`, `onCompleted`, `onFailed`) are public methods — call directly in tests

### Worker Event Testing Pattern
```ts
it('onFailed with max attempts → DLQ', async () => {
  jest.spyOn(worker['logger'], 'error').mockImplementation(() => undefined);
  const job = mockJob(data, 4, { attempts: 4 }); // attemptsMade >= maxAttempts
  await worker.onFailed(job, new Error('...'));
  expect(deadLetterQueue.add).toHaveBeenCalledWith('failed-github-sync', expect.objectContaining({
    queueName: QUEUE_NAMES.GITHUB_SYNC,
    attemptsMade: 4,
  }), ...);
});
```

### Retry Backoff Testing Pattern
Access private method via cast:
```ts
const w = worker as unknown as { getNextRetryDelay: (n: number) => number };
expect(w.getNextRetryDelay(0)).toBe(60 * 1000);   // 1 min
expect(w.getNextRetryDelay(3)).toBe(60 * 60 * 1000); // 1 hr (capped)
```

### IntegrationSyncWorker mockJob Extension
Updated signature to accept opts for worker event tests:
```ts
const mockJob = (data, attemptsMade = 0, opts = { attempts: 4 }): Job => ({
  id: 'job-123', data, attemptsMade, opts,
} as unknown as Job<IntegrationSyncJobData>);
```
Prisma mock also needs `ticket.create` and `integrationSyncLog.findMany` for pull-tickets tests.

### Invalid Decryption Key Test (AC5)
Encrypt with keyA, try to decrypt with keyB (worker key):
```ts
const keyA = parseEncryptionKey('aaa...bbb'); // different key
const { ciphertext, iv } = encryptAES256GCM(JSON.stringify(config), keyA);
// worker uses 0123...abcd key → decryption throws "Unsupported state or unable to authenticate data"
await expect(worker.process(job)).rejects.toThrow();
expect(mockProvider.syncTicket).not.toHaveBeenCalled();
```

## Acceptance Criteria Mapping
- AC1: `create-issue` flow, issue body with AI summary/env, auto-labels, success result
- AC2: 401/403/missing connection → `{ success: false, error: ... }`
- AC3: 429 rate limit → `{ success: false }`, backoff delay verification
- AC4: `onActive`/`onCompleted`/`onFailed` events, DLQ on maxAttempts
- AC5: Wrong decryption key throws, corrupted IV throws (in integration-sync tests)
- AC6: `enabled: false` → throws (integration-sync), connection not found → failure (github-sync)
