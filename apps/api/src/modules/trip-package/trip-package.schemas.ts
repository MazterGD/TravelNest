import { z } from "zod";

export const createTripPackageSchema = z.object({
  body: z
    .object({
      vehicleId: z.string().cuid("Invalid vehicle ID"),
      title: z.string().min(3, "Title must be at least 3 characters"),
      description: z.string().max(500).optional(),
      startLocation: z.string().min(2, "Start location is required"),
      endLocation: z.string().min(2, "End location is required"),
      durationDays: z.number().int().min(1, "Duration must be at least 1 day"),
      price: z.number().positive("Price must be positive"),
      minPassengers: z.number().int().min(1, "Minimum passengers required"),
      maxPassengers: z.number().int().min(1, "Maximum passengers required"),
      isActive: z.boolean().optional(),
    })
    .refine((data) => data.maxPassengers >= data.minPassengers, {
      message: "Maximum passengers must be greater than or equal to minimum",
      path: ["maxPassengers"],
    }),
});

export const updateTripPackageSchema = z.object({
  body: z
    .object({
      vehicleId: z.string().cuid("Invalid vehicle ID").optional(),
      title: z.string().min(3).optional(),
      description: z.string().max(500).optional(),
      startLocation: z.string().min(2).optional(),
      endLocation: z.string().min(2).optional(),
      durationDays: z.number().int().min(1).optional(),
      price: z.number().positive().optional(),
      minPassengers: z.number().int().min(1).optional(),
      maxPassengers: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) =>
        data.minPassengers === undefined ||
        data.maxPassengers === undefined ||
        data.maxPassengers >= data.minPassengers,
      {
        message: "Maximum passengers must be greater than or equal to minimum",
        path: ["maxPassengers"],
      },
    ),
  params: z.object({
    id: z.string().cuid("Invalid package ID"),
  }),
});

export const getTripPackageByIdSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid package ID"),
  }),
});

export const deleteTripPackageSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid package ID"),
  }),
});

export const bookTripPackageSchema = z.object({
  params: z.object({
    id: z.string().cuid("Invalid package ID"),
  }),
  body: z.object({
    startDate: z.string().datetime({ message: "Invalid start date" }),
    passengerCount: z.number().int().min(1, "Passenger count required"),
    notes: z.string().max(500).optional(),
  }),
});
