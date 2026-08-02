import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { Notification } from "../types";
import { mapNotification, type NotificationRow } from "./mappers";

export async function getNotifications(customerId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("customer_id", customerId)
    .order("id", { ascending: false });
  if (error) throw error;
  return (data as NotificationRow[]).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ unread: false })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(customerId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ unread: false })
    .eq("customer_id", customerId);
  if (error) throw error;
}

export async function createNotification(input: {
  customerId: string;
  icon: string;
  title: string;
  message: string;
}): Promise<Notification> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      id: newId("notif"),
      customer_id: input.customerId,
      icon: input.icon,
      title: input.title,
      message: input.message,
      time: "Gerade eben",
      unread: true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapNotification(data as NotificationRow);
}
