"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SkeletonList,
  EmptyState,
  EmptyBoxIcon
} from "@/components/ui";
import { bookingService, vehicleService, ApiError } from "@/lib/api";
import type { Booking } from "@/types";
import { DollarSign, TrendingUp, Car, Star, Calendar } from "lucide-react";
import { useAuthStore } from "@/store";

// Helper for date formatting
const isSameMonth = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();

interface VehicleStat {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  rating: number;
}

export function AnalyticsDashboard() {
  const t = useTranslations("dashboard");
  const { user } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      setError(null);

      try {
        const [bookingsRes, vehiclesRes] = await Promise.all([
          bookingService.getOwnerBookings(), // Fetch all to calculate stats
          vehicleService.getMyVehicles()
        ]);
        
        // Handle variations in API response signature
        const allBookings = Array.isArray(bookingsRes) 
          ? bookingsRes 
          : ((bookingsRes as any)?.bookings || []);
          
        const allVehicles = Array.isArray(vehiclesRes) 
          ? vehiclesRes 
          : ((vehiclesRes as any)?.vehicles || []);

        setBookings(allBookings);
        setVehicles(allVehicles);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch analytics data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  if (isLoading) return <SkeletonList count={4} />;
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        {error}
      </div>
    );
  }

  // --- Calculations ---
  
  // 1. Total lifetime revenue (from COMPLETED and ONGOING and CONFIRMED bookings)
  const validBookings = bookings.filter(b => 
    String(b.status) === "COMPLETED" || String(b.status) === "ONGOING" || String(b.status) === "CONFIRMED"
  );
  
  const totalRevenue = validBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  
  // 2. This month's revenue vs last month
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  
  const thisMonthRevenue = validBookings
    .filter(b => b.createdAt && isSameMonth(new Date(b.createdAt), now))
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    
  const lastMonthRevenue = validBookings
    .filter(b => b.createdAt && isSameMonth(new Date(b.createdAt), lastMonth))
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    
  let revenueGrowth = 0;
  if (lastMonthRevenue > 0) {
    revenueGrowth = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
  }

  // 3. Last 6 months revenue for chart
  const monthsData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const rev = validBookings
      .filter(b => b.createdAt && isSameMonth(new Date(b.createdAt), d))
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    return { month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d), revenue: rev };
  });

  const maxMonthlyRev = Math.max(...monthsData.map(m => m.revenue), 1); // prevent division by zero

  // 4. Vehicle parsing (Top performers)
  const vehicleStats: VehicleStat[] = vehicles.map(v => {
    const vBookings = validBookings.filter(b => b.vehicleId === v.id);
    const vRev = vBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    return {
      id: v.id,
      name: v.registration || v.name || "Unknown Vehicle",
      bookings: vBookings.length,
      revenue: vRev,
      rating: v.averageRating || 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("analytics.totalRevenue", { defaultValue: "Total Lifetime Revenue" })}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-gray-900">LKR {totalRevenue.toLocaleString()}</h3>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("analytics.thisMonth", { defaultValue: "Revenue This Month" })}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-gray-900">LKR {thisMonthRevenue.toLocaleString()}</h3>
                </div>
                {revenueGrowth !== 0 && (
                  <p className={`text-sm mt-1 flex items-center gap-1 ${revenueGrowth > 0 ? "text-green-600" : "text-red-600"}`}>
                    <TrendingUp className={`w-4 h-4 ${revenueGrowth < 0 ? "rotate-180" : ""}`} />
                    {Math.abs(revenueGrowth).toFixed(1)}% {revenueGrowth > 0 ? "increase" : "decrease"}
                  </p>
                )}
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("analytics.totalBookings", { defaultValue: "Total Bookings" })}</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{validBookings.length}</h3>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Car className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("analytics.totalVehicles", { defaultValue: "Fleet Size" })}</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">{vehicles.length}</h3>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <Car className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart (CSS-based) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("analytics.revenueHistory", { defaultValue: "Revenue History (Last 6 Months)" })}</CardTitle>
          </CardHeader>
          <CardContent>
            {totalRevenue === 0 ? (
              <EmptyState
                icon={<EmptyBoxIcon />}
                title={t("analytics.noData", { defaultValue: "No data available yet" })}
                description={t("analytics.noDataDesc", { defaultValue: "Once you start receiving bookings, your revenue history will appear here." })}
              />
            ) : (
              <div className="h-64 flex items-end justify-between gap-2 pt-8">
                {monthsData.map((data, i) => {
                  const heightPct = Math.max((data.revenue / maxMonthlyRev) * 100, 2); // min 2% height
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 relative group">
                      <div className="w-full bg-primary/20 rounded-t-md hover:bg-primary/40 transition-colors relative" style={{ height: `${heightPct}%` }}>
                        {/* Tooltip */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          LKR {data.revenue.toLocaleString()}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-500">{data.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Vehicles */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("analytics.topVehicles", { defaultValue: "Top Performing Vehicles" })}</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicleStats.length === 0 || vehicleStats[0].revenue === 0 ? (
               <div className="text-center py-8 text-gray-500 text-sm">
                 {t("analytics.noVehicleData", { defaultValue: "Not enough data to rank vehicles." })}
               </div>
            ) : (
              <div className="space-y-6">
                {vehicleStats.slice(0, 5).map((vehicle, idx) => (
                  <div key={vehicle.id} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm border-2 border-white shadow-sm">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{vehicle.name}</h4>
                      <p className="text-xs text-gray-500">{vehicle.bookings} bookings</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">LKR {vehicle.revenue.toLocaleString()}</p>
                      {vehicle.rating > 0 && (
                        <div className="flex items-center justify-end gap-1 text-xs text-yellow-600 font-medium">
                          <Star className="w-3 h-3 fill-current" /> {vehicle.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
