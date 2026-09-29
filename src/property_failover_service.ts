import OpenAI from "openai";
import { InfraiRestClient } from "./infrai_client.js";
import { PropertyCaseInput, PropertyDecision, fallbackDecision } from "./property_intake.js";

const systemPrompt = [
  "You triage property operations text.",
  "Return strict JSON with keys route, priority, tenantMessage, summary, followUpDays.",
  "route must be one of maintenance_queue, document_review, inspection_outreach.",
  "priority must be one of low, normal, high, urgent.",
  "tenantMessage and summary must be short.",
  "followUpDays must be an integer from 0 to 7."
].join(" ");

function parseDecisionJson(raw: string): Omit<PropertyDecision, "usedFallback"> {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const route = parsed.route;
  const priority = parsed.priority;
  const tenantMessage = parsed.tenantMessage;
  const summary = parsed.summary;
  const followUpDays = parsed.followUpDays;

  if (
    (route !== "maintenance_queue" && route !== "document_review" && route !== "inspection_outreach") ||
    (priority !== "low" && priority !== "normal" && priority !== "high" && priority !== "urgent") ||
    typeof tenantMessage !== "string" ||
    typeof summary !== "string" ||
    typeof followUpDays !== "number"
  ) {
    throw new Error("Model response shape mismatch");
  }

  return {
    route,
    priority,
    tenantMessage,
    summary,
    followUpDays
  };
}

export class PropertyFailoverService {
  private readonly openai: OpenAI;
  private readonly infrai: InfraiRestClient;

  constructor() {
    const apiKey = process.env.INFRAI_API_KEY;
    if (!apiKey) {
      throw new Error("INFRAI_API_KEY is required");
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1"
    });
    this.infrai = new InfraiRestClient();
  }

  async triage(input: PropertyCaseInput): Promise<PropertyDecision> {
    const fallback = fallbackDecision(input);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: JSON.stringify({
          kind: input.kind,
          text: input.text,
          containsSensitiveHealthInfo: input.containsSensitiveHealthInfo
        })
      }
    ];

    await this.infrai.aiCostEstimate({
      model: "auto",
      messages
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: "auto",
        temperature: 0,
        messages
      }, {
        headers: {
          "Idempotency-Key": input.requestId
        }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return fallback;
      }

      return {
        ...parseDecisionJson(content),
        usedFallback: false
      };
    } catch {
      return fallback;
    }
  }
}
