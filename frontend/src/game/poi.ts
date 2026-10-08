import type { LocationType } from '@/types';

export const POI_COLOR: Record<LocationType, string> = {
  PETROL_STATION: '#d9961a', GARAGE: '#5f7587', BUS_STOP: '#2f7fd1', MOTOR_PARK: '#2468b3', MARKET: '#d9712b', MALL: '#a24bb0',
  HOSPITAL: '#d63a3a', GOVERNMENT: '#3b6e8f', HOTEL: '#8a5a2b', AIRPORT: '#1f6bb0', SCHOOL: '#5f9b2f', RESIDENTIAL: '#7b7f86',
  BUSINESS: '#4a5d78', PARKING: '#2f7fd1', LANDMARK: '#c0392b', DISTRICT: '#222',
};

/** Draw a small white pictogram centred at 0,0 inside a badge of radius r. */
export function drawPoiGlyph(ctx: CanvasRenderingContext2D, type: LocationType, r: number): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const u = r / 10;
  switch (type) {
    case 'PETROL_STATION':
      ctx.fillRect(-4.5 * u, -5.5 * u, 6.5 * u, 11 * u);
      ctx.clearRect(-3 * u, -4 * u, 3.5 * u, 3 * u);
      ctx.beginPath();
      ctx.moveTo(2.5 * u, -2 * u);
      ctx.lineTo(5 * u, -2 * u);
      ctx.lineTo(5 * u, 3 * u);
      ctx.stroke();
      break;
    case 'GARAGE':
      ctx.beginPath();
      ctx.moveTo(-4.5 * u, 4.5 * u);
      ctx.lineTo(2 * u, -2 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3 * u, -3 * u, 3.2 * u, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'BUS_STOP':
    case 'MOTOR_PARK':
      ctx.beginPath();
      ctx.roundRect(-5 * u, -5 * u, 10 * u, 9 * u, 1.6 * u);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-3.8 * u, -3.8 * u, 7.6 * u, 3.2 * u);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-2.6 * u, 5 * u, 1.2 * u, 0, Math.PI * 2);
      ctx.arc(2.6 * u, 5 * u, 1.2 * u, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'MARKET':
    case 'MALL':
      ctx.beginPath();
      ctx.moveTo(-4.5 * u, -2 * u);
      ctx.lineTo(4.5 * u, -2 * u);
      ctx.lineTo(3.6 * u, 5 * u);
      ctx.lineTo(-3.6 * u, 5 * u);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -2.5 * u, 2.6 * u, Math.PI, 0);
      ctx.stroke();
      break;
    case 'HOSPITAL':
      ctx.fillRect(-1.6 * u, -5.5 * u, 3.2 * u, 11 * u);
      ctx.fillRect(-5.5 * u, -1.6 * u, 11 * u, 3.2 * u);
      break;
    case 'GOVERNMENT':
      ctx.beginPath();
      ctx.moveTo(-5.5 * u, -2.5 * u);
      ctx.lineTo(0, -6 * u);
      ctx.lineTo(5.5 * u, -2.5 * u);
      ctx.closePath();
      ctx.fill();
      for (const x of [-3.6, -1.2, 1.2, 3.6]) ctx.fillRect((x - 0.5) * u, -1.5 * u, 1 * u, 5.5 * u);
      ctx.fillRect(-5.5 * u, 4.4 * u, 11 * u, 1.4 * u);
      break;
    case 'HOTEL':
      ctx.fillRect(-5.5 * u, 0, 11 * u, 3.2 * u);
      ctx.fillRect(-5.5 * u, -4.5 * u, 1.4 * u, 8.5 * u);
      ctx.beginPath();
      ctx.arc(-2 * u, -1.2 * u, 1.6 * u, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'AIRPORT':
      ctx.beginPath();
      ctx.moveTo(0, -6 * u);
      ctx.lineTo(1.4 * u, -1 * u);
      ctx.lineTo(6 * u, 1.6 * u);
      ctx.lineTo(1.2 * u, 1.2 * u);
      ctx.lineTo(1.2 * u, 4 * u);
      ctx.lineTo(3 * u, 5.4 * u);
      ctx.lineTo(0, 4.8 * u);
      ctx.lineTo(-3 * u, 5.4 * u);
      ctx.lineTo(-1.2 * u, 4 * u);
      ctx.lineTo(-1.2 * u, 1.2 * u);
      ctx.lineTo(-6 * u, 1.6 * u);
      ctx.lineTo(-1.4 * u, -1 * u);
      ctx.closePath();
      ctx.fill();
      break;
    case 'SCHOOL':
      ctx.beginPath();
      ctx.moveTo(-6 * u, -1 * u);
      ctx.lineTo(0, -4.5 * u);
      ctx.lineTo(6 * u, -1 * u);
      ctx.lineTo(0, 2 * u);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-3.4 * u, 1 * u, 6.8 * u, 3.6 * u);
      break;
    case 'RESIDENTIAL':
      ctx.beginPath();
      ctx.moveTo(-5.5 * u, 0);
      ctx.lineTo(0, -5.5 * u);
      ctx.lineTo(5.5 * u, 0);
      ctx.lineTo(4 * u, 0);
      ctx.lineTo(4 * u, 5 * u);
      ctx.lineTo(-4 * u, 5 * u);
      ctx.lineTo(-4 * u, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'BUSINESS':
      ctx.fillRect(-3.5 * u, -5.5 * u, 7 * u, 11 * u);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (const y of [-3.5, -0.8, 1.9]) {
        ctx.fillRect(-2 * u, y * u, 1.6 * u, 1.4 * u);
        ctx.fillRect(0.4 * u, y * u, 1.6 * u, 1.4 * u);
      }
      break;
    case 'PARKING':
      ctx.font = `bold ${Math.round(r * 1.5)}px Barlow, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', 0, r * 0.08);
      break;
    case 'LANDMARK':
    default:
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        ctx.lineTo(Math.cos(a) * 5.6 * u, Math.sin(a) * 5.6 * u);
      }
      ctx.closePath();
      ctx.fill();
  }
  ctx.restore();
}
