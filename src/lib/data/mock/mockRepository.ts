import type {
  AvailabilityWindow,
  Booking,
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
  WatchedVideo,
} from "../types";
import type {
  BookHourSlotInput,
  CreateBookingInput,
  CreateInstructorRequestInput,
  CreatePackageRequestInput,
  CreateWindowInput,
  Repository,
  SlotFilter,
} from "../repository";
import { loadCollection, newId, saveCollection } from "./storage";
import {
  seedBookings,
  seedCourses,
  seedNotifications,
  seedPackageRequests,
  seedPackages,
  seedRequests,
  seedSlots,
  seedUsers,
  seedVideos,
  seedWatchedVideos,
  seedWindows,
} from "./seed";

const KEYS = {
  courses: "letsfly.courses",
  users: "letsfly.users",
  windows: "letsfly.windows",
  slots: "letsfly.slots",
  packages: "letsfly.packages",
  bookings: "letsfly.bookings",
  requests: "letsfly.requests",
  videos: "letsfly.videos",
  watchedVideos: "letsfly.watchedVideos",
  notifications: "letsfly.notifications",
  packageRequests: "letsfly.packageRequests",
};

function getCourses(): CourseOffering[] {
  return loadCollection(KEYS.courses, seedCourses);
}
function getUsers(): User[] {
  return loadCollection(KEYS.users, seedUsers);
}
function getWindows(): AvailabilityWindow[] {
  return loadCollection(KEYS.windows, seedWindows);
}
function getSlotsRaw(): Slot[] {
  return loadCollection(KEYS.slots, seedSlots);
}
function getPackages(): HourPackagePurchase[] {
  return loadCollection(KEYS.packages, seedPackages);
}
function getBookings(): Booking[] {
  return loadCollection(KEYS.bookings, seedBookings);
}
function getRequests(): InstructorSlotRequest[] {
  return loadCollection(KEYS.requests, seedRequests);
}
function getVideosRaw(): Video[] {
  return loadCollection(KEYS.videos, seedVideos);
}
function getWatchedVideos(): WatchedVideo[] {
  return loadCollection(KEYS.watchedVideos, seedWatchedVideos);
}
function getNotificationsRaw(): Notification[] {
  return loadCollection(KEYS.notifications, seedNotifications);
}
function getPackageRequestsRaw(): PackageRequest[] {
  return loadCollection(KEYS.packageRequests, seedPackageRequests);
}

export const mockRepository: Repository = {
  async getCourses() {
    return getCourses().filter((c) => c.active);
  },

  async getSlots(filter?: SlotFilter) {
    let slots = getSlotsRaw();
    if (filter?.category) {
      const courseIds = new Set(
        getCourses()
          .filter((c) => c.category === filter.category)
          .map((c) => c.id)
      );
      slots = slots.filter((s) => courseIds.has(s.courseOfferingId));
    }
    if (filter?.from) slots = slots.filter((s) => s.startsAt >= filter.from!);
    if (filter?.to) slots = slots.filter((s) => s.startsAt <= filter.to!);
    return slots;
  },

  async getCustomer(id: string) {
    return getUsers().find((u) => u.id === id) ?? null;
  },

  async getMyBookings(customerId: string) {
    return getBookings().filter((b) => b.customerId === customerId);
  },

  async getMyPackages(customerId: string) {
    return getPackages().filter((p) => p.customerId === customerId);
  },

  async createBooking(input: CreateBookingInput) {
    const slots = getSlotsRaw();
    const slot = slots.find((s) => s.id === input.slotId);
    if (!slot) throw new Error(`Slot ${input.slotId} not found`);
    const seats = input.seats ?? 1;
    if (slot.bookedCount + seats > slot.capacity) {
      throw new Error("Slot ist bereits ausgebucht");
    }

    const updatedSlot: Slot = {
      ...slot,
      bookedCount: slot.bookedCount + seats,
    };
    updatedSlot.status = updatedSlot.bookedCount >= updatedSlot.capacity ? "BOOKED" : "OPEN";
    saveCollection(
      KEYS.slots,
      slots.map((s) => (s.id === slot.id ? updatedSlot : s))
    );

    const booking: Booking = {
      id: newId("booking"),
      customerId: input.customerId,
      slotId: input.slotId,
      hourPackagePurchaseId: input.hourPackagePurchaseId,
      seats,
      status: "CONFIRMED",
      paymentStatus: "UNPAID",
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };
    saveCollection(KEYS.bookings, [booking, ...getBookings()]);

    if (input.hourPackagePurchaseId) {
      const packages = getPackages();
      saveCollection(
        KEYS.packages,
        packages.map((p) =>
          p.id === input.hourPackagePurchaseId
            ? { ...p, hoursScheduled: p.hoursScheduled + seats }
            : p
        )
      );
    }

    return booking;
  },

  async bookHourSlot(input: BookHourSlotInput) {
    const slots = getSlotsRaw();
    let slot = slots.find(
      (s) => s.courseOfferingId === input.courseOfferingId && s.startsAt === input.startsAt
    );
    if (!slot) {
      slot = {
        id: newId("slot"),
        courseOfferingId: input.courseOfferingId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        capacity: 1,
        bookedCount: 0,
        status: "OPEN",
      };
      saveCollection(KEYS.slots, [slot, ...slots]);
    } else if (slot.bookedCount >= slot.capacity) {
      throw new Error("Dieser Termin ist bereits vergeben");
    }
    return this.createBooking({
      customerId: input.customerId,
      slotId: slot.id,
      hourPackagePurchaseId: input.hourPackagePurchaseId,
    });
  },

  async cancelBooking(bookingId: string) {
    const bookings = getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);

    saveCollection(
      KEYS.bookings,
      bookings.map((b) =>
        b.id === bookingId
          ? { ...b, status: "CANCELLED" as const, cancelledAt: new Date().toISOString() }
          : b
      )
    );

    const slots = getSlotsRaw();
    const slot = slots.find((s) => s.id === booking.slotId);
    if (slot) {
      const bookedCount = Math.max(0, slot.bookedCount - booking.seats);
      saveCollection(
        KEYS.slots,
        slots.map((s) =>
          s.id === slot.id ? { ...s, bookedCount, status: "OPEN" as const } : s
        )
      );
    }

    if (booking.hourPackagePurchaseId) {
      const packages = getPackages();
      saveCollection(
        KEYS.packages,
        packages.map((p) =>
          p.id === booking.hourPackagePurchaseId
            ? { ...p, hoursScheduled: Math.max(0, p.hoursScheduled - booking.seats) }
            : p
        )
      );
    }
  },

  async getAvailabilityWindows() {
    return getWindows();
  },

  async getMySlots(instructorId: string) {
    return getSlotsRaw().filter((s) => s.instructorId === instructorId);
  },

  async claimSlot(slotId: string, instructorId: string) {
    const slots = getSlotsRaw();
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) throw new Error(`Slot ${slotId} not found`);
    if (slot.instructorId) throw new Error("Slot ist bereits einem Lehrer zugeteilt");
    if (slot.status !== "OPEN") throw new Error("Slot ist nicht mehr offen");

    const updated: Slot = { ...slot, instructorId };
    saveCollection(
      KEYS.slots,
      slots.map((s) => (s.id === slotId ? updated : s))
    );
    return updated;
  },

  async createInstructorRequest(input: CreateInstructorRequestInput) {
    const request: InstructorSlotRequest = {
      id: newId("request"),
      instructorId: input.instructorId,
      courseOfferingId: input.courseOfferingId,
      requestedStartsAt: input.requestedStartsAt,
      requestedEndsAt: input.requestedEndsAt,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveCollection(KEYS.requests, [request, ...getRequests()]);
    return request;
  },

  async getMyRequests(instructorId: string) {
    return getRequests().filter((r) => r.instructorId === instructorId);
  },

  async createWindow(input: CreateWindowInput) {
    const window: AvailabilityWindow = {
      id: newId("window"),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      courseCategory: input.courseCategory,
      status: "OPEN",
      createdByAdminId: input.createdByAdminId,
    };
    saveCollection(KEYS.windows, [window, ...getWindows()]);

    // Generate one open, unclaimed slot per matching course so instructors
    // have something to pick up in "Verfügbarkeit" — mirrors seedSlots'
    // relationship to seedWindows (window-1 -> slot-3/4/5).
    const coursesForWindow = getCourses().filter(
      (c) => c.active && (!input.courseCategory || c.category === input.courseCategory)
    );
    const newSlots: Slot[] = coursesForWindow.map((course) => {
      if (course.category === "GROUP_CAMP") {
        return {
          id: newId("slot"),
          courseOfferingId: course.id,
          availabilityWindowId: window.id,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          capacity: course.maxGroupSize ?? 4,
          bookedCount: 0,
          status: "OPEN",
        };
      }
      const slotEnd = new Date(window.startsAt);
      slotEnd.setHours(slotEnd.getHours() + 2);
      return {
        id: newId("slot"),
        courseOfferingId: course.id,
        availabilityWindowId: window.id,
        startsAt: window.startsAt,
        endsAt: slotEnd.toISOString(),
        capacity: 1,
        bookedCount: 0,
        status: "OPEN",
      };
    });
    if (newSlots.length > 0) {
      saveCollection(KEYS.slots, [...newSlots, ...getSlotsRaw()]);
    }

    return window;
  },

  async getAllRequests(status?: RequestStatus) {
    const requests = getRequests();
    return status ? requests.filter((r) => r.status === status) : requests;
  },

  async resolveRequest(requestId: string, decision: "APPROVED" | "REJECTED", adminNote?: string) {
    const requests = getRequests();
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error(`Request ${requestId} not found`);

    let resultingSlotId: string | undefined;
    if (decision === "APPROVED") {
      const slot: Slot = {
        id: newId("slot"),
        courseOfferingId: request.courseOfferingId,
        instructorId: request.instructorId,
        startsAt: request.requestedStartsAt,
        endsAt: request.requestedEndsAt,
        capacity: 1,
        bookedCount: 0,
        status: "OPEN",
      };
      saveCollection(KEYS.slots, [slot, ...getSlotsRaw()]);
      resultingSlotId = slot.id;
    }

    const updated: InstructorSlotRequest = {
      ...request,
      status: decision,
      adminNote,
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resultingSlotId,
    };
    saveCollection(
      KEYS.requests,
      requests.map((r) => (r.id === requestId ? updated : r))
    );
    return updated;
  },

  async getAllBookings() {
    return getBookings();
  },

  async getVideos() {
    return getVideosRaw();
  },

  async getWatchedVideoIds(customerId: string) {
    return getWatchedVideos()
      .filter((w) => w.customerId === customerId)
      .map((w) => w.videoId);
  },

  async markVideoWatched(customerId: string, videoId: string) {
    const watched = getWatchedVideos();
    if (watched.some((w) => w.customerId === customerId && w.videoId === videoId)) return;
    saveCollection(KEYS.watchedVideos, [...watched, { customerId, videoId }]);
  },

  async getNotifications(customerId: string) {
    return getNotificationsRaw()
      .filter((n) => n.customerId === customerId)
      .sort((a, b) => b.id.localeCompare(a.id));
  },

  async markNotificationRead(notificationId: string) {
    const notifications = getNotificationsRaw();
    saveCollection(
      KEYS.notifications,
      notifications.map((n) => (n.id === notificationId ? { ...n, unread: false } : n))
    );
  },

  async markAllNotificationsRead(customerId: string) {
    const notifications = getNotificationsRaw();
    saveCollection(
      KEYS.notifications,
      notifications.map((n) => (n.customerId === customerId ? { ...n, unread: false } : n))
    );
  },

  async createNotification(input: { customerId: string; icon: string; title: string; message: string }) {
    const notification: Notification = {
      id: newId("notif"),
      customerId: input.customerId,
      icon: input.icon,
      title: input.title,
      message: input.message,
      time: "Gerade eben",
      unread: true,
    };
    saveCollection(KEYS.notifications, [notification, ...getNotificationsRaw()]);
    return notification;
  },

  async getInstructors() {
    return getUsers().filter((u) => u.role === "INSTRUCTOR");
  },

  async createPackageRequest(input: CreatePackageRequestInput) {
    const customer = getUsers().find((u) => u.id === input.customerId);
    const request: PackageRequest = {
      id: newId("pkgreq"),
      customerId: input.customerId,
      customerEmail: customer?.email ?? "",
      courseOfferingId: input.courseOfferingId,
      requestedDate: input.requestedDate,
      note: input.note,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    saveCollection(KEYS.packageRequests, [request, ...getPackageRequestsRaw()]);
    return request;
  },

  async getMyPackageRequests(customerId: string) {
    return getPackageRequestsRaw().filter((r) => r.customerId === customerId);
  },

  async getAllPackageRequests(status?: PackageRequestStatus) {
    const requests = getPackageRequestsRaw();
    return status ? requests.filter((r) => r.status === status) : requests;
  },

  async resolvePackageRequest(requestId: string, decision: "APPROVED" | "REJECTED", adminNote?: string) {
    const requests = getPackageRequestsRaw();
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error(`Package request ${requestId} not found`);
    const updated: PackageRequest = {
      ...request,
      status: decision,
      adminNote,
      resolvedAt: new Date().toISOString(),
    };
    saveCollection(
      KEYS.packageRequests,
      requests.map((r) => (r.id === requestId ? updated : r))
    );
    await this.createNotification({
      customerId: request.customerId,
      icon: decision === "APPROVED" ? "✅" : "❌",
      title: decision === "APPROVED" ? "Anfrage bestätigt" : "Anfrage abgelehnt",
      message:
        decision === "APPROVED"
          ? `Deine Anfrage für ${new Date(request.requestedDate).toLocaleDateString("de-DE")} wurde bestätigt.`
          : `Deine Anfrage für ${new Date(request.requestedDate).toLocaleDateString("de-DE")} wurde leider abgelehnt.`,
    });
    return updated;
  },

  async proposeAlternativeDate(requestId: string, proposedDate: string, adminNote?: string) {
    const requests = getPackageRequestsRaw();
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error(`Package request ${requestId} not found`);
    const updated: PackageRequest = {
      ...request,
      status: "DATE_PROPOSED",
      proposedDate,
      adminNote,
    };
    saveCollection(
      KEYS.packageRequests,
      requests.map((r) => (r.id === requestId ? updated : r))
    );
    await this.createNotification({
      customerId: request.customerId,
      icon: "🗓️",
      title: "Neuer Terminvorschlag",
      message: `Die Schule schlägt für deine Anfrage den ${new Date(proposedDate).toLocaleDateString("de-DE")} vor.`,
    });
    return updated;
  },

  async respondToProposedDate(requestId: string, accept: boolean) {
    const requests = getPackageRequestsRaw();
    const request = requests.find((r) => r.id === requestId);
    if (!request) throw new Error(`Package request ${requestId} not found`);
    const updated: PackageRequest = {
      ...request,
      status: accept ? "APPROVED" : "REJECTED",
      requestedDate: accept && request.proposedDate ? request.proposedDate : request.requestedDate,
      resolvedAt: new Date().toISOString(),
    };
    saveCollection(
      KEYS.packageRequests,
      requests.map((r) => (r.id === requestId ? updated : r))
    );
    return updated;
  },

  async rateBooking(bookingId: string, rating: number) {
    const bookings = getBookings();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);
    const updated: Booking = { ...booking, rating };
    saveCollection(
      KEYS.bookings,
      bookings.map((b) => (b.id === bookingId ? updated : b))
    );
    return updated;
  },
};
