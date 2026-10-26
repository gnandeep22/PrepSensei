import { AuthForm } from "@/components/auth/auth-form"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  return <AuthForm mode="sign-up" forceFaceReg={params?.step === "face"} />
}
