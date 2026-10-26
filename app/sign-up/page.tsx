import { redirect } from "next/navigation"
import { getSessionUser, isCandidateFaceRegistered } from "@/lib/session"
import { AuthForm } from "@/components/auth/auth-form"

export const dynamic = "force-dynamic"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string }>
}) {
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

    // Candidate has an active session but has NOT given face biometrics.
    // RESTRICT candidate from entering the app: Render mandatory face registration!
    return <AuthForm mode="sign-up" forceFaceReg={true} />
  }

  const params = searchParams ? await searchParams : undefined
  const forceFace = params?.step === "face"

  return <AuthForm mode="sign-up" forceFaceReg={forceFace} />
}
