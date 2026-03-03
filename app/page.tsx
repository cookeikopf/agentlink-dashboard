"use client"

import { useAuth } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default function HomePage() {
  const { userId, isLoaded } = useAuth()
  
  if (!isLoaded) {
    return <div>Loading...</div>
  }
  
  if (userId) {
    redirect("/dashboard")
  }
  
  redirect("/sign-in")
}
