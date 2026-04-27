import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MatchLock — Matched Betting Dashboard',
  description: 'Lock in guaranteed profits from bookmaker sign-up offers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
