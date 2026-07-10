export type UserRole = "ADMIN" | "MANAGER" | "SALES";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}
