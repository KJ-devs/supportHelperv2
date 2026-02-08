import type { WidgetState, WidgetAction } from './widget-types';

type TransitionMap = Partial<Record<WidgetAction, WidgetState>>;

const TRANSITIONS: Record<WidgetState, TransitionMap> = {
  idle: {
    OPEN: 'open',
  },
  open: {
    CLOSE: 'idle',
    START: 'recording',
  },
  recording: {
    STOP: 'preview',
    CLOSE: 'idle',
  },
  preview: {
    ACCEPT: 'editing',
    RE_RECORD: 'open',
    CLOSE: 'idle',
  },
  editing: {
    SUBMIT: 'submitting',
    RE_RECORD: 'open',
    CLOSE: 'idle',
  },
  submitting: {
    SUCCESS: 'success',
    ERROR: 'error',
  },
  success: {
    CLOSE: 'idle',
    RESET: 'open',
  },
  error: {
    CLOSE: 'idle',
    RESET: 'open',
    SUBMIT: 'submitting',
  },
};

export type StateChangeListener = (newState: WidgetState, previousState: WidgetState) => void;

export class WidgetStateMachine {
  private state: WidgetState = 'idle';
  private listeners: StateChangeListener[] = [];

  getState(): WidgetState {
    return this.state;
  }

  canTransition(action: WidgetAction): boolean {
    const transitions = TRANSITIONS[this.state];
    return transitions !== undefined && action in transitions;
  }

  dispatch(action: WidgetAction): WidgetState {
    const transitions = TRANSITIONS[this.state];
    const nextState = transitions?.[action];

    if (!nextState) {
      console.warn(`[SupportHelper] Invalid transition: ${this.state} + ${action}`);
      return this.state;
    }

    const prev = this.state;
    this.state = nextState;

    for (const listener of this.listeners) {
      listener(nextState, prev);
    }

    return this.state;
  }

  onChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  reset(): void {
    const prev = this.state;
    this.state = 'idle';
    if (prev !== 'idle') {
      for (const listener of this.listeners) {
        listener('idle', prev);
      }
    }
  }
}
