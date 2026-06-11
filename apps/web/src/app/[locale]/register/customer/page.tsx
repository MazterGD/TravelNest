"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, Mail, Phone, MapPin, Lock, Eye, EyeOff, Building, CheckCircle } from 'lucide-react';
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner, OtpVerificationModal } from "@/components/ui";
import { authService, ApiError } from "@/lib/api";
import { getDashboardUrl } from "@/lib/utils/getDashboardUrl";
import { useAuthStore } from "@/store";
import { useGuestGuard } from "@/hooks";
import { cn } from "@/lib/utils/cn";

export default function CustomerRegistrationPage() {
  const t = useTranslations("auth.customerRegister");
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { login } = useAuthStore();

  // Redirect authenticated users to their dashboard
  const { isLoading: guardLoading, isAuthorized } = useGuestGuard();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    organizationName: "",
    organizationType: "",
    address: "",
    city: "",
    postalCode: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    privacyAccepted: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const registerCustomerAccount = async () => {
    const response = await authService.register({
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone || undefined,
      role: "customer",
    });

    login(response.user, response.accessToken);
    router.push(getDashboardUrl(response.user, locale));
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });

    // Calculate password strength
    if (name === "password") {
      let strength = 0;
      if (value.length >= 8) strength += 25;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) strength += 25;
      if (/\d/.test(value)) strength += 25;
      if (/[^a-zA-Z\d]/.test(value)) strength += 25;
      setPasswordStrength(strength);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 50) return "bg-red-500";
    if (passwordStrength < 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 50) return t("passwordStrength.weak");
    if (passwordStrength < 75) return t("passwordStrength.medium");
    return t("passwordStrength.strong");
  };

  const scrollToFirstError = () => {
    setTimeout(() => {
      const firstError = document.querySelector<HTMLElement>('[data-field-error="true"]');
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    // Client-side required-field validation
    const errs: Record<string, string> = {};
    if (!formData.firstName) errs.firstName = t("errors.requiredField");
    if (!formData.lastName) errs.lastName = t("errors.requiredField");
    if (!formData.email) errs.email = t("errors.requiredField");
    if (!formData.phone) errs.phone = t("errors.requiredField");
    if (!formData.address) errs.address = t("errors.requiredField");
    if (!formData.city) errs.city = t("errors.requiredField");
    if (!formData.password) errs.password = t("errors.requiredField");
    if (!formData.confirmPassword) errs.confirmPassword = t("errors.requiredField");
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError(t("errors.requiredFields"));
      setIsLoading(false);
      scrollToFirstError();
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: t("errors.passwordMismatch") });
      scrollToFirstError();
      setIsLoading(false);
      return;
    }

    if (!formData.termsAccepted || !formData.privacyAccepted) {
      setError(t("errors.acceptTerms"));
      setIsLoading(false);
      return;
    }

    try {
      setIsSendingOtp(true);
      await authService.sendOtp({
        identifier: formData.email,
        purpose: "REGISTRATION",
      });
      setOtpModalOpen(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isValidationError()) {
          setFieldErrors(err.getValidationErrors());
        } else {
          setError(err.message);
        }
      } else {
        setError(t("errors.unexpected"));
      }
    } finally {
      setIsSendingOtp(false);
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setIsVerifyingOtp(true);

    try {
      await authService.verifyOtp({
        identifier: formData.email,
        code,
        purpose: "REGISTRATION",
      });

      await registerCustomerAccount();
      setOtpModalOpen(false);
    } catch (verifyError) {
      if (verifyError instanceof ApiError) {
        throw new Error(verifyError.message);
      }

      throw new Error(t("errors.unexpected"));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    await authService.sendOtp({
      identifier: formData.email,
      purpose: "REGISTRATION",
    });
  };

  // Show loading while checking auth state
  if (guardLoading || !isAuthorized) {
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Information */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl shadow-2xl p-6 border-2 border-gray-100 sticky top-6">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {t("sidebar.title")}
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {t("sidebar.subtitle")}
                  </p>
                </div>

                <div className="relative h-44 rounded-2xl overflow-hidden mb-4 bg-gradient-to-br from-primary/20 to-primary/10">
                  <Image
                    src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600"
                    alt="Travel with TraveNest"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-0.5">
                        {t("sidebar.benefits.easyBooking.title")}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {t("sidebar.benefits.easyBooking.description")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-0.5">
                        {t("sidebar.benefits.verifiedOperators.title")}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {t("sidebar.benefits.verifiedOperators.description")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-0.5">
                        {t("sidebar.benefits.support.title")}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {t("sidebar.benefits.support.description")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-2.5">
                    {t("sidebar.hasAccount")}
                  </p>
                  <Link
                    href={`/${locale}/login`}
                    className="block w-full py-2.5 border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all font-semibold text-center text-sm"
                  >
                    {t("sidebar.signIn")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Side - Registration Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 border-2 border-gray-100">
                <div className="mb-5">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-gray-600">{t("subtitle")}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Personal Information Section */}
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-primary/20 uppercase tracking-wide">
                      {t("sections.personalInfo")}
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.firstName.label")}
                        </label>
                        <div className="relative group">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            id="cust-firstName"
                            type="text"
                            name="firstName"
                            required
                            value={formData.firstName}
                            onChange={handleChange}
                            placeholder={t("fields.firstName.placeholder")}
                            data-field-error={fieldErrors.firstName ? "true" : undefined}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 text-sm border rounded-xl focus:outline-none transition-all",
                              fieldErrors.firstName
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                        </div>
                        {fieldErrors.firstName && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.firstName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.lastName.label")}
                        </label>
                        <div className="relative group">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            id="cust-lastName"
                            type="text"
                            name="lastName"
                            required
                            value={formData.lastName}
                            onChange={handleChange}
                            placeholder={t("fields.lastName.placeholder")}
                            data-field-error={fieldErrors.lastName ? "true" : undefined}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 text-sm border rounded-xl focus:outline-none transition-all",
                              fieldErrors.lastName
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                        </div>
                        {fieldErrors.lastName && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.lastName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.email.label")}
                        </label>
                        <div className="relative group">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            id="cust-email"
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder={t("fields.email.placeholder")}
                            data-field-error={fieldErrors.email ? "true" : undefined}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 text-sm border rounded-xl focus:outline-none transition-all",
                              fieldErrors.email
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                        </div>
                        {fieldErrors.email && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.phone.label")}
                        </label>
                        <div className="relative group">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            id="cust-phone"
                            type="tel"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder={t("fields.phone.placeholder")}
                            data-field-error={fieldErrors.phone ? "true" : undefined}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 text-sm border rounded-xl focus:outline-none transition-all",
                              fieldErrors.phone
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                        </div>
                        {fieldErrors.phone && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Organization Details (Optional) */}
                  {/* <div>
                    <h2 className="text-sm font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-primary/20 uppercase tracking-wide">
                      Organization Details (Optional)
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          Organization Name
                        </label>
                        <div className="relative group">
                          <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="text"
                            name="organizationName"
                            value={formData.organizationName}
                            onChange={handleChange}
                            placeholder="Company or organization name"
                            className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          Organization Type
                        </label>
                        <select className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                          name="organizationType"
                          value={formData.organizationType}
                          onChange={handleChange}
                          className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none bg-gray-50 focus:bg-white cursor-pointer"
                        >
                          <option value="">Select type</option>
                          <option value="school">School</option>
                          <option value="religious">
                            Religious Organization
                          </option>
                          <option value="corporate">Corporate</option>
                          <option value="tour">Tour Company</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div> */}

                  {/* Address Section */}
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-primary/20 uppercase tracking-wide">
                      {t("sections.addressInfo")}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.address.label")}
                        </label>
                        <div className="relative group">
                          <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <textarea
                            id="cust-address"
                            name="address"
                            required
                            value={formData.address}
                            onChange={handleChange}
                            rows={3}
                            placeholder={t("fields.address.placeholder")}
                            data-field-error={fieldErrors.address ? "true" : undefined}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 text-sm border rounded-xl focus:outline-none transition-all resize-none",
                              fieldErrors.address
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                        </div>
                        {fieldErrors.address && (
                          <p className="mt-1 text-sm text-red-600">{fieldErrors.address}</p>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.city.label")}
                          </label>
                          <input
                            id="cust-city"
                            type="text"
                            name="city"
                            required
                            value={formData.city}
                            onChange={handleChange}
                            placeholder={t("fields.city.placeholder")}
                            data-field-error={fieldErrors.city ? "true" : undefined}
                            className={cn(
                              "w-full px-4 py-3 text-sm border rounded-xl focus:outline-none transition-all",
                              fieldErrors.city
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                          {fieldErrors.city && (
                            <p className="mt-1 text-sm text-red-600">{fieldErrors.city}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                            {t("fields.postalCode.label")}
                          </label>
                          <input
                            type="text"
                            name="postalCode"
                            value={formData.postalCode}
                            onChange={handleChange}
                            placeholder={t("fields.postalCode.placeholder")}
                            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Password Section */}
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 mb-3 pb-1.5 border-b-2 border-primary/20 uppercase tracking-wide">
                      {t("sections.password")}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.password.label")}
                        </label>
                        <div className="relative group">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            id="cust-password"
                            type={showPassword ? "text" : "password"}
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder={t("fields.password.placeholder")}
                            data-field-error={fieldErrors.password ? "true" : undefined}
                            className={cn(
                              "w-full pl-10 pr-10 py-3 text-sm border rounded-xl focus:outline-none transition-all",
                              fieldErrors.password
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        {fieldErrors.password && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.password}
                          </p>
                        )}
                        {formData.password && (
                          <div className="mt-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600">
                                {t("passwordStrength.label")}
                              </span>
                              <span
                                className={`text-sm font-semibold ${
                                  passwordStrength < 50
                                    ? "text-red-600"
                                    : passwordStrength < 75
                                      ? "text-yellow-600"
                                      : "text-green-600"
                                }`}
                              >
                                {getPasswordStrengthText()}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                                style={{ width: `${passwordStrength}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                          {t("fields.confirmPassword.label")}
                        </label>
                        <div className="relative group">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            id="cust-confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder={t(
                              "fields.confirmPassword.placeholder",
                            )}
                            data-field-error={fieldErrors.confirmPassword ? "true" : undefined}
                            className={cn(
                              "w-full pl-10 pr-10 py-3 text-sm border rounded-xl focus:outline-none transition-all",
                              fieldErrors.confirmPassword
                                ? "border-red-400 bg-red-50 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                                : "border-gray-200 bg-gray-50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        {fieldErrors.confirmPassword && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.confirmPassword}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        name="termsAccepted"
                        required
                        checked={formData.termsAccepted}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                        {t("terms.accept")}{" "}
                        <Link
                          href={`/${locale}/terms`}
                          className="text-primary hover:underline font-semibold"
                        >
                          {t("terms.termsLink")}
                        </Link>{" "}
                        *
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        name="privacyAccepted"
                        required
                        checked={formData.privacyAccepted}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                      />
                      <span className="text-gray-700 group-hover:text-gray-900 leading-relaxed">
                        {t("terms.privacyAccept")}{" "}
                        <Link
                          href={`/${locale}/privacy`}
                          className="text-primary hover:underline font-semibold"
                        >
                          {t("terms.privacyLink")}
                        </Link>{" "}
                        *
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || isSendingOtp}
                    className="w-full bg-gradient-to-r from-primary to-primary/90 text-white py-3 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading || isSendingOtp ? (
                      <LoadingSpinner size="sm" className="text-white" />
                    ) : (
                      t("submit")
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <OtpVerificationModal
        isOpen={otpModalOpen}
        destination={formData.email}
        isSending={isSendingOtp}
        isVerifying={isVerifyingOtp}
        onClose={() => setOtpModalOpen(false)}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
      />
    </MainLayout>
  );
}
