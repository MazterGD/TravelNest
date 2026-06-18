import type { Request, Response } from "express";
import * as driverService from "./driver.service.js";

export const list = async (req: Request, res: Response) => {
  const drivers = await driverService.listDrivers(req.user!.id);
  res.json({ success: true, data: { drivers } });
};

export const getOne = async (req: Request, res: Response) => {
  const driver = await driverService.getDriver(
    req.params.id as string,
    req.user!.id,
  );
  res.json({ success: true, data: { driver } });
};

export const create = async (req: Request, res: Response) => {
  const driver = await driverService.createDriver(req.user!.id, req.body);
  res.status(201).json({ success: true, data: { driver } });
};

export const update = async (req: Request, res: Response) => {
  const driver = await driverService.updateDriver(
    req.params.id as string,
    req.user!.id,
    req.body,
  );
  res.json({ success: true, data: { driver } });
};

export const remove = async (req: Request, res: Response) => {
  await driverService.deleteDriver(req.params.id as string, req.user!.id);
  res.json({ success: true, message: "Driver deleted" });
};

export const assignToBooking = async (req: Request, res: Response) => {
  const booking = await driverService.assignDriverToBooking(
    req.params.bookingId as string,
    req.user!.id,
    req.body.driverId,
  );
  res.json({ success: true, data: { booking } });
};

export const unassignFromBooking = async (req: Request, res: Response) => {
  const booking = await driverService.unassignDriverFromBooking(
    req.params.bookingId as string,
    req.user!.id,
  );
  res.json({ success: true, data: { booking } });
};

export const getAvailable = async (req: Request, res: Response) => {
  const { startDate, endDate, excludeBookingId } = req.query as Record<
    string,
    string
  >;

  if (!startDate || !endDate) {
    res.status(400).json({
      success: false,
      error: { message: "startDate and endDate are required" },
    });
    return;
  }

  const drivers = await driverService.getAvailableDrivers(
    req.user!.id,
    new Date(startDate),
    new Date(endDate),
    excludeBookingId,
  );

  res.json({ success: true, data: { drivers } });
};
