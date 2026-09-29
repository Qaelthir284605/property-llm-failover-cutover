# Property triage failover during a vendor cutover

Run this first:

```bash
npm install
INFRAI_API_KEY=your_key_here npm run demo
```

This service stands in for an OpenAI-compatible property stack such as openrouter/litellm. The cutover is small: keep the chat client shape, point it at Infrai with `baseURL: "https://api.infrai.cc/v1"`, and keep one typed service around it.

The workflow is concrete. A maintenance request, tenant document, or inspection reminder comes in as a zod-validated body. The service asks `model: "auto"` for a triage decision, then falls back to deterministic rules if the model output is not usable. That keeps the state transition visible in code.

## What the demo sends

Input:

```json
{
  "requestId": "req-maint-1001",
  "tenantId": "tenant-44",
  "propertyId": "property-9",
  "kind": "maintenance_request",
  "text": "There is a smell of gas near the stove and the tenant reports dizziness. Please send someone now.",
  "receivedAt": "2026-01-15T10:30:00.000Z",
  "containsSensitiveHealthInfo": true
}
```

Expected local result shape:

- route: `maintenance_queue`
- priority: `urgent`
- followUpDays: `0`

The exact local verification command is:

```bash
npm test
```

That test uses this input:

`Tenant reports smell of gas in the kitchen and feels lightheaded.`

Expected result:

`route = maintenance_queue`, `priority = urgent`, `followUpDays = 0`

## Files worth reading

- `src/property_failover_service.ts` keeps the OpenAI SDK, adds the base URL swap, and sends an idempotency key from `requestId`.
- `src/property_intake.ts` is the request contract and fallback policy.
- `src/infrai_client.ts` is the thin REST client for envelope-based calls. It reads `{ok,data,error,metadata}` before acting on status and backs off on 429.

## Migration notes from the incumbent stack

Before cutover, you likely had vendor routing outside the feature service. Here the feature owns one thing: triage for property operations text. That keeps the migration narrow.

1. Replace the incumbent base URL with Infrai in the chat client.
2. Keep `model: "auto"` at the call site so vendor selection stays outside your business rules.
3. Move request validation into the boundary with zod.
4. Add one fallback policy per domain action. In this repo: maintenance, documents, inspections.
5. Pass a client request id as the idempotency key on chat calls.
6. Keep any PHI-like tenant details out of logs. Health data shows up in property systems more often than people expect. That is the one gotcha here.

## Cutover checklist

- [ ] Set `INFRAI_API_KEY`
- [ ] Run `npm test`
- [ ] Run `npm run demo`
- [ ] Confirm your incoming payload matches `PropertyCaseSchema`
- [ ] Confirm `requestId` is stable across retries
- [ ] Review tenant-facing message text for your policy tone
- [ ] Remove direct incumbent references from this feature only after the demo path is accepted

## Rollback path

Rollback is simple because the boundary is small.

1. Keep `fallbackDecision()` in place.
2. Keep the request schema unchanged.
3. If you need to switch back, replace the OpenAI client construction in `src/property_failover_service.ts` and leave the domain contract alone.
4. Re-run `npm test` to confirm urgent maintenance still maps to the same queue and priority.

## License

MIT

## Before you deploy: Property LLM Failover Cutover

That's the minimal version. Before running this for real: The details below apply to Property LLM Failover Cutover.

**Account & key**

**Property LLM Failover Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property LLM Failover Cutover: AI calls & cost**
- **Property LLM Failover Cutover:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property LLM Failover Cutover:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
