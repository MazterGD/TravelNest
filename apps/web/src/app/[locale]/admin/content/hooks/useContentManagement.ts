"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminService,
  type AdminContentPage,
  type AdminContentPageQuery,
  type AdminContentPageResponse,
  type AdminContentPageUpdateInput,
  type AdminFaqInput,
  type AdminFaqResponse,
  type AdminTestimonialResponse,
  type AdminTestimonialUpdateInput,
} from "@/lib/api";

interface UseContentManagementResult {
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  filters: AdminContentPageQuery;
  pagesData: AdminContentPageResponse | null;
  faqData: AdminFaqResponse | null;
  testimonialData: AdminTestimonialResponse | null;
  selectedPage: AdminContentPage | null;
  setFilters: (next: Partial<AdminContentPageQuery>) => void;
  loadPage: (slug: string) => Promise<void>;
  savePage: (slug: string, payload: AdminContentPageUpdateInput) => Promise<void>;
  createFaq: (payload: AdminFaqInput) => Promise<void>;
  updateFaq: (faqId: string, payload: Partial<AdminFaqInput>) => Promise<void>;
  deleteFaq: (faqId: string) => Promise<void>;
  approveTestimonial: (testimonialId: string, note?: string) => Promise<void>;
  updateTestimonial: (
    testimonialId: string,
    payload: AdminTestimonialUpdateInput,
  ) => Promise<void>;
  deleteTestimonial: (testimonialId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: AdminContentPageQuery = {
  page: 1,
  limit: 20,
  search: "",
};

export const useContentManagement = (): UseContentManagementResult => {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilterState] = useState<AdminContentPageQuery>(DEFAULT_FILTERS);
  const [pagesData, setPagesData] = useState<AdminContentPageResponse | null>(null);
  const [faqData, setFaqData] = useState<AdminFaqResponse | null>(null);
  const [testimonialData, setTestimonialData] =
    useState<AdminTestimonialResponse | null>(null);
  const [selectedPage, setSelectedPage] = useState<AdminContentPage | null>(null);

  const fetchManagementData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const normalizedSearch = filters.search?.trim() || undefined;

      const [pages, faqs, testimonials] = await Promise.all([
        adminService.getContentPages({
          ...filters,
          search: normalizedSearch,
        }),
        adminService.getFaqs({
          page: 1,
          limit: 20,
          search: normalizedSearch,
        }),
        adminService.getTestimonials({
          page: 1,
          limit: 12,
          search: normalizedSearch,
          includeInactive: true,
        }),
      ]);

      setPagesData(pages);
      setFaqData(faqs);
      setTestimonialData(testimonials);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load content management data";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchManagementData();
  }, [fetchManagementData]);

  const setFilters = useCallback((next: Partial<AdminContentPageQuery>) => {
    setFilterState((previous) => ({
      ...previous,
      ...next,
      page:
        next.page !== undefined
          ? next.page
          : next.search !== undefined || next.isPublished !== undefined
            ? 1
            : previous.page,
    }));
  }, []);

  const loadPage = useCallback(async (slug: string) => {
    setIsMutating(true);
    setError(null);

    try {
      const page = await adminService.getContentPageBySlug(slug);
      setSelectedPage(page);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load content page";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  }, []);

  const withMutation = useCallback(
    async (operation: () => Promise<void>, selectedPageSlug?: string) => {
      setIsMutating(true);
      setError(null);

      try {
        await operation();
        await fetchManagementData();

        if (selectedPageSlug) {
          const refreshed = await adminService.getContentPageBySlug(selectedPageSlug);
          setSelectedPage(refreshed);
        }
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Content management action failed";
        setError(message);
      } finally {
        setIsMutating(false);
      }
    },
    [fetchManagementData],
  );

  const savePage = useCallback<UseContentManagementResult["savePage"]>(
    async (slug, payload) => {
      await withMutation(async () => {
        await adminService.updateContentPage(slug, payload);
      }, slug);
    },
    [withMutation],
  );

  const createFaq = useCallback<UseContentManagementResult["createFaq"]>(
    async (payload) => {
      await withMutation(async () => {
        await adminService.createFaq(payload);
      }, selectedPage?.slug);
    },
    [selectedPage?.slug, withMutation],
  );

  const updateFaq = useCallback<UseContentManagementResult["updateFaq"]>(
    async (faqId, payload) => {
      await withMutation(async () => {
        await adminService.updateFaq(faqId, payload);
      }, selectedPage?.slug);
    },
    [selectedPage?.slug, withMutation],
  );

  const deleteFaq = useCallback<UseContentManagementResult["deleteFaq"]>(
    async (faqId) => {
      await withMutation(async () => {
        await adminService.deleteFaq(faqId);
      }, selectedPage?.slug);
    },
    [selectedPage?.slug, withMutation],
  );

  const approveTestimonial = useCallback<
    UseContentManagementResult["approveTestimonial"]
  >(
    async (testimonialId, note) => {
      await withMutation(async () => {
        await adminService.approveTestimonial(testimonialId, note);
      }, selectedPage?.slug);
    },
    [selectedPage?.slug, withMutation],
  );

  const updateTestimonial = useCallback<
    UseContentManagementResult["updateTestimonial"]
  >(
    async (testimonialId, payload) => {
      await withMutation(async () => {
        await adminService.updateTestimonial(testimonialId, payload);
      }, selectedPage?.slug);
    },
    [selectedPage?.slug, withMutation],
  );

  const deleteTestimonial = useCallback<UseContentManagementResult["deleteTestimonial"]>(
    async (testimonialId) => {
      await withMutation(async () => {
        await adminService.deleteTestimonial(testimonialId);
      }, selectedPage?.slug);
    },
    [selectedPage?.slug, withMutation],
  );

  return {
    isLoading,
    isMutating,
    error,
    filters,
    pagesData,
    faqData,
    testimonialData,
    selectedPage,
    setFilters,
    loadPage,
    savePage,
    createFaq,
    updateFaq,
    deleteFaq,
    approveTestimonial,
    updateTestimonial,
    deleteTestimonial,
    refetch: fetchManagementData,
  };
};
