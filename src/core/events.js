// Tiny event bus.
export class Emitter {
  constructor() { this.handlers = new Map(); }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }
  emit(type, data) {
    this.handlers.get(type)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(`[event ${type}]`, e); }
    });
  }
}

export const bus = new Emitter();
