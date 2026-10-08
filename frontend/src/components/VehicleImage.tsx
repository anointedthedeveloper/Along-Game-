import { cn } from '@/components/ui';
import type { VehicleClass } from '@/types';

export const VEHICLE_PHOTO: Record<VehicleClass, string> = {
  MOTORCYCLE: 'okada', KEKE: 'keke', SEDAN_TAXI: 'sedan_taxi', COROLLA: 'corolla', CAMRY: 'camry',
  MINIBUS: 'minibus', BUS: 'bus', PRIVATE_CAR: 'private_car',
};

const POSITION: Partial<Record<VehicleClass, string>> = { KEKE: 'center 40%', MOTORCYCLE: 'center 60%', CAMRY: 'center 55%' };

export function VehicleImage({ cls, className, alt }: { cls: VehicleClass; className?: string; alt?: string }) {
  return (
    <img
      src={`/images/vehicles/${VEHICLE_PHOTO[cls]}.jpg`}
      alt={alt ?? cls.replace('_', ' ').toLowerCase()}
      loading="lazy"
      className={cn('bg-asphalt-700 object-cover', className)}
      style={{ objectPosition: POSITION[cls] ?? 'center' }}
    />
  );
}
