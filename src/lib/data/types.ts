export type Role = "CUSTOMER" | "INSTRUCTOR" | "ADMIN";
export type CourseCategory = "GROUP_CAMP" | "PRIVATE_HOURS";
export type SlotStatus = "OPEN" | "BOOKED" | "CANCELLED" | "COMPLETED";
export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type WindowStatus = "OPEN" | "CLAIMED" | "FULL";

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone?: string;
  isIkoInstructor?: boolean;
}

export interface CourseOffering {
  id: string;
  name: string;
  category: CourseCategory;
  description: string;
  durationHours?: number;
  minGroupSize?: number;
  maxGroupSize?: number;
  packageHours?: number;
  priceCents: number;
  pricePerHourCents?: number;
  includesEquipment: boolean;
  includesIko: boolean;
  active: boolean;
}

export interface AvailabilityWindow {
  id: string;
  startsAt: string;
  endsAt: string;
  courseCategory?: CourseCategory;
  status: WindowStatus;
  createdByAdminId: string;
}

export interface Slot {
  id: string;
  courseOfferingId: string;
  availabilityWindowId?: string;
  instructorId?: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookedCount: number;
  priceCentsOverride?: number;
  status: SlotStatus;
}

export interface HourPackagePurchase {
  id: string;
  customerId: string;
  courseOfferingId: string;
  totalHours: number;
  hoursScheduled: number;
  hoursCompleted: number;
  purchasedAt: string;
  expiresAt?: string;
}

export interface Booking {
  id: string;
  customerId: string;
  slotId: string;
  hourPackagePurchaseId?: string;
  seats: number;
  status: BookingStatus;
  priceCentsPaid?: number;
  paymentStatus: string;
  notes?: string;
  rating?: number;
  createdAt: string;
  cancelledAt?: string;
}

export type VideoCategory =
  | "Sicherheit & Material"
  | "Wasserstart"
  | "Bodydrag"
  | "Erste Fahrversuche"
  | "Tricks & Fortgeschritten"
  | "Wind- & Wetterkunde";

export interface Video {
  id: string;
  title: string;
  category: VideoCategory;
  duration: string;
  image: string;
  description: string;
}

export interface Notification {
  id: string;
  customerId: string;
  icon: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export interface WatchedVideo {
  customerId: string;
  videoId: string;
}

export interface InstructorSlotRequest {
  id: string;
  instructorId: string;
  courseOfferingId: string;
  requestedStartsAt: string;
  requestedEndsAt: string;
  status: RequestStatus;
  adminNote?: string;
  resolvedAt?: string;
  resolvedByAdminId?: string;
  resultingSlotId?: string;
  createdAt: string;
  updatedAt: string;
}

export type PackageRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "DATE_PROPOSED";

export interface PackageRequest {
  id: string;
  customerId: string;
  customerEmail: string;
  courseOfferingId: string;
  requestedDate: string;
  proposedDate?: string;
  note?: string;
  status: PackageRequestStatus;
  adminNote?: string;
  resolvedAt?: string;
  createdAt: string;
}
