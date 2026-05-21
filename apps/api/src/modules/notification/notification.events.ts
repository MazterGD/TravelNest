import type { CreateNotificationInput } from "./notification.service.js";

/**
 * Canonical builders for every event-driven notification in the platform.
 *
 * Centralising the shape here is the single source of truth the audit asked
 * for: every booking / quotation / payment notification gets a consistent
 * `type`, `category`, deep-link `data` and trilingual `i18n` payload. Call
 * sites pass these straight to `dispatchNotification`.
 *
 * The English `title`/`message` double as the stored fallback; `i18n.*Key`
 * resolves against the `dashboard.notifications.events.*` namespace in the web
 * client for en/si/ta rendering.
 */

const ref = (id: string): string => `BK-${id.slice(0, 8).toUpperCase()}`;

// ----------------------------------------------------------------------------
// Booking events
// ----------------------------------------------------------------------------

export const bookingRequestedToOwner = (
  ownerId: string,
  p: { bookingId: string; route: string },
): CreateNotificationInput => ({
  userId: ownerId,
  type: "booking_requested",
  category: "Bookings",
  title: "New booking request",
  message: `A new booking request ${ref(p.bookingId)} was placed for ${p.route}.`,
  data: { bookingId: p.bookingId },
  i18n: {
    titleKey: "events.bookingRequested.title",
    messageKey: "events.bookingRequested.message",
    params: { reference: ref(p.bookingId), route: p.route },
  },
});

export const bookingPlacedToCustomer = (
  customerId: string,
  p: { bookingId: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "booking_placed",
  category: "Bookings",
  title: "Booking placed",
  message: `Your booking ${ref(p.bookingId)} is awaiting owner confirmation.`,
  data: { bookingId: p.bookingId },
  i18n: {
    titleKey: "events.bookingPlaced.title",
    messageKey: "events.bookingPlaced.message",
    params: { reference: ref(p.bookingId) },
  },
});

export const bookingConfirmedToCustomer = (
  customerId: string,
  p: { bookingId: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "booking_confirmed",
  category: "Bookings",
  title: "Booking confirmed",
  message: `Your booking ${ref(p.bookingId)} has been confirmed by the owner.`,
  data: { bookingId: p.bookingId },
  i18n: {
    titleKey: "events.bookingConfirmed.title",
    messageKey: "events.bookingConfirmed.message",
    params: { reference: ref(p.bookingId) },
  },
});

export const bookingRejectedToCustomer = (
  customerId: string,
  p: { bookingId: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "booking_rejected",
  category: "Bookings",
  title: "Booking declined",
  message: `Your booking ${ref(p.bookingId)} was declined by the owner.`,
  data: { bookingId: p.bookingId },
  i18n: {
    titleKey: "events.bookingRejected.title",
    messageKey: "events.bookingRejected.message",
    params: { reference: ref(p.bookingId) },
  },
});

export const bookingCancelledToOwner = (
  ownerId: string,
  p: { bookingId: string },
): CreateNotificationInput => ({
  userId: ownerId,
  type: "booking_cancelled",
  category: "Bookings",
  title: "Booking cancelled",
  message: `The customer cancelled booking ${ref(p.bookingId)}.`,
  data: { bookingId: p.bookingId },
  i18n: {
    titleKey: "events.bookingCancelled.title",
    messageKey: "events.bookingCancelled.message",
    params: { reference: ref(p.bookingId) },
  },
});

export const bookingCompletedToCustomer = (
  customerId: string,
  p: { bookingId: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "booking_completed",
  category: "Bookings",
  title: "Trip completed",
  message: `Your trip ${ref(p.bookingId)} is complete. Share your experience with a review.`,
  data: { bookingId: p.bookingId },
  i18n: {
    titleKey: "events.bookingCompleted.title",
    messageKey: "events.bookingCompleted.message",
    params: { reference: ref(p.bookingId) },
  },
});

export const driverAssignedToCustomer = (
  customerId: string,
  p: { bookingId: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "driver_assigned",
  category: "Bookings",
  title: "Driver assigned",
  message: `A driver has been assigned to your booking ${ref(p.bookingId)}.`,
  data: { bookingId: p.bookingId },
  i18n: {
    titleKey: "events.driverAssigned.title",
    messageKey: "events.driverAssigned.message",
    params: { reference: ref(p.bookingId) },
  },
});

// ----------------------------------------------------------------------------
// Quotation events
// ----------------------------------------------------------------------------

export const quotationRequestedToOwner = (
  ownerId: string,
  p: { quotationId: string; route: string },
): CreateNotificationInput => ({
  userId: ownerId,
  type: "quotation_requested",
  category: "Quotations",
  title: "New quotation request",
  message: `You have a new quotation request for ${p.route}.`,
  data: { quotationId: p.quotationId },
  i18n: {
    titleKey: "events.quotationRequested.title",
    messageKey: "events.quotationRequested.message",
    params: { route: p.route },
  },
});

export const quotationReceivedToCustomer = (
  customerId: string,
  p: { quotationId: string; route: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "quotation_received",
  category: "Quotations",
  title: "Quotation received",
  message: `You received a quotation for ${p.route}. Review and compare it now.`,
  data: { quotationId: p.quotationId },
  i18n: {
    titleKey: "events.quotationReceived.title",
    messageKey: "events.quotationReceived.message",
    params: { route: p.route },
  },
});

export const quotationAcceptedToOwner = (
  ownerId: string,
  p: { quotationId: string; bookingId: string; route: string },
): CreateNotificationInput => ({
  userId: ownerId,
  type: "quotation_accepted",
  category: "Quotations",
  title: "Quotation accepted",
  message: `Your quotation for ${p.route} was accepted and a booking was created.`,
  data: { quotationId: p.quotationId, bookingId: p.bookingId },
  i18n: {
    titleKey: "events.quotationAccepted.title",
    messageKey: "events.quotationAccepted.message",
    params: { route: p.route },
  },
});

export const quotationRejectedToOwner = (
  ownerId: string,
  p: { quotationId: string; route: string },
): CreateNotificationInput => ({
  userId: ownerId,
  type: "quotation_rejected",
  category: "Quotations",
  title: "Quotation declined",
  message: `Your quotation for ${p.route} was declined by the customer.`,
  data: { quotationId: p.quotationId },
  i18n: {
    titleKey: "events.quotationRejected.title",
    messageKey: "events.quotationRejected.message",
    params: { route: p.route },
  },
});

// ----------------------------------------------------------------------------
// Payment events
// ----------------------------------------------------------------------------

export const paymentReceivedToCustomer = (
  customerId: string,
  p: { bookingId: string; paymentId: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "payment_received",
  category: "Payments",
  title: "Payment received",
  message: `Your payment for booking ${ref(p.bookingId)} was received successfully.`,
  data: { bookingId: p.bookingId, paymentId: p.paymentId },
  i18n: {
    titleKey: "events.paymentReceived.title",
    messageKey: "events.paymentReceived.message",
    params: { reference: ref(p.bookingId) },
  },
});

export const paymentFailedToCustomer = (
  customerId: string,
  p: { bookingId: string; paymentId: string },
): CreateNotificationInput => ({
  userId: customerId,
  type: "payment_failed",
  category: "Payments",
  title: "Payment failed",
  message: `Your payment for booking ${ref(p.bookingId)} could not be processed.`,
  data: { bookingId: p.bookingId, paymentId: p.paymentId },
  i18n: {
    titleKey: "events.paymentFailed.title",
    messageKey: "events.paymentFailed.message",
    params: { reference: ref(p.bookingId) },
  },
});
