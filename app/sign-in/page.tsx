import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isCandidateFaceRegistered } from "@/lib/session"
import { AuthForm } from "@/components/auth/auth-form"

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session?.user) {
    const role = (session.user as { role?: string }).role === "recruiter" ? "recruiter" : "candidate"
    if (role === "recruiter") {
      redirect("/recruiter")
    }

    const faceRegistered = await isCandidateFaceRegistered(session.user.id)
    if (faceRegistered) {
      redirect("/")
    }

    // Candidate is signed in, but face biometrics not yet registered!
    // RESTRICT access to the app: Redirect to face registration step
    redirect("/sign-up?step=face")
  }

  return <AuthForm mode="sign-in" />
}

