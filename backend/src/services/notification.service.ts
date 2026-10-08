import { Notification } from '../models';
import { emitToUser } from './socket.service';

export async function notify(userId: string, type: string, title: string, body = '', data: unknown = null): Promise<void> {
  const doc = await Notification.create({ user: userId, type, title, body, data });
  emitToUser(String(userId), 'notification', {
    id: String(doc._id),
    type,
    title,
    body,
    data,
    read: false,
    createdAt: doc.createdAt,
  });
}
