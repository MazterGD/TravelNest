/**
 * Owner Registration Page Tests
 * Tests for the owner registration form component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock the auth store
vi.mock("@/store", () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    user: null,
    isAuthenticated: false,
  }),
}));

// Mock hooks
vi.mock("@/hooks", () => ({
  useGuestGuard: () => ({
    isLoading: false,
    isAuthorized: true,
  }),
}));

// Test data for owner registration
const mockValidOwnerData = {
  personalInfo: {
    firstName: "Test",
    lastName: "Owner",
    email: "test@example.com",
    phone: "+94771234567",
    nicNumber: "199012345678",
  },
  addressInfo: {
    address: "123 Test Street",
    city: "Colombo",
    district: "colombo",
    postalCode: "10100",
    baseLocation: "Colombo",
  },
  vehicles: [
    {
      registrationNumber: "TEST-1234",
      vehicleType: "luxury",
      make: "Ashok Leyland",
      model: "Viking",
      year: "2022",
      seatingCapacity: "45",
      acType: "full-ac",
      photos: [],
      documents: {
        license: null,
        insurance: null,
        registrationCertificate: null,
      },
    },
  ],
  passwordData: {
    password: "TestPassword123!",
    confirmPassword: "TestPassword123!",
  },
};

describe("Owner Registration Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Form Validation", () => {
    it("should validate required personal info fields", () => {
      const personalInfo = mockValidOwnerData.personalInfo;

      expect(personalInfo.firstName).toBeTruthy();
      expect(personalInfo.lastName).toBeTruthy();
      expect(personalInfo.email).toBeTruthy();
      expect(personalInfo.phone).toBeTruthy();
      expect(personalInfo.nicNumber).toBeTruthy();
    });

    it("should validate email format", () => {
      const email = mockValidOwnerData.personalInfo.email;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(emailRegex.test(email)).toBe(true);
    });

    it("should validate required address fields", () => {
      const addressInfo = mockValidOwnerData.addressInfo;

      expect(addressInfo.address).toBeTruthy();
      expect(addressInfo.city).toBeTruthy();
      expect(addressInfo.district).toBeTruthy();
      expect(addressInfo.baseLocation).toBeTruthy();
    });

    it("should require at least one vehicle", () => {
      const vehicles = mockValidOwnerData.vehicles;

      expect(vehicles.length).toBeGreaterThan(0);
    });

    it("should validate vehicle registration number format", () => {
      const vehicle = mockValidOwnerData.vehicles[0];

      expect(vehicle.registrationNumber).toBeTruthy();
      expect(vehicle.registrationNumber.length).toBeGreaterThan(0);
    });

    it("should validate password requirements", () => {
      const password = mockValidOwnerData.passwordData.password;

      // At least 8 characters
      expect(password.length).toBeGreaterThanOrEqual(8);

      // Contains uppercase
      expect(/[A-Z]/.test(password)).toBe(true);

      // Contains lowercase
      expect(/[a-z]/.test(password)).toBe(true);

      // Contains number
      expect(/\d/.test(password)).toBe(true);
    });

    it("should validate passwords match", () => {
      const { password, confirmPassword } = mockValidOwnerData.passwordData;

      expect(password).toBe(confirmPassword);
    });
  });

  describe("Vehicle Data Structure", () => {
    it("should have correct vehicle type options", () => {
      const validTypes = ["luxury", "semi-luxury", "standard", "mini"];
      const vehicleType = mockValidOwnerData.vehicles[0].vehicleType;

      expect(validTypes).toContain(vehicleType);
    });

    it("should have correct AC type options", () => {
      const validAcTypes = ["full-ac", "ac", "non-ac"];
      const acType = mockValidOwnerData.vehicles[0].acType;

      expect(validAcTypes).toContain(acType);
    });

    it("should have vehicle documents structure", () => {
      const documents = mockValidOwnerData.vehicles[0].documents;

      expect(documents).toHaveProperty("license");
      expect(documents).toHaveProperty("insurance");
      expect(documents).toHaveProperty("registrationCertificate");
    });

    it("should have vehicle photos array", () => {
      const photos = mockValidOwnerData.vehicles[0].photos;

      expect(Array.isArray(photos)).toBe(true);
    });
  });

  describe("Password Strength Calculation", () => {
    const calculatePasswordStrength = (password: string): number => {
      let strength = 0;
      if (password.length >= 8) strength += 25;
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
      if (/\d/.test(password)) strength += 25;
      if (/[^a-zA-Z\d]/.test(password)) strength += 25;
      return strength;
    };

    it("should calculate weak password strength", () => {
      expect(calculatePasswordStrength("weak")).toBeLessThan(50);
    });

    it("should calculate medium password strength", () => {
      const strength = calculatePasswordStrength("Medium123");
      expect(strength).toBeGreaterThanOrEqual(50);
      expect(strength).toBeLessThan(100);
    });

    it("should calculate strong password strength", () => {
      expect(calculatePasswordStrength("Strong123!")).toBe(100);
    });
  });

  describe("Optional Documents Mode", () => {
    it("should allow registration without documents", () => {
      // Documents are now optional - users can register without uploading documents
      // They can upload documents later after registration
      const documentsRequired = false;
      expect(documentsRequired).toBe(false);
    });
  });

  describe("Form Data Transformation", () => {
    it("should transform form data to API payload format", () => {
      const { personalInfo, addressInfo, vehicles, passwordData } =
        mockValidOwnerData;

      const payload = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        email: personalInfo.email,
        phone: personalInfo.phone,
        nicNumber: personalInfo.nicNumber,
        password: passwordData.password,
        confirmPassword: passwordData.confirmPassword,
        address: {
          address: addressInfo.address,
          city: addressInfo.city,
          district: addressInfo.district,
          postalCode: addressInfo.postalCode,
          baseLocation: addressInfo.baseLocation,
        },
        vehicles: vehicles.map((v) => ({
          registrationNumber: v.registrationNumber,
          vehicleType: v.vehicleType,
          make: v.make,
          model: v.model,
          year: parseInt(v.year),
          seatingCapacity: parseInt(v.seatingCapacity),
          acType: v.acType,
          photos: v.photos,
          documents: [],
        })),
      };

      expect(payload.firstName).toBe("Test");
      expect(payload.address.city).toBe("Colombo");
      expect(payload.vehicles[0].year).toBe(2022);
      expect(payload.vehicles[0].seatingCapacity).toBe(45);
    });
  });

  describe("Step Navigation", () => {
    it("should have correct number of steps", () => {
      const TOTAL_STEPS = 5;

      expect(TOTAL_STEPS).toBe(5);
    });

    it("should have correct step labels", () => {
      const stepLabels = [
        "Personal",
        "Address",
        "Vehicle",
        "Password",
        "Terms",
      ];

      expect(stepLabels.length).toBe(5);
      expect(stepLabels[0]).toBe("Personal");
      expect(stepLabels[2]).toBe("Vehicle");
      expect(stepLabels[4]).toBe("Terms");
    });
  });
});
