import type { Request, Response } from 'express';
import { me } from '../middleware/auth';
import * as rides from '../services/ride.service';
import * as offers from '../services/offer.service';

const id = (req: Request) => String(req.params.id);

export const list = async (req: Request, res: Response) => {
  const q = req.query as unknown as { status?: string; limit: number; skip: number };
  res.json(await rides.listRides(me(req), q));
};
export const active = async (req: Request, res: Response) => res.json({ ride: await rides.activeRide(me(req)) });
export const offersList = async (req: Request, res: Response) => res.json({ offers: await offers.listOffers(me(req)) });
export const quote = async (req: Request, res: Response) => res.json(rides.buildQuote(me(req), req.body.originKey, req.body.destinationKey));
export const create = async (req: Request, res: Response) => res.status(201).json({ ride: await rides.requestRide(me(req), req.body) });
export const get = async (req: Request, res: Response) => res.json({ ride: await rides.getRide(me(req), id(req)) });
export const accept = async (req: Request, res: Response) => res.json({ ride: await rides.acceptOffer(me(req), id(req)) });
export const decline = async (req: Request, res: Response) => res.json({ ride: await rides.declineOffer(me(req), id(req)) });
export const start = async (req: Request, res: Response) => res.json({ ride: await rides.startRide(me(req), id(req)) });
export const complete = async (req: Request, res: Response) => res.json(await rides.completeRide(me(req), id(req)));
export const cancel = async (req: Request, res: Response) => res.json(await rides.cancelRide(me(req), id(req), req.body.reason));
export const rate = async (req: Request, res: Response) => res.json(await rides.rateRide(me(req), id(req), req.body));
