"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRepository, type Video } from "@/lib/data/repository";
import { getCurrentCustomerId } from "@/lib/demoSession";

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);

  useEffect(() => {
    const repo = getRepository();
    repo.getVideos().then((videos) => {
      const current = videos.find((v) => v.id === params.id) ?? null;
      setVideo(current);
      if (current) {
        setRelated(videos.filter((v) => v.category === current.category && v.id !== current.id).slice(0, 3));
        repo.markVideoWatched(getCurrentCustomerId(), current.id);
      }
    });
  }, [params.id]);

  if (!video) {
    return (
      <main className="flex-1 px-5 py-6">
        <p className="text-lf-muted">Video wird geladen…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-5 py-6">
      <button
        onClick={() => router.push("/videos")}
        className="mb-4 text-sm font-medium text-lf-ocean"
      >
        ← Zurück zur Video-Bibliothek
      </button>

      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.image} alt={video.title} className="h-72 w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/85 text-xl text-lf-ocean">
            ▶
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-lf-ocean">
        {video.category} · {video.duration}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{video.title}</h1>
      <p className="mt-3 leading-relaxed text-lf-muted">{video.description}</p>

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Verwandte Videos</h2>
          <div className="flex flex-col gap-3">
            {related.map((v) => (
              <Link key={v.id} href={`/videos/${v.id}`} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.image} alt={v.title} className="h-11 w-16 shrink-0 rounded-lg object-cover" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{v.title}</p>
                  <p className="text-xs text-lf-muted">
                    {v.category} · {v.duration}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
