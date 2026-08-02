import type {
  AvailabilityWindow,
  Booking,
  CourseCategory,
  CourseOffering,
  HourPackagePurchase,
  InstructorSlotRequest,
  Notification,
  PackageRequest,
  PackageRequestStatus,
  RequestStatus,
  Slot,
  User,
  Video,
} from "./types";
import { supabaseRepository } from "./supabase/supabaseRepository";

export interface SlotFilter {
  category?: CourseCategory;
  from?: string;
  to?: string;
}

export interface CreateBookingInput {
  customerId: string;
  slotId: string;
  seats?: number;
  hourPackagePurchaseId?: string;
  notes?: string;
  waiverAccepted: boolean;
}

export interface BookHourSlotInput {
  customerId: string;
  courseOfferingId: string;
  hourPackagePurchaseId?: string;
  startsAt: string;
  endsAt: string;
  waiverAccepted: boolean;
}

export interface CreateInstructorRequestInput {
  instructorId: string;
  courseOfferingId: string;
  requestedStartsAt: string;
  requestedEndsAt: string;
}

export interface CreateWindowInput {
  startsAt: string;
  endsAt: string;
  courseCategory?: CourseCategory;
  createdByAdminId: string;
}

export interface CreatePackageRequestInput {
  customerId: string;
  courseOfferingId: string;
  requestedDate: string;
  note?: string;
}

/**
 * Single seam between UI and data. Swap `getRepository()`'s return value for
 * a Supabase-backed implementation later — callers never change.
 */
export interface Repository {
  getCourses(): Promise<CourseOffering[]>;
  getAllCourses(): Promise<CourseOffering[]>;
  updateCourse(
    courseId: string,
    updates: Partial<Pick<CourseOffering, "name" | "priceCents" | "active">>
  ): Promise<CourseOffering>;
  getSlots(filter?: SlotFilter): Promise<Slot[]>;

  getCustomer(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getMyBookings(customerId: string): Promise<Booking[]>;
  getMyPackages(customerId: string): Promise<HourPackagePurchase[]>;
  createBooking(input: CreateBookingInput): Promise<Booking>;
  bookHourSlot(input: BookHourSlotInput): Promise<Booking>;
  cancelBooking(bookingId: string): Promise<void>;

  getAvailabilityWindows(): Promise<AvailabilityWindow[]>;
  getMySlots(instructorId: string): Promise<Slot[]>;
  claimSlot(slotId: string, instructorId: string): Promise<Slot>;
  createInstructorRequest(input: CreateInstructorRequestInput): Promise<InstructorSlotRequest>;
  getMyRequests(instructorId: string): Promise<InstructorSlotRequest[]>;

  createWindow(input: CreateWindowInput): Promise<AvailabilityWindow>;
  getAllRequests(status?: RequestStatus): Promise<InstructorSlotRequest[]>;
  resolveRequest(
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    adminNote?: string
  ): Promise<InstructorSlotRequest>;
  getAllBookings(): Promise<Booking[]>;

  getVideos(): Promise<Video[]>;
  getWatchedVideoIds(customerId: string): Promise<string[]>;
  markVideoWatched(customerId: string, videoId: string): Promise<void>;

  getNotifications(customerId: string): Promise<Notification[]>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(customerId: string): Promise<void>;
  createNotification(input: { customerId: string; icon: string; title: string; message: string }): Promise<Notification>;

  rateBooking(bookingId: string, rating: number): Promise<Booking>;

  getInstructors(): Promise<User[]>;

  createPackageRequest(input: CreatePackageRequestInput): Promise<PackageRequest>;
  getMyPackageRequests(customerId: string): Promise<PackageRequest[]>;
  getAllPackageRequests(status?: PackageRequestStatus): Promise<PackageRequest[]>;
  resolvePackageRequest(
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    adminNote?: string
  ): Promise<PackageRequest>;
  proposeAlternativeDate(requestId: string, proposedDate: string, adminNote?: string): Promise<PackageRequest>;
  respondToProposedDate(requestId: string, accept: boolean): Promise<PackageRequest>;
}

export function getRepository(): Repository {
  return supabaseRepository;
}

export * from "./types";
