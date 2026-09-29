import test from "node:test";
import assert from "node:assert/strict";
import { fallbackDecision, parsePropertyCase } from "../src/property_intake.js";

test("urgent gas leak routes to maintenance queue with urgent priority", () => {
  const input = parsePropertyCase({
    requestId: "req-test-1",
    tenantId: "tenant-11",
    propertyId: "property-2",
    kind: "maintenance_request",
    text: "Tenant reports smell of gas in the kitchen and feels lightheaded.",
    receivedAt: "2026-02-01T08:00:00.000Z",
    containsSensitiveHealthInfo: true
  });

  const result = fallbackDecision(input);

  assert.equal(result.route, "maintenance_queue");
  assert.equal(result.priority, "urgent");
  assert.equal(result.followUpDays, 0);
  assert.equal(result.usedFallback, true);
});
