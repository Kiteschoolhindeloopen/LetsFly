"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRepository, type Video, type VideoCategory } from "@/lib/data/repository";
import { getCurrentCustomerId } from "@/lib/demoSession";

const CATEGORIES: VideoCategory[] = [
  "Sicherheit & Material",
  "Wasserstart",
  "Bodydrag",
  "Erste Fahrversuche",
  "Tricks & Fortgeschritten",
  "Wind- & Wetterkunde",
];

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<VideoCategory | "Alle">("Alle");

  useEffect(() => {
    const repo = getRepository();
    Promise.all([repo.getVideos(), repo.getWatchedVideoIds(getCurrentCustomerId())]).then(
      ([allVideos, watched]) => {
        setVideos(allVideos);
        setWatchedIds(new Set(watched));
      }
    );
  }, []);

  const visible = videos?.filter((v) => activeCategory === "Alle" || v.category === activeCategory);

  return (
    <main className="flex-1 px-5 py-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Video-Bibliothek</h1>
      <p className="mt-2 text-lf-muted">Lernvideos zu jedem Level, jederzeit abrufbar.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["Alle", ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={
              activeCategory === cat
                ? "rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-lf-border px-4 py-2 text-sm font-medium text-lf-muted"
            }
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3.5">
        {visible?.map((video) => (
          <Link
            key={video.id}
            href={`/videos/${video.id}`}
            className="group overflow-hidden rounded-2xl border border-lf-border bg-lf-card shadow-sm"
          >
            <div className="relative h-40 w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video.image}
                alt={video.title}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
                {video.duration}
              </span>
              {watchedIds.has(video.id) && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                  ✓
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-lf-ocean">{video.category}</p>
              <p className="mt-1 font-semibold text-foreground">{video.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
