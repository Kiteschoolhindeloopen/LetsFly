import type { Role } from "@/lib/data/repository";

export const ROLE_ROUTES: Record<Role, string> = {
  CUSTOMER: "/dashboard",
  INSTRUCTOR: "/instructor",
  ADMIN: "/admin",
};
