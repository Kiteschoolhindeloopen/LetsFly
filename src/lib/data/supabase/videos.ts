import { supabase } from "@/lib/supabase/client";
import type { Video } from "../types";
import { mapVideo, type VideoRow } from "./mappers";

export async function getVideos(): Promise<Video[]> {
  const { data, error } = await supabase.from("videos").select("*");
  if (error) throw error;
  return (data as VideoRow[]).map(mapVideo);
}

export async function getWatchedVideoIds(customerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("watched_videos")
    .select("video_id")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as { video_id: string }[]).map((row) => row.video_id);
}

export async function markVideoWatched(customerId: string, videoId: string): Promise<void> {
  const { error } = await supabase
    .from("watched_videos")
    .upsert({ customer_id: customerId, video_id: videoId }, { onConflict: "customer_id,video_id" });
  if (error) throw error;
}
