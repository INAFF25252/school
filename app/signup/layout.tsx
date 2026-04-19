import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up · School directory",
  description: "Create an account or sign in with your email.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
