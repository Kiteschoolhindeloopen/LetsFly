import type {
  AvailabilityWindow,
  Booking,
  CourseOffering,
  HourPackagePurchase,
  InstructorSlotRequest,
  Notification,
  PackageRequest,
  Slot,
  User,
  Video,
} from "../types";

export interface ProfileRow {
  id: string;
  email: string;
  role: "CUSTOMER" | "INSTRUCTOR" | "ADMIN";
  name: string;
  phone: string | null;
  is_iko_instructor: boolean;
}

export interface CourseRow {
  id: string;
  name: string;
  category: "GROUP_CAMP" | "PRIVATE_HOURS";
  description: string;
  duration_hours: number | null;
  min_group_size: number | null;
  max_group_size: number | null;
  package_hours: number | null;
  price_cents: number;
  price_per_hour_cents: number | null;
  includes_equipment: boolean;
  includes_iko: boolean;
  active: boolean;
}

export interface WindowRow {
  id: string;
  starts_at: string;
  ends_at: string;
  course_category: "GROUP_CAMP" | "PRIVATE_HOURS" | null;
  status: "OPEN" | "CLAIMED" | "FULL";
  created_by_admin_id: string;
}

export interface SlotRow {
  id: string;
  course_offering_id: string;
  availability_window_id: string | null;
  instructor_id: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  price_cents_override: number | null;
  status: "OPEN" | "BOOKED" | "CANCELLED" | "COMPLETED";
}

export interface BookingRow {
  id: string;
  customer_id: string;
  slot_id: string;
  hour_package_purchase_id: string | null;
  seats: number;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  price_cents_paid: number | null;
  payment_status: string;
  notes: string | null;
  rating: number | null;
  created_at: string;
  cancelled_at: string | null;
  waiver_accepted_at: string | null;
}

export interface PackageRow {
  id: string;
  customer_id: string;
  course_offering_id: string;
  total_hours: number;
  hours_scheduled: number;
  hours_completed: number;
  purchased_at: string;
  expires_at: string | null;
}

export interface VideoRow {
  id: string;
  title: string;
  category: Video["category"];
  duration: string;
  image: string;
  description: string;
}

export interface NotificationRow {
  id: string;
  customer_id: string;
  icon: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export interface InstructorRequestRow {
  id: string;
  instructor_id: string;
  course_offering_id: string;
  requested_starts_at: string;
  requested_ends_at: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by_admin_id: string | null;
  resulting_slot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageRequestRow {
  id: string;
  customer_id: string;
  customer_email: string;
  course_offering_id: string;
  requested_date: string;
  proposed_date: string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DATE_PROPOSED";
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    phone: row.phone ?? undefined,
    isIkoInstructor: row.is_iko_instructor ?? undefined,
  };
}

export function mapCourse(row: CourseRow): CourseOffering {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    durationHours: row.duration_hours ?? undefined,
    minGroupSize: row.min_group_size ?? undefined,
    maxGroupSize: row.max_group_size ?? undefined,
    packageHours: row.package_hours ?? undefined,
    priceCents: row.price_cents,
    pricePerHourCents: row.price_per_hour_cents ?? undefined,
    includesEquipment: row.includes_equipment,
    includesIko: row.includes_iko,
    active: row.active,
  };
}

export function mapWindow(row: WindowRow): AvailabilityWindow {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    courseCategory: row.course_category ?? undefined,
    status: row.status,
    createdByAdminId: row.created_by_admin_id,
  };
}

export function mapSlot(row: SlotRow): Slot {
  return {
    id: row.id,
    courseOfferingId: row.course_offering_id,
    availabilityWindowId: row.availability_window_id ?? undefined,
    instructorId: row.instructor_id ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    bookedCount: row.booked_count,
    priceCentsOverride: row.price_cents_override ?? undefined,
    status: row.status,
  };
}

export function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    customerId: row.customer_id,
    slotId: row.slot_id,
    hourPackagePurchaseId: row.hour_package_purchase_id ?? undefined,
    seats: row.seats,
    status: row.status,
    priceCentsPaid: row.price_cents_paid ?? undefined,
    paymentStatus: row.payment_status,
    notes: row.notes ?? undefined,
    rating: row.rating ?? undefined,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at ?? undefined,
    waiverAcceptedAt: row.waiver_accepted_at ?? undefined,
  };
}

export function mapPackage(row: PackageRow): HourPackagePurchase {
  return {
    id: row.id,
    customerId: row.customer_id,
    courseOfferingId: row.course_offering_id,
    totalHours: row.total_hours,
    hoursScheduled: row.hours_scheduled,
    hoursCompleted: row.hours_completed,
    purchasedAt: row.purchased_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

export function mapVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    duration: row.duration,
    image: row.image,
    description: row.description,
  };
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    customerId: row.customer_id,
    icon: row.icon,
    title: row.title,
    message: row.message,
    time: row.time,
    unread: row.unread,
  };
}

export function mapInstructorRequest(row: InstructorRequestRow): InstructorSlotRequest {
  return {
    id: row.id,
    instructorId: row.instructor_id,
    courseOfferingId: row.course_offering_id,
    requestedStartsAt: row.requested_starts_at,
    requestedEndsAt: row.requested_ends_at,
    status: row.status,
    adminNote: row.admin_note ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedByAdminId: row.resolved_by_admin_id ?? undefined,
    resultingSlotId: row.resulting_slot_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPackageRequest(row: PackageRequestRow): PackageRequest {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerEmail: row.customer_email,
    courseOfferingId: row.course_offering_id,
    requestedDate: row.requested_date,
    proposedDate: row.proposed_date ?? undefined,
    note: row.note ?? undefined,
    status: row.status,
    adminNote: row.admin_note ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    createdAt: row.created_at,
  };
}
