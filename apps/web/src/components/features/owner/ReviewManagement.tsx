"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyBoxIcon,
  SkeletonList,
  Button,
  TextArea,
} from "@/components/ui";
import { ReviewDisplay } from "@/components/features/customer";
import { reviewService, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store";
import { Star } from "lucide-react";

interface OwnerReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  customerName: string;
  vehicleName: string;
  ownerResponse?: string;
  ownerResponseDate?: string;
}

export function ReviewManagement() {
  const t = useTranslations("review");
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<OwnerReview[]>([]);
  
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseContent, setResponseContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReviews = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await reviewService.getByOwner(user.id);
      const reviewsData = (response as any).reviews || response || [];
      
      const transformedReviews: OwnerReview[] = reviewsData.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        customerName: r.customerName || r.customer?.firstName || "Customer",
        vehicleName: r.vehicleName || r.vehicle?.name || "Your Vehicle",
        ownerResponse: r.ownerResponse,
        ownerResponseDate: r.ownerResponseDate,
      }));

      setReviews(transformedReviews);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to fetch reviews");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchReviews();
    }
  }, [fetchReviews, user?.id]);

  const handleRespond = async (reviewId: string) => {
    if (!responseContent.trim()) return;

    setIsSubmitting(true);
    try {
      await reviewService.respond(reviewId, responseContent);
      
      // Optimistically update
      setReviews(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, ownerResponse: responseContent, ownerResponseDate: new Date().toISOString() } 
          : r
      ));
      
      setRespondingTo(null);
      setResponseContent("");
    } catch (err) {
      console.error(err);
      alert(err instanceof ApiError ? err.message : "Failed to submit response.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageRating = reviews.length 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  if (isLoading) return <SkeletonList count={3} />;

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <p>{error}</p>
        <Button variant="link" onClick={fetchReviews} className="mt-2 p-0">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("totalReviews", { defaultValue: "Total Reviews" })}</p>
              <h3 className="text-3xl font-bold mt-1">{reviews.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("averageRating", { defaultValue: "Average Rating" })}</p>
              <div className="flex items-center gap-2 mt-1">
                <h3 className="text-3xl font-bold">{averageRating}</h3>
                <Star className="w-6 h-6 text-yellow-500 fill-current" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("pendingResponses", { defaultValue: "Pending Responses" })}</p>
              <h3 className="text-3xl font-bold mt-1">
                {reviews.filter(r => !r.ownerResponse).length}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <Card key={review.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4 border-b">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base font-semibold">{review.vehicleName}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ReviewDisplay review={review} showOwnerResponse />
                
                {!review.ownerResponse && (
                  <div className="mt-6 border-t pt-4">
                    {respondingTo === review.id ? (
                      <div className="space-y-3">
                        <label className="text-sm font-medium">{t("writeResponse", { defaultValue: "Write your response" })}</label>
                        <TextArea 
                          value={responseContent}
                          onChange={(e) => setResponseContent(e.target.value)}
                          placeholder={t("responsePlaceholder", { defaultValue: "Thank the customer for their feedback..." })}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            isLoading={isSubmitting}
                            onClick={() => handleRespond(review.id)}
                            disabled={!responseContent.trim()}
                          >
                            {t("submitResponse", { defaultValue: "Publish Response" })}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setRespondingTo(null);
                              setResponseContent("");
                            }}
                          >
                            {t("cancel", { defaultValue: "Cancel" })}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => setRespondingTo(review.id)}
                      >
                        {t("replyToReview", { defaultValue: "Reply to Review" })}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState
            icon={<EmptyBoxIcon />}
            title={t("noReviews", { defaultValue: "No Reviews Yet" })}
            description={t("noReviewsDesc", { defaultValue: "Your vehicles haven't received any reviews yet." })}
          />
        )}
      </div>
    </div>
  );
}
