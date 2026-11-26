import type { Metadata } from "next"
import type { ReactNode } from "react"

const url = "https://prepsensei.elinity.in/how-it-works"
const title = "How PrepSensei AI Mock Interviews Work"
const description = "Explore how PrepSensei asks follow-up questions, evaluates interview answers, and supports proctoring for recruiter-led assessments."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: { title, description, url, type: "website", siteName: "PrepSensei" },
}

export default function ProductTourLayout({ children }: { children: ReactNode }) {
  return children
}
