"use client";

import { useCallback, useEffect } from "react";
import {
  useQuotationStore,
  type QuotationRequest,
  type ReceivedQuotation,
} from "@/store";
import { api } from "@/lib/api";
import type { QuotationRequestInput } from "@/lib/validations";

export function useQuotations() {
  const {
    requests,
    activeRequest,
    receivedQuotations,
    selectedQuotation,
    isLoading,
    error,
    requestFilter,
    quotationFilter,
    setRequests,
    addRequest,
    updateRequest,
    setActiveRequest,
    setReceivedQuotations,
    setSelectedQuotation,
    setLoading,
    setError,
    setRequestFilter,
    setQuotationFilter,
  } = useQuotationStore();

  // Fetch user's quotation requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<QuotationRequest[]>(
        "/quotations/my-requests",
      );
      setRequests(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  }, [setRequests, setLoading, setError]);

  // Create new quotation request
  const createRequest = useCallback(
    async (data: QuotationRequestInput) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.post<QuotationRequest>("/quotations", data);
        addRequest(response);
        return { success: true, data: response };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create request";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [addRequest, setLoading, setError],
  );

  // Fetch quotations received for a specific request
  const fetchQuotationsForRequest = useCallback(
    async (requestId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<ReceivedQuotation[]>(
          `/quotations/requests/${requestId}/quotations`,
        );
        setReceivedQuotations(response);
        return response;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch quotations",
        );
        return [];
      } finally {
        setLoading(false);
      }
    },
    [setReceivedQuotations, setLoading, setError],
  );

  // Accept a quotation
  const acceptQuotation = useCallback(
    async (quotationId: string) => {
      setLoading(true);
      setError(null);
      try {
        await api.post(`/quotations/${quotationId}/accept`);
        // Update local state
        if (activeRequest) {
          updateRequest(activeRequest.id, { status: "quoted" });
        }
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to accept quotation";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [activeRequest, updateRequest, setLoading, setError],
  );

  // Decline a quotation
  const declineQuotation = useCallback(
    async (quotationId: string) => {
      setLoading(true);
      try {
        await api.post(`/quotations/${quotationId}/decline`);
        // Remove from received quotations
        setReceivedQuotations(
          receivedQuotations.filter((q) => q.id !== quotationId),
        );
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to decline quotation";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [receivedQuotations, setReceivedQuotations, setLoading, setError],
  );

  // Cancel a quotation request
  const cancelRequest = useCallback(
    async (requestId: string) => {
      setLoading(true);
      try {
        await api.post(`/quotations/requests/${requestId}/cancel`);
        updateRequest(requestId, { status: "cancelled" });
        return { success: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to cancel request";
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [updateRequest, setLoading, setError],
  );

  // Filtered requests based on current filter
  const filteredRequests = requests.filter((request) => {
    if (requestFilter === "all") return true;
    return request.status === requestFilter;
  });

  // Filtered quotations based on current filter
  const filteredQuotations = receivedQuotations.filter((quotation) => {
    if (quotationFilter === "all") return true;
    return quotation.status === quotationFilter;
  });

  return {
    // State
    requests: filteredRequests,
    allRequests: requests,
    activeRequest,
    receivedQuotations: filteredQuotations,
    allReceivedQuotations: receivedQuotations,
    selectedQuotation,
    isLoading,
    error,
    requestFilter,
    quotationFilter,

    // Actions
    fetchRequests,
    createRequest,
    fetchQuotationsForRequest,
    acceptQuotation,
    declineQuotation,
    cancelRequest,
    setActiveRequest,
    setSelectedQuotation,
    setRequestFilter,
    setQuotationFilter,
  };
}
