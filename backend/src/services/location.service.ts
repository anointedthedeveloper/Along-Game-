import { LOCATIONS } from '../data/world';
import { Location } from '../models';

/** Keep the Location collection in sync with the world definition on every boot. */
export async function seedLocations(): Promise<void> {
  await Location.bulkWrite(
    LOCATIONS.map((l) => ({
      updateOne: {
        filter: { key: l.key },
        update: { $set: { name: l.name, type: l.type, district: l.district, nodeId: l.nodeId, lat: l.pos[0], lng: l.pos[1], description: l.description } },
        upsert: true,
      },
    })),
  );
}
