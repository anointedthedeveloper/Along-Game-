import type { Request, Response } from 'express';
import { me } from '../middleware/auth';
import * as vehicles from '../services/vehicle.service';
import * as fleet from '../services/fleet.service';

export const list = async (req: Request, res: Response) => res.json({ vehicles: await vehicles.listVehicles(me(req)) });
export const catalog = async (req: Request, res: Response) => res.json(await vehicles.catalog(me(req)));
export const buy = async (req: Request, res: Response) => {
  const vehicle = await vehicles.buyVehicle(me(req), req.body.specId, req.body.paymentMethod);
  res.status(201).json({ vehicle });
};
export const activate = async (req: Request, res: Response) => res.json({ vehicle: await vehicles.activate(me(req), String(req.params.id)) });
export const refuel = async (req: Request, res: Response) => res.json(await vehicles.refuel(me(req), String(req.params.id), req.body));
export const repair = async (req: Request, res: Response) => res.json(await vehicles.repair(me(req), String(req.params.id), req.body.toCondition));
export const wash = async (req: Request, res: Response) => res.json(await vehicles.wash(me(req), String(req.params.id)));
export const upgrade = async (req: Request, res: Response) => res.json(await vehicles.upgrade(me(req), String(req.params.id), req.body.kind));
export const rename = async (req: Request, res: Response) => res.json({ vehicle: await vehicles.rename(me(req), String(req.params.id), req.body.nickname) });

export const fleetList = async (req: Request, res: Response) => res.json(await fleet.listFleet(me(req)));
export const hire = async (req: Request, res: Response) => res.json({ vehicle: await fleet.hireDriver(me(req), String(req.params.id)) });
export const dismiss = async (req: Request, res: Response) => res.json({ vehicle: await fleet.dismissDriver(me(req), String(req.params.id)) });
export const collect = async (req: Request, res: Response) => res.json(await fleet.collectFleet(me(req)));
