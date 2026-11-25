export type CommercialActivity = {
  interactionId: string;
  leadId: string;
  companyId: string;
  companyName: string;
  city: string;
  type: string;
  description: string;
  createdAt: string;
  lastContactAt: string | null;
  nextContactAt: string | null;
  followUpCompletedAt: string | null;
  responsibleProfileId: string | null;
  responsibleName: string | null;
};

export type CommercialActivitiesQuery = {
  view?: "activities" | "followups";
  page?: number;
  pageSize?: number;
  company?: string;
  city?: string;
  type?: string;
  responsibleId?: string;
  dateFrom?: string;
  dateTo?: string;
};
