"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  MapPin,
  ArrowRight,
  Camera,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface CompanyPhoto {
  label: string
  url: string
  position?: string
}

export interface JobAnnouncement {
  id: string
  company: string
  companyTicker: string
  category: string
  headline: string
  description: string
  branches: {
    us: string
    india: string
  }
  compensation: string
  tags: string[]
  applyHref: string
  mockHref: string
  logoIcon: string
  logoBadge: string
  accentColor: string
  photos: CompanyPhoto[]
}

const announcements: JobAnnouncement[] = [
  {
    id: "amazon-sde2-cloud",
    company: "Amazon (AWS)",
    companyTicker: "AMZN · NASDAQ",
    category: "Cloud Infrastructure",
    headline: "Amazon Global SDE-II & Systems Architecture Wave",
    description:
      "Amazon is expanding core AWS EC2 and S3 hyper-scale distributed storage engineering across Seattle HQ and Amazon's largest global campus in Hyderabad.",
    branches: {
      us: "Seattle Spheres & Day 1 HQ, WA, USA",
      india: "Gachibowli Campus, Hyderabad, India",
    },
    compensation: "$168k – $225k / ₹48L – ₹68L CTC",
    tags: ["AWS S3/EC2", "Distributed Systems", "Go/Java"],
    applyHref: "/jobs",
    mockHref: "/interview",
    logoIcon: "/companies/amazon-icon.svg",
    logoBadge: "/companies/amazon-logo.svg",
    accentColor: "#fa4f61",
    photos: [
      {
        label: "Seattle Spheres HQ",
        url: "/companies/amazon-us.jpg",
        position: "center center",
      },
      {
        label: "Hyderabad Tech Campus",
        url: "/companies/amazon-in.jpg",
        position: "center center",
      },
    ],
  },
  {
    id: "google-deepmind-systems",
    company: "Google (Alphabet)",
    companyTicker: "GOOGL · NASDAQ",
    category: "DeepMind & ML Platform",
    headline: "Google DeepMind: Senior Machine Learning Systems",
    description:
      "Scaling distributed TPU model-serving clusters and low-latency tensor inference across Bay View Campus (Mountain View) and Bengaluru R&D.",
    branches: {
      us: "Bay View & Googleplex, Mountain View, CA, USA",
      india: "Bagmane Tech Park, Bengaluru, India",
    },
    compensation: "$195k – $275k / ₹55L – ₹82L CTC",
    tags: ["TPU Platform", "JAX / C++", "Inference"],
    applyHref: "/jobs",
    mockHref: "/interview",
    logoIcon: "/companies/google-icon.svg",
    logoBadge: "/companies/google-logo.svg",
    accentColor: "#fa4f61",
    photos: [
      {
        label: "Mountain View Googleplex",
        url: "/companies/google-us.jpg",
        position: "center center",
      },
      {
        label: "Hyderabad Tech Center",
        url: "/companies/google-in.jpg",
        position: "center center",
      },
    ],
  },
  {
    id: "microsoft-azure-copilot",
    company: "Microsoft",
    companyTicker: "MSFT · NASDAQ",
    category: "Hyperscale Cloud & Enterprise AI",
    headline: "Microsoft Azure Cloud & Copilot Distributed Systems",
    description:
      "Building hyper-scale Kubernetes mesh clusters and enterprise Copilot backends across Redmond Main Campus and Microsoft IDC Hyderabad.",
    branches: {
      us: "Microsoft Redmond Main Campus, WA, USA",
      india: "IDC Hyderabad & Bengaluru, India",
    },
    compensation: "$172k – $240k / ₹44L – ₹65L CTC",
    tags: ["Azure Kubernetes", "Distributed Microservices", "C# / Go"],
    applyHref: "/jobs",
    mockHref: "/interview",
    logoIcon: "/companies/microsoft-icon.svg",
    logoBadge: "/companies/microsoft-logo.svg",
    accentColor: "#fa4f61",
    photos: [
      {
        label: "Redmond Building 92",
        url: "/companies/microsoft-us.jpg",
        position: "left 75%",
      },
      {
        label: "Microsoft IDC Hyderabad",
        url: "/companies/microsoft-in.jpg",
        position: "center center",
      },
    ],
  },
  {
    id: "apple-silicon-intelligence",
    company: "Apple",
    companyTicker: "AAPL · NASDAQ",
    category: "Apple Silicon & CoreOS",
    headline: "Apple Silicon & Real-Time Foundation Model Firmware",
    description:
      "Developing neural engine firmware, Metal shader pipelines, and real-time audio/vision intelligence at Apple Park Cupertino.",
    branches: {
      us: "Apple Park 1 Way, Cupertino, CA, USA",
      india: "WaveRock Hardware Tech Center, Hyderabad",
    },
    compensation: "$180k – $260k / ₹52L – ₹76L CTC",
    tags: ["Metal / Swift", "Embedded C++", "Neural Engine"],
    applyHref: "/jobs",
    mockHref: "/interview",
    logoIcon: "/companies/apple-icon.svg",
    logoBadge: "/companies/apple-logo.svg",
    accentColor: "#fa4f61",
    photos: [
      {
        label: "Apple Park Cupertino",
        url: "/companies/apple-us.jpg",
        position: "center center",
      },
      {
        label: "WaveRock Hyderabad Center",
        url: "/companies/apple-in.jpg",
        position: "center center",
      },
    ],
  },
  {
    id: "nvidia-ai-infrastructure",
    company: "NVIDIA",
    companyTicker: "NVDA · NASDAQ",
    category: "Accelerated Computing & Blackwell",
    headline: "NVIDIA Blackwell GPU Supercluster Systems Engineering",
    description:
      "Building hyper-scale CUDA fabrics, NVLink switches, and low-latency transformer inference kernels across Santa Clara HQ.",
    branches: {
      us: "Voyager & Endeavor Campus, Santa Clara, CA, USA",
      india: "NVIDIA Tech Center, Pune & Bengaluru",
    },
    compensation: "$210k – $310k / ₹60L – ₹95L CTC",
    tags: ["CUDA / C++", "NVLink Fabric", "Blackwell GPU"],
    applyHref: "/jobs",
    mockHref: "/interview",
    logoIcon: "/companies/nvidia-icon.svg",
    logoBadge: "/companies/nvidia-logo.svg",
    accentColor: "#fa4f61",
    photos: [
      {
        label: "Santa Clara Endeavor HQ",
        url: "/companies/nvidia-us.jpg",
        position: "center center",
      },
      {
        label: "NVIDIA Pune Center",
        url: "/companies/nvidia-in.jpg",
        position: "center center",
      },
    ],
  },
]

export function AnnouncementCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})

  const current = announcements[currentIndex]

  // Auto-rotation every 6s
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length)
      setPhotoIndex(0)
    }, 6000)
    return () => clearInterval(timer)
  }, [isPaused])

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length)
    setPhotoIndex(0)
  }, [])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % announcements.length)
    setPhotoIndex(0)
  }, [])

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const activePhoto = current.photos[photoIndex] || current.photos[0]

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        "relative w-full max-w-[400px] sm:max-w-[420px] aspect-square rounded-3xl overflow-hidden border border-zinc-800/80 dark:border-white/15",
        "bg-zinc-950 text-white shadow-xl select-none cursor-pointer"
      )}
    >
      {/* Real Architectural Company Campus Photo with 4-Sided Soft Edge Fade */}
      <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl">
        <div
          className="absolute inset-0 bg-cover carousel-image-fade"
          style={{
            backgroundImage: `url(${activePhoto.url})`,
            backgroundPosition: activePhoto.position || "center",
          }}
        />
        {/* Soft 4-sided perimeter fade so the photo dissolves smoothly into the website */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-zinc-950/80 via-zinc-950/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-zinc-950/85 via-zinc-950/35 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-zinc-950/70 via-zinc-950/25 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950/70 via-zinc-950/25 to-transparent" />

        {/* Ambient radial vignette deepening the 4 corners and edges */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(9,9,11,0.5)_85%,rgba(9,9,11,0.85)_100%)]" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex h-full flex-col justify-between p-3.5 sm:p-4">
        {/* Top Header Pill Bar: Company Tag, Campus Switcher & Bookmark */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-2 rounded-full visionos-carousel-pill px-3 py-1 text-xs font-medium text-white shadow-md">
              <img
                src={current.logoIcon}
                alt={current.company}
                className="size-3.5 shrink-0 object-contain drop-shadow-xs"
              />
              <span>{current.company}</span>
            </span>

            {/* Campus Photo Switcher Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPhotoIndex((p) => (p + 1) % current.photos.length)
              }}
              className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-white visionos-carousel-pill px-2.5 py-1 rounded-full shadow-md transition-colors hover:bg-white/20 cursor-pointer"
              title="Click to view campus photo"
            >
              <Camera className="size-3 text-white" />
              <span>{activePhoto.label}</span>
            </button>
          </div>

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={(e) => toggleBookmark(current.id, e)}
            aria-label={bookmarked[current.id] ? "Saved" : "Save"}
            className={cn(
              "flex size-7 sm:size-8 items-center justify-center rounded-full visionos-carousel-pill transition-all duration-200 active:scale-90 cursor-pointer shadow-md",
              bookmarked[current.id]
                ? "bg-primary text-white border-primary shadow-[0_0_12px_rgba(250,79,97,0.6)]"
                : "text-white hover:bg-white/20"
            )}
          >
            {bookmarked[current.id] ? (
              <BookmarkCheck className="size-3.5 stroke-[2.2]" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
          </button>
        </div>

        {/* Center: The Heavily Frosted Smoked Glass Card with Matter */}
        <div className="visionos-carousel-card rounded-2xl p-3 sm:p-3.5 my-auto flex flex-col gap-2 shadow-2xl relative overflow-hidden">
          {/* Subtle Vertical Sunlight / Specular Sheen across the frosted surface */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent rounded-2xl" />
          <div className="pointer-events-none absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/35 to-transparent" />

          {/* Subheading: Clean Category & Ticker */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] sm:text-[11px] font-medium tracking-wider uppercase text-white/70">
              {current.category} · {current.companyTicker}
            </p>
          </div>

          {/* Main Headline */}
          <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white leading-snug line-clamp-1">
            {current.headline}
          </h2>

          {/* Branches (US HQ & India) - Clean Monochrome Minimal Typography */}
          <div className="flex flex-col gap-0.5 text-[10px] sm:text-[11px] font-normal text-white/85">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3 shrink-0 text-white/60" />
              <span className="truncate">{current.branches.us}</span>
            </span>
            <span className="flex items-center gap-1.5 truncate">
              <Building2 className="size-3 shrink-0 text-white/60" />
              <span className="truncate">{current.branches.india}</span>
            </span>
          </div>

          {/* Announcement Body Description */}
          <p className="text-[11px] sm:text-xs text-white/80 font-normal leading-relaxed line-clamp-2 text-pretty">
            {current.description}
          </p>

          {/* Compensation & Tags - Monochromatic Frosted Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] sm:text-[11px] font-medium text-white/95 bg-white/[0.1] border border-white/20 px-2.5 py-0.5 rounded-full">
              {current.compensation}
            </span>
            {current.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] sm:text-[11px] font-normal text-white/80 bg-white/[0.06] border border-white/12 px-2.5 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom Floating Glass Action Bar */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Glass Pill Button */}
          <Link
            href={current.mockHref}
            className="visionos-carousel-pill rounded-full px-3.5 py-1.5 text-xs font-medium text-white shadow-lg flex items-center gap-1.5 hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          >
            <span>Practice Role Mock</span>
            <ArrowRight className="size-3.5" />
          </Link>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous slide"
              className="flex size-7 items-center justify-center rounded-full visionos-carousel-pill text-white transition-all hover:bg-white/20 active:scale-90 cursor-pointer shadow-md"
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Apple Music Red Pill Indicators */}
            <div className="flex items-center gap-1 px-1">
              {announcements.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(dotIdx)
                    setPhotoIndex(0)
                  }}
                  aria-label={`Slide ${dotIdx + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                    dotIdx === currentIndex
                      ? "w-4.5 bg-primary shadow-[0_0_8px_rgba(250,79,97,0.8)]"
                      : "w-1.5 bg-white/40 hover:bg-white/60"
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next slide"
              className="flex size-7 items-center justify-center rounded-full visionos-carousel-pill text-white transition-all hover:bg-white/20 active:scale-90 cursor-pointer shadow-md"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
