import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW Worker for Browser (Development/Storybook)
 *
 * This worker intercepts HTTP requests in the browser.
 * Useful for development and Storybook stories.
 */
export const worker = setupWorker(...handlers);
