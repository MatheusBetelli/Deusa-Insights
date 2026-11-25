export type Cnae = {
  id: string;
  code: string;
  description: string;
  category: string | null;
  isTarget: boolean;
  companyCount?: number;
  createdAt: string;
  updatedAt: string;
};
