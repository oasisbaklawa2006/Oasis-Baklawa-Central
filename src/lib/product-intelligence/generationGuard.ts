/** Tracks overlapping async work; only the latest generation should commit UI state. */
export function createGenerationGuard() {
  let generation = 0;

  return {
    start(): number {
      generation += 1;
      return generation;
    },
    isLatest(id: number): boolean {
      return id === generation;
    },
  };
}
