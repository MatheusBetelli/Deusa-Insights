export interface DashboardSummary {
  potentialClients: number;
  activeClients: number;
  inactiveClients: number;
  criticalOpportunities: number;
  monitoredCities: number;
  monitoredCnaes: number;
  priorityCity: string | null;
  priorityCnae: string | null;
}
