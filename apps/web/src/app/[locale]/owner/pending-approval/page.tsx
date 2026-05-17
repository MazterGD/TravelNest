"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Clock, CheckCircle, FileText, Phone, Mail, LogOut, Building, Bus, Contact, AlertTriangle } from 'lucide-react';
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { useAuthStore } from "@/store";

export default function PendingApprovalPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { user, isAuthenticated, logout, isLoading } = useAuthStore();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/${locale}/login`);
    }
  }, [isAuthenticated, isLoading, locale, router]);

  // Redirect verified owners to dashboard
  useEffect(() => {
    if (user && user.isVerified && user.role === "VEHICLE_OWNER") {
      router.push(`/${locale}/owner/dashboard`);
    }
  }, [user, locale, router]);

  // Redirect non-owners to their appropriate page
  useEffect(() => {
    if (user && user.role !== "VEHICLE_OWNER") {
      router.push(`/${locale}/dashboard`);
    }
  }, [user, locale, router]);

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
  };

  if (isLoading || !user) {
    return (
      <MainLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Status Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-amber-100">
            {/* Header with pending status */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-12 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-6 backdrop-blur-sm">
                <Clock className="w-12 h-12 text-white animate-pulse bg-muted rounded-xl" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Registration Pending Approval
              </h1>
              <p className="text-amber-100 text-lg max-w-2xl mx-auto">
                Thank you for registering with TraveNest! Your application is
                being reviewed by our team.
              </p>
            </div>

            {/* Main Content */}
            <div className="px-8 py-10">
              {/* Timeline */}
              <div className="mb-10">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <FileText className="text-amber-500" />
                  Verification Process
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 pb-4 border-l-2 border-green-200 pl-6 -ml-5">
                      <h3 className="font-semibold text-gray-900">
                        Registration Submitted
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Your registration form has been successfully submitted
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse bg-muted rounded-xl">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 pb-4 border-l-2 border-amber-200 pl-6 -ml-5">
                      <h3 className="font-semibold text-gray-900">
                        Under Review
                      </h3>
                      <p className="text-gray-600 text-sm">
                        Our team is verifying your information and documents
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-400">
                        Approval Complete
                      </h3>
                      <p className="text-gray-400 text-sm">
                        You&apos;ll be notified once your account is approved
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estimated Time */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 mb-8 border border-amber-200">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-7 h-7 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">
                      Estimated Review Time
                    </h3>
                    <p className="text-amber-700 font-semibold text-xl">
                      2-3 Business Days
                    </p>
                  </div>
                </div>
              </div>

              {/* Your Registration Details */}
              <div className="bg-gray-50 rounded-2xl p-6 mb-8">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Contact className="text-gray-500" />
                  Your Registration Details
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <span className="font-medium">Name:</span>
                    <span>
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <span className="font-medium">Email:</span>
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <span className="font-medium">Status:</span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                      <Clock className="w-3 h-3" />
                      Pending Verification
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <span className="font-medium">Role:</span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      <Bus className="w-3 h-3" />
                      Bus Owner
                    </span>
                  </div>
                </div>
              </div>

              {/* What You Cannot Do */}
              <div className="bg-red-50 rounded-2xl p-6 mb-8 border border-red-200">
                <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-red-500" />
                  Account Restrictions
                </h3>
                <p className="text-red-700 mb-4">
                  Until your account is approved, you <strong>cannot</strong>{" "}
                  perform the following actions:
                </p>
                <ul className="space-y-2 text-red-700">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    List your vehicles for booking
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    Receive booking requests from customers
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    Set pricing for your vehicles
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    Access the owner dashboard
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    Respond to customer quotation requests
                  </li>
                </ul>
              </div>

              {/* What Happens Next */}
              <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-200">
                <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <Building className="text-blue-500" />
                  What Happens Next?
                </h3>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                      1
                    </span>
                    <span>
                      Our team will review your personal information and verify
                      your NIC details
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                      2
                    </span>
                    <span>
                      We&apos;ll verify your vehicle registration and
                      documentation
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                      3
                    </span>
                    <span>
                      Once approved, you&apos;ll receive an email notification
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                      4
                    </span>
                    <span>
                      You can then set up your vehicle pricing and start
                      receiving bookings
                    </span>
                  </li>
                </ul>
              </div>

              {/* Contact Support */}
              <div className="bg-gray-100 rounded-2xl p-6">
                <h3 className="font-bold text-gray-900 mb-4">Need Help?</h3>
                <p className="text-gray-600 mb-4">
                  If you have any questions about the verification process or
                  need to update your registration details, please contact our
                  support team.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="mailto:support@travenest.lk"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-semibold"
                  >
                    <Mail className="w-4 h-4" />
                    Email Support
                  </a>
                  <a
                    href="tel:+94112345678"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-primary hover:text-primary transition-colors font-semibold"
                  >
                    <Phone className="w-4 h-4" />
                    Call Support
                  </a>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-8 py-6 flex flex-col sm:flex-row gap-4 justify-between items-center border-t">
              <Link
                href={`/${locale}`}
                className="text-primary hover:underline font-medium"
              >
                ← Back to Home
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-semibold"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>
              Your registration was submitted on{" "}
              <span className="font-medium">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
