/**
 * Stand-in for real auth. Access to a customer account is only ever handed
 * out by the school after a first booking — there is no public signup/login
 * yet, so the whole app runs as this one seeded demo customer until
 * Supabase Auth replaces this file.
 */
export const DEMO_CUSTOMER_ID = "user-lisa";
export const DEMO_INSTRUCTOR_ID = "user-merlin";
export const DEMO_ADMIN_ID = "user-admin";

const CUSTOMER_SESSION_KEY = "letsfly.currentCustomerId";
const INSTRUCTOR_SESSION_KEY = "letsfly.currentInstructorId";

/**
 * Login resolves the entered email to a seeded user and remembers it here,
 * per role, so switching between the Kunde/Lehrer prototype views (see
 * RoleSwitcher) doesn't clobber the other role's logged-in identity.
 */
export function setLoggedInUser(user: { id: string; role: "CUSTOMER" | "INSTRUCTOR" | "ADMIN" }) {
  if (typeof window === "undefined") return;
  if (user.role === "CUSTOMER") localStorage.setItem(CUSTOMER_SESSION_KEY, user.id);
  if (user.role === "INSTRUCTOR") localStorage.setItem(INSTRUCTOR_SESSION_KEY, user.id);
}

export function getCurrentCustomerId(): string {
  if (typeof window === "undefined") return DEMO_CUSTOMER_ID;
  return localStorage.getItem(CUSTOMER_SESSION_KEY) ?? DEMO_CUSTOMER_ID;
}

export function getCurrentInstructorId(): string {
  if (typeof window === "undefined") return DEMO_INSTRUCTOR_ID;
  return localStorage.getItem(INSTRUCTOR_SESSION_KEY) ?? DEMO_INSTRUCTOR_ID;
}
