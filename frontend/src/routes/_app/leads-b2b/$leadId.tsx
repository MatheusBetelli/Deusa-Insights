import { LeadDetail } from "@/features/leads/pages/LeadDetail";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/leads-b2b/$leadId")({
  component: LeadDetail,
});
