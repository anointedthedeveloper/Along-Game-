import type { Request, Response } from 'express';
import { me } from '../middleware/auth';
import * as events from '../services/event.service';
import { withEvents } from '../services/ride.service';

export const list = async (req: Request, res: Response) => {
  res.json({ events: await events.listEvents(me(req), req.query as { status?: string; ride?: string; limit?: number }) });
};
export const resolve = async (req: Request, res: Response) => {
  const result = await events.resolveEvent(me(req), String(req.params.id), req.body.optionId);
  res.json({ event: result.event, applied: result.applied, ride: await withEvents(result.ride, String(me(req)._id)) });
};
