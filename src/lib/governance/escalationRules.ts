export function defaultEscalationMessage(topic: string): string {
  return `Escalate ${topic} to CMD with written context — no auto-escalation jobs fire from this foundation.`;
}
