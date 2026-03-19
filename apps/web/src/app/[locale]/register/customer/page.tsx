"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaBuilding,
  FaCheckCircle,
} from "react-icons/fa";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/ui";
import { authService, ApiError } from "@/lib/api";
import { getDashboardUrl } from "@/lib/utils/getDashboardUrl";
import { useAuthStore } from "@/store";
import { useGuestGuard } from "@/hooks";

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
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    // Client-side validation
    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: t("errors.passwordMismatch") });
      setIsLoading(false);
      return;
    }

    if (!formData.termsAccepted || !formData.privacyAccepted) {
      setError(t("errors.acceptTerms"));
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.register({
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        role: "customer",
      });

      // Store user and token in auth store
      login(response.user, response.accessToken);

      // Redirect to role-specific dashboard
      router.push(getDashboardUrl(response.user, locale));
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
      setIsLoading(false);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Sidebar - Information */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-3xl shadow-2xl p-8 border-2 border-gray-100 sticky top-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    {t("sidebar.title")}
                  </h2>
                  <p className="text-gray-600 leading-relaxed">
                    {t("sidebar.subtitle")}
                  </p>
                </div>

                <div className="relative h-64 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-primary/20 to-primary/10">
                  <Image
                    src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600"
                    alt="Travel with TraveNest"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        {t("sidebar.benefits.easyBooking.title")}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {t("sidebar.benefits.easyBooking.description")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        {t("sidebar.benefits.verifiedOperators.title")}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {t("sidebar.benefits.verifiedOperators.description")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        {t("sidebar.benefits.support.title")}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {t("sidebar.benefits.support.description")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3">
                    {t("sidebar.hasAccount")}
                  </p>
                  <Link
                    href={`/${locale}/login`}
                    className="block w-full py-3 border-2 border-primary text-primary rounded-xl hover:bg-primary hover:text-white transition-all font-semibold text-center"
                  >
                    {t("sidebar.signIn")}
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Side - Registration Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-gray-100">
                <div className="mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {t("title")}
                  </h1>
                  <p className="text-lg text-gray-600">{t("subtitle")}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {error && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Personal Information Section */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-primary/20">
                      {t("sections.personalInfo")}
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          {t("fields.firstName.label")}
                        </label>
                        <div className="relative group">
                          <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="text"
                            name="firstName"
                            required
                            value={formData.firstName}
                            onChange={handleChange}
                            placeholder={t("fields.firstName.placeholder")}
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                        {fieldErrors.firstName && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.firstName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          {t("fields.lastName.label")}
                        </label>
                        <div className="relative group">
                          <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="text"
                            name="lastName"
                            required
                            value={formData.lastName}
                            onChange={handleChange}
                            placeholder={t("fields.lastName.placeholder")}
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                        {fieldErrors.lastName && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.lastName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          {t("fields.email.label")}
                        </label>
                        <div className="relative group">
                          <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder={t("fields.email.placeholder")}
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                        {fieldErrors.email && (
                          <p className="mt-1 text-sm text-red-600">
                            {fieldErrors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          {t("fields.phone.label")}
                        </label>
                        <div className="relative group">
                          <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="tel"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder={t("fields.phone.placeholder")}
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
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
                    <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-primary/20">
                      Organization Details (Optional)
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          Organization Name
                        </label>
                        <div className="relative group">
                          <FaBuilding className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type="text"
                            name="organizationName"
                            value={formData.organizationName}
                            onChange={handleChange}
                            placeholder="Company or organization name"
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          Organization Type
                        </label>
                        <select
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
                    <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-primary/20">
                      {t("sections.addressInfo")}
                    </h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          {t("fields.address.label")}
                        </label>
                        <div className="relative group">
                          <FaMapMarkerAlt className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <textarea
                            name="address"
                            required
                            value={formData.address}
                            onChange={handleChange}
                            rows={3}
                            placeholder={t("fields.address.placeholder")}
                            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white resize-none"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            {t("fields.city.label")}
                          </label>
                          <input
                            type="text"
                            name="city"
                            required
                            value={formData.city}
                            onChange={handleChange}
                            placeholder={t("fields.city.placeholder")}
                            className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-lg font-semibold text-gray-800 mb-2">
                            {t("fields.postalCode.label")}
                          </label>
                          <input
                            type="text"
                            name="postalCode"
                            value={formData.postalCode}
                            onChange={handleChange}
                            placeholder={t("fields.postalCode.placeholder")}
                            className="w-full px-4 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Password Section */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-primary/20">
                      {t("sections.password")}
                    </h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          {t("fields.password.label")}
                        </label>
                        <div className="relative group">
                          <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder={t("fields.password.placeholder")}
                            className="w-full pl-12 pr-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                          >
                            {showPassword ? (
                              <FaEyeSlash className="w-5 h-5" />
                            ) : (
                              <FaEye className="w-5 h-5" />
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
                        <label className="block text-lg font-semibold text-gray-800 mb-2">
                          {t("fields.confirmPassword.label")}
                        </label>
                        <div className="relative group">
                          <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder={t(
                              "fields.confirmPassword.placeholder",
                            )}
                            className="w-full pl-12 pr-12 py-4 text-lg border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all bg-gray-50 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                          >
                            {showConfirmPassword ? (
                              <FaEyeSlash className="w-5 h-5" />
                            ) : (
                              <FaEye className="w-5 h-5" />
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
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1"
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
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary mt-1"
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
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-primary to-primary/90 text-white py-5 rounded-xl hover:shadow-xl hover:shadow-primary/30 transition-all text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
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
    </MainLayout>
  );
}
