import { Router } from 'express';
import { authenticate, requireMode, requireRole } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import * as S from '../utils/schemas';
import * as authC from '../controllers/auth.controller';
import * as userC from '../controllers/user.controller';
import * as vehicleC from '../controllers/vehicle.controller';
import * as rideC from '../controllers/ride.controller';
import * as walletC from '../controllers/wallet.controller';
import * as eventC from '../controllers/event.controller';
import * as worldC from '../controllers/world.controller';
import * as adminC from '../controllers/admin.controller';

const api = Router();

/* auth */
const auth = Router();
auth.post('/register', authLimiter, validate(S.registerSchema), h(authC.register));
auth.post('/login', authLimiter, validate(S.loginSchema), h(authC.login));
auth.post('/logout', authenticate, h(authC.logout));
auth.post('/forgot-password', authLimiter, validate(S.forgotSchema), h(authC.forgotPassword));
auth.post('/reset-password', authLimiter, validate(S.resetSchema), h(authC.resetPassword));
auth.get('/session', authenticate, h(authC.session));
api.use('/auth', auth);

/* world data that does not need a session */
api.get('/world', h(async (req, res) => worldC.snapshot(req, res)));
api.get('/world/map', worldC.map);
api.get('/world/route', validate(S.routeQuery, 'query'), worldC.route);
api.get('/locations', h(worldC.locations));
api.get('/leaderboard', h(worldC.leaderboard));

/* everything below needs a signed-in player */
api.use(authenticate);

const users = Router();
users.get('/me', h(userC.getMe));
users.patch('/me', validate(S.profileSchema), h(userC.updateMe));
users.patch('/me/password', validate(S.changePasswordSchema), h(userC.changePassword));
users.get('/me/notifications', h(userC.notifications));
users.post('/me/notifications/read', h(userC.markNotificationsRead));
users.get('/me/ratings', h(userC.myRatings));
api.use('/users', users);

const game = Router();
game.get('/state', h(worldC.state));
game.get('/progress', h(worldC.progress));
game.get('/day/checklist', requireMode('DRIVER'), h(worldC.checklist));
game.post('/day/start', requireMode('DRIVER'), h(worldC.startDay));
game.post('/day/end', requireMode('DRIVER'), h(worldC.endDay));
game.post('/travel', requireMode('DRIVER'), validate(S.travelSchema), h(worldC.travel));
game.post('/location', requireMode('PASSENGER'), validate(S.locationSchema), h(worldC.setLocation));
api.use('/game', game);

const vehicles = Router();
vehicles.get('/', h(vehicleC.list));
vehicles.get('/catalog', h(vehicleC.catalog));
vehicles.post('/', validate(S.buyVehicleSchema), h(vehicleC.buy));
vehicles.patch('/:id/activate', validate(S.idParam, 'params'), h(vehicleC.activate));
vehicles.post('/:id/refuel', validate(S.idParam, 'params'), validate(S.refuelSchema), h(vehicleC.refuel));
vehicles.post('/:id/repair', validate(S.idParam, 'params'), validate(S.repairSchema), h(vehicleC.repair));
vehicles.post('/:id/wash', validate(S.idParam, 'params'), h(vehicleC.wash));
vehicles.post('/:id/upgrade', validate(S.idParam, 'params'), validate(S.upgradeSchema), h(vehicleC.upgrade));
vehicles.patch('/:id', validate(S.idParam, 'params'), validate(S.renameSchema), h(vehicleC.rename));
api.use('/vehicles', vehicles);

const fleet = Router();
fleet.get('/', h(vehicleC.fleetList));
fleet.post('/collect', h(vehicleC.collect));
fleet.post('/:id/hire', validate(S.idParam, 'params'), h(vehicleC.hire));
fleet.delete('/:id/driver', validate(S.idParam, 'params'), h(vehicleC.dismiss));
api.use('/fleet', fleet);

const rides = Router();
rides.get('/', validate(S.ridesQuery, 'query'), h(rideC.list));
rides.get('/active', h(rideC.active));
rides.get('/offers', requireMode('DRIVER'), h(rideC.offersList));
rides.post('/quote', requireMode('PASSENGER'), validate(S.quoteSchema), h(rideC.quote));
rides.post('/', requireMode('PASSENGER'), validate(S.requestRideSchema), h(rideC.create));
rides.get('/:id', validate(S.idParam, 'params'), h(rideC.get));
rides.patch('/:id/accept', validate(S.idParam, 'params'), h(rideC.accept));
rides.patch('/:id/decline', validate(S.idParam, 'params'), h(rideC.decline));
rides.patch('/:id/start', validate(S.idParam, 'params'), h(rideC.start));
rides.patch('/:id/complete', validate(S.idParam, 'params'), h(rideC.complete));
rides.patch('/:id/cancel', validate(S.idParam, 'params'), validate(S.cancelSchema), h(rideC.cancel));
rides.post('/:id/rate', validate(S.idParam, 'params'), validate(S.rateSchema), h(rideC.rate));
api.use('/rides', rides);

const wallet = Router();
wallet.get('/', h(walletC.get));
wallet.post('/deposit', validate(S.amountSchema), h(walletC.deposit));
wallet.post('/withdraw', validate(S.amountSchema), h(walletC.withdraw));
api.use('/wallet', wallet);
api.get('/transactions', validate(S.txQuery, 'query'), h(walletC.transactions));

const events = Router();
events.get('/', validate(S.eventsQuery, 'query'), h(eventC.list));
events.post('/:id/resolve', validate(S.idParam, 'params'), validate(S.resolveEventSchema), h(eventC.resolve));
api.use('/events', events);

const admin = Router();
admin.use(requireRole('ADMIN'));
admin.get('/overview', h(adminC.overview));
api.use('/admin', admin);

export default api;
