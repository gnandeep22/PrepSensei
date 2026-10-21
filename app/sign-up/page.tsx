import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isCandidateFaceRegistered } from "@/lib/session"
import { AuthForm } from "@/components/auth/auth-form"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string }>
}) {
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

    // Candidate has an active session but has NOT given face biometrics.
    // RESTRICT candidate from entering the app: Render mandatory face registration!
    return <AuthForm mode="sign-up" forceFaceReg={true} />
  }

  const params = searchParams ? await searchParams : undefined
  const forceFace = params?.step === "face"

  return <AuthForm mode="sign-up" forceFaceReg={forceFace} />
}

