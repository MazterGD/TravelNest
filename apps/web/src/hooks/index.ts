// Authentication
export {
  useProtectedRoute,
  useCustomerRoute,
  useVehicleOwnerRoute,
  useAdminRoute,
  useOwnerOrAdminRoute,
} from "./useProtectedRoute";
export {
  useAuthGuard,
  useGuestGuard,
  useAuthRequired,
  useCustomerGuard,
  useOwnerGuard,
  useAdminGuard,
} from "./useAuthGuard";

// Domain Hooks
export { useChat, type UseChatState } from "./useChat";
export { useNotificationStream } from "./useNotificationStream";

// Dialogs
export { useDialogPrompts } from "./useDialogPrompts";

// Utilities
export {
  useDebounce,
  useLocalStorage,
  useClickOutside,
  useWindowSize,
  useMediaQuery,
  usePrevious,
  useToggle,
} from "./useUtils";
