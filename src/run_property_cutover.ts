import { parsePropertyCase } from "./property_intake.js";
import { PropertyFailoverService } from "./property_failover_service.js";

async function main(): Promise<void> {
  const input = parsePropertyCase({
    requestId: "req-maint-1001",
    tenantId: "tenant-44",
    propertyId: "property-9",
    kind: "maintenance_request",
    text: "There is a smell of gas near the stove and the tenant reports dizziness. Please send someone now.",
    receivedAt: "2026-01-15T10:30:00.000Z",
    containsSensitiveHealthInfo: true
  });

  const service = new PropertyFailoverService();
  const decision = await service.triage(input);

  console.log(JSON.stringify({ input, decision }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
