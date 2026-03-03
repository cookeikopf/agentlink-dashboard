"use client"

import { useAuth } from "@clerk/nextjs"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, isLoaded } = useAuth()
  
  if (!isLoaded) {
    return <div>Loading...</div>
  }
  
  if (!userId) {
    redirect("/sign-in")
  }
  
  return <DashboardShell>{children}</DashboardShell>
}
