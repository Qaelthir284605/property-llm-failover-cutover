import { z } from "zod";

export const PropertyCaseSchema = z.object({
  requestId: z.string().min(1),
  tenantId: z.string().min(1),
  propertyId: z.string().min(1),
  kind: z.enum(["maintenance_request", "tenant_document", "inspection_reminder"]),
  text: z.string().min(20),
  receivedAt: z.string().datetime(),
  containsSensitiveHealthInfo: z.boolean().default(false)
});

export type PropertyCaseInput = z.infer<typeof PropertyCaseSchema>;

export type PropertyDecision = {
  route: "maintenance_queue" | "document_review" | "inspection_outreach";
  priority: "low" | "normal" | "high" | "urgent";
  tenantMessage: string;
  summary: string;
  followUpDays: number;
  usedFallback: boolean;
};

export function parsePropertyCase(input: unknown): PropertyCaseInput {
  return PropertyCaseSchema.parse(input);
}

export function fallbackDecision(input: PropertyCaseInput): PropertyDecision {
  const text = input.text.toLowerCase();

  if (input.kind === "maintenance_request") {
    const urgent = /(gas|smell of gas|flood|flooding|sparking|no heat|smoke|fire|leak through ceiling|burst pipe)/.test(text);
    return {
      route: "maintenance_queue",
      priority: urgent ? "urgent" : "high",
      tenantMessage: urgent
        ? "We marked this as urgent and sent it to the on-call maintenance queue. If there is immediate danger, call emergency services."
        : "We logged the repair request and sent it to the maintenance queue.",
      summary: urgent ? "Urgent maintenance issue needs same-day review." : "Maintenance issue queued for review.",
      followUpDays: urgent ? 0 : 2,
      usedFallback: true
    };
  }

  if (input.kind === "tenant_document") {
    const identity = /(passport|driver'?s license|id card|insurance|bank statement|medical|pay stub)/.test(text);
    return {
      route: "document_review",
      priority: identity ? "high" : "normal",
      tenantMessage: input.containsSensitiveHealthInfo
        ? "We received the document and limited handling to the review queue."
        : "We received the document and sent it for review.",
      summary: identity ? "Document likely contains identity or financial material." : "Tenant document sent for standard review.",
      followUpDays: 1,
      usedFallback: true
    };
  }

  const missed = /(overdue|missed|past due|tomorrow|today)/.test(text);
  return {
    route: "inspection_outreach",
    priority: missed ? "high" : "normal",
    tenantMessage: "We prepared an inspection reminder for outreach.",
    summary: missed ? "Inspection reminder needs prompt outreach." : "Inspection reminder queued.",
    followUpDays: missed ? 0 : 3,
    usedFallback: true
  };
}
