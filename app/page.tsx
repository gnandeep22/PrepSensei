import type { Metadata } from "next"
import Link from "next/link"

const home = "https://prepsensei.elinity.in/"
const title = "PrepSensei | AI Mock Interviews and Interview Preparation"
const description = "Practice technical and behavioral interviews with PrepSensei, tailor your resume to a job, and build a study plan around the skills you want to improve."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: home },
  openGraph: { type: "website", siteName: "PrepSensei", title, description, url: home },
}

const website = { "@context": "https://schema.org", "@type": "WebSite", name: "PrepSensei", url: home }

export default function Home() {
  return (
    <section className="mx-auto max-w-3xl py-16 sm:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }} />
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">PrepSensei</h1>
      <p className="mt-4 text-2xl font-medium">AI interview preparation</p>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Link className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground" href="/sign-up">Start practicing</Link>
        <Link className="underline underline-offset-4" href="/how-it-works">How PrepSensei works</Link>
      </div>
      <section className="mt-16 max-w-xl border-t pt-8">
        <h2 className="text-2xl font-semibold">Try a behavioral interview question</h2>
        <blockquote className="my-4 border-l-2 border-primary pl-4 text-lg">
          Tell me about a time you spotted a mistake shortly before a deadline. What did you do?
        </blockquote>
        <p>Start with the mistake and who it affected. Describe the decision you made, then explain
          how you checked whether your fix worked.</p>
        <p className="mt-3 text-muted-foreground">
          Example feedback for an answer ending with “we fixed it together”: explain your own
          contribution. Did you catch the error, propose the fix, or test the result?
        </p>
      </section>
    </section>
  )
}
