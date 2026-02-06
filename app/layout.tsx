import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MerchForge - AI-Guided Custom Merch',
  description: 'Create custom apparel with conversational AI guidance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
