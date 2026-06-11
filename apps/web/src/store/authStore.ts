import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UserRole, type User } from "@/types";
import { readAuthRaw, writeAuthRaw, clearAuthRaw } from "@/lib/auth-storage";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (state: boolean) => void;
  updateUser: (userData: Partial<User>) => void;

  // Role checks
  isCustomer: () => boolean;
  isVehicleOwner: () => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      _hasHydrated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setToken: (token) => set({ token }),

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setHasHydrated: (state) =>
        set({ _hasHydrated: state, isLoading: !state }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      // Role check helpers
      isCustomer: () => get().user?.role === UserRole.CUSTOMER,
      isVehicleOwner: () => get().user?.role === UserRole.VEHICLE_OWNER,
      isAdmin: () => get().user?.role === UserRole.ADMIN,
    }),
    {
      name: "travenest-auth",
      // Storage follows the remember-me preference: localStorage when remembered,
      // sessionStorage (cleared on browser close) when not.
      storage: createJSONStorage(() => ({
        getItem: () => readAuthRaw(),
        setItem: (_name, value) => writeAuthRaw(value),
        removeItem: () => clearAuthRaw(),
      })),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
