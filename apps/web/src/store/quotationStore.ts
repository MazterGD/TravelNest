import { create } from "zustand";

// Quotation status type
type QuotationStatus =
  | "pending"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired";

// Base Quotation type
interface Quotation {
  id: string;
  requestId: string;
  ownerId: string;
  vehicleId: string;
  status: QuotationStatus;
  totalAmount: number;
  expiryDate: Date | string;
  notes?: string;
  createdAt: Date | string;
}

// Extended types for quotation requests
export interface QuotationRequest {
  id: string;
  customerId: string;
  pickupLocation: {
    address: string;
    city: string;
    district: string;
    latitude?: number;
    longitude?: number;
  };
  dropoffLocation: {
    address: string;
    city: string;
    district: string;
    latitude?: number;
    longitude?: number;
  };
  pickupDate: string;
  pickupTime: string;
  returnDate?: string;
  returnTime?: string;
  isRoundTrip: boolean;
  passengerCount: number;
  vehicleType: string;
  specialRequests?: string;
  luggageCount: number;
  needsAC: boolean;
  status: "pending" | "quoted" | "expired" | "cancelled";
  quotationsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivedQuotation extends Quotation {
  ownerName: string;
  vehicleName: string;
  vehicleImage?: string;
  rating: number | null;
  totalTrips: number | null;
  // Additional display fields
  price: number; // Alias for totalAmount for display convenience
  message?: string; // Optional message from owner
  validUntil?: string; // Formatted expiry date
}

interface QuotationState {
  // Quotation Requests (sent by customer)
  requests: QuotationRequest[];
  activeRequest: QuotationRequest | null;

  // Received Quotations (from owners)
  receivedQuotations: ReceivedQuotation[];
  selectedQuotation: ReceivedQuotation | null;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Filters
  requestFilter: "all" | "pending" | "quoted" | "expired" | "cancelled";
  quotationFilter: "all" | QuotationStatus;

  // Actions
  setRequests: (requests: QuotationRequest[]) => void;
  addRequest: (request: QuotationRequest) => void;
  updateRequest: (id: string, updates: Partial<QuotationRequest>) => void;
  setActiveRequest: (request: QuotationRequest | null) => void;

  setReceivedQuotations: (quotations: ReceivedQuotation[]) => void;
  setSelectedQuotation: (quotation: ReceivedQuotation | null) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRequestFilter: (filter: QuotationState["requestFilter"]) => void;
  setQuotationFilter: (filter: QuotationState["quotationFilter"]) => void;

  reset: () => void;
}

const initialState = {
  requests: [],
  activeRequest: null,
  receivedQuotations: [],
  selectedQuotation: null,
  isLoading: false,
  error: null,
  requestFilter: "all" as const,
  quotationFilter: "all" as const,
};

export const useQuotationStore = create<QuotationState>()((set) => ({
  ...initialState,

  setRequests: (requests) => set({ requests }),

  addRequest: (request) =>
    set((state) => ({ requests: [request, ...state.requests] })),

  updateRequest: (id, updates) =>
    set((state) => ({
      requests: state.requests.map((req) =>
        req.id === id ? { ...req, ...updates } : req
      ),
    })),

  setActiveRequest: (activeRequest) => set({ activeRequest }),

  setReceivedQuotations: (receivedQuotations) => set({ receivedQuotations }),

  setSelectedQuotation: (selectedQuotation) => set({ selectedQuotation }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setRequestFilter: (requestFilter) => set({ requestFilter }),

  setQuotationFilter: (quotationFilter) => set({ quotationFilter }),

  reset: () => set(initialState),
}));
