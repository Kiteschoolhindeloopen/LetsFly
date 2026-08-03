import type { Repository } from "../repository";
import * as courses from "./courses";
import * as availability from "./availability";
import * as bookings from "./bookings";
import * as instructorRequests from "./instructorRequests";
import * as videos from "./videos";
import * as notifications from "./notifications";
import * as users from "./users";
import * as packageRequests from "./packageRequests";
import * as groupSessions from "./groupSessions";

export const supabaseRepository: Repository = {
  getCourses: courses.getCourses,
  getAllCourses: courses.getAllCourses,
  updateCourse: courses.updateCourse,

  getSlots: availability.getSlots,
  getAvailabilityWindows: availability.getAvailabilityWindows,
  getMySlots: availability.getMySlots,
  claimSlot: availability.claimSlot,
  createWindow: availability.createWindow,

  getCustomer: users.getCustomer,
  getUserByEmail: users.getUserByEmail,
  getInstructors: users.getInstructors,

  getMyBookings: bookings.getMyBookings,
  getMyPackages: bookings.getMyPackages,
  createBooking: bookings.createBooking,
  bookHourSlot: bookings.bookHourSlot,
  cancelBooking: bookings.cancelBooking,
  getAllBookings: bookings.getAllBookings,
  rateBooking: bookings.rateBooking,

  createInstructorRequest: instructorRequests.createInstructorRequest,
  getMyRequests: instructorRequests.getMyRequests,
  getAllRequests: instructorRequests.getAllRequests,
  resolveRequest: instructorRequests.resolveRequest,

  getVideos: videos.getVideos,
  getWatchedVideoIds: videos.getWatchedVideoIds,
  markVideoWatched: videos.markVideoWatched,

  getNotifications: notifications.getNotifications,
  markNotificationRead: notifications.markNotificationRead,
  markAllNotificationsRead: notifications.markAllNotificationsRead,
  createNotification: notifications.createNotification,

  createPackageRequest: packageRequests.createPackageRequest,
  getMyPackageRequests: packageRequests.getMyPackageRequests,
  getAllPackageRequests: packageRequests.getAllPackageRequests,
  resolvePackageRequest: packageRequests.resolvePackageRequest,
  proposeAlternativeDate: packageRequests.proposeAlternativeDate,
  respondToProposedDate: packageRequests.respondToProposedDate,

  getGroupSessions: groupSessions.getGroupSessions,
  createGroupSession: groupSessions.createGroupSession,
  getGroupSessionAssignments: groupSessions.getGroupSessionAssignments,
  assignCustomerToGroupSession: groupSessions.assignCustomerToGroupSession,
  cancelGroupSessionAssignment: groupSessions.cancelGroupSessionAssignment,
};
