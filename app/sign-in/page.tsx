import { redirect } from "next/navigation"
import { getSessionUser, isCandidateFaceRegistered } from "@/lib/session"
import { AuthForm } from "@/components/auth/auth-form"

export const dynamic = "force-dynamic"

export default async function SignInPage() {
  const user = await getSessionUser()

  if (user) {
    const role = (user as { role?: string }).role === "recruiter" ? "recruiter" : "candidate"
    if (role === "recruiter") {
      redirect("/recruiter")
    }

    const faceRegistered = await isCandidateFaceRegistered(user.id)
    if (faceRegistered) {
      redirect("/")
    }

    // Candidate is signed in, but face biometrics not yet registered!
    // RESTRICT access to the app: Redirect to face registration step
    redirect("/sign-up?step=face")
  }

  return <AuthForm mode="sign-in" />
}
