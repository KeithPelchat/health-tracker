import './globals.css'
import BottomNav from './BottomNav'

export const metadata = {
  title: 'Health Tracker',
  description: 'Personal health tracking app',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="app-wrap">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  )
}
