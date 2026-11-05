export interface DomainEvent<T> {
  eventId: string;
  eventName: string;
  version: number;
  timestamp: number;
  payload: T;
}

type Handler<T = unknown> = (event: DomainEvent<T>) => void;

export class EventBus {
  private eventSequence = 0;
  private readonly handlers = new Map<string, Set<Handler>>();

  on<T>(eventName: string, handler: Handler<T>): () => void {
    const listeners = this.handlers.get(eventName) ?? new Set<Handler>();
    listeners.add(handler as Handler);
    this.handlers.set(eventName, listeners);
    return () => this.off(eventName, handler);
  }

  off<T>(eventName: string, handler: Handler<T>): void {
    const listeners = this.handlers.get(eventName);
    if (!listeners) return;
    listeners.delete(handler as Handler);
    if (listeners.size === 0) this.handlers.delete(eventName);
  }

  emit<T>(eventName: string, payload: T, version = 1): void {
    const event: DomainEvent<T> = {
      eventId: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `evt-${Date.now()}-${++this.eventSequence}`,
      eventName,
      version,
      timestamp: Date.now(),
      payload
    };
    const listeners = this.handlers.get(eventName);
    if (!listeners) return;
    for (const handler of [...listeners]) handler(event);
  }
}
