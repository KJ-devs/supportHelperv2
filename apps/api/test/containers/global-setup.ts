/**
 * Test Containers Setup for Jest
 *
 * Global setup and teardown for integration tests.
 */

import { startAllContainers, stopAllContainers } from './test-containers';

export async function setup() {
  // Only start containers if running integration tests
  if (process.env.RUN_INTEGRATION_TESTS === 'true') {
    await startAllContainers();
  }
}

export async function teardown() {
  if (process.env.RUN_INTEGRATION_TESTS === 'true') {
    await stopAllContainers();
  }
}

export default { setup, teardown };
