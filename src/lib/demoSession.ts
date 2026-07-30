/**
 * Stand-in for real auth. Access to a customer account is only ever handed
 * out by the school after a first booking — there is no public signup/login
 * yet, so the whole app runs as this one seeded demo customer until
 * Supabase Auth replaces this file.
 */
export const DEMO_CUSTOMER_ID = "user-lisa";
export const DEMO_INSTRUCTOR_ID = "user-merlin";
export const DEMO_ADMIN_ID = "user-admin";
