import test from "node:test";
import assert from "node:assert/strict";
import { leadsService } from "./leadsService";

test("leadsService - declara todos os métodos de integração de leads", () => {
  assert.equal(typeof leadsService.getLeads, "function");
  assert.equal(typeof leadsService.getLeadsPage, "function");
  assert.equal(typeof leadsService.getLead, "function");
  assert.equal(typeof leadsService.updateLead, "function");
  assert.equal(typeof leadsService.convertLead, "function");
  assert.equal(typeof leadsService.discardLead, "function");
  assert.equal(typeof leadsService.getInteractions, "function");
  assert.equal(typeof leadsService.createInteraction, "function");
  assert.equal(typeof leadsService.autoAssignTerritory, "function");
  assert.equal(typeof leadsService.exportCsv, "function");
});
