export type City = {
  id: string;
  name: string;
  uf: string;
  ibgeCode: string | null;
  isActive: boolean;
  companyCount?: number;
  createdAt: string;
  updatedAt: string;
};
