import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';

export const metadata: Metadata = {
  title: 'HER-SPACE — Secure Hostel Night Attendance System',
  description: 'Modern, secure, privacy-first night roll-call & curfew management for HER-SPACE residential hostels.',
  keywords: ['HostelGuard', 'HER-SPACE', 'Hostel Attendance', 'Curfew Management', 'Roll-Call'],
  authors: [{ name: 'HER-SPACE Safety & Housing Operations' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#004ac6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-surface font-sans text-on-surface antialiased selection:bg-blue-600 selection:text-white"
      >
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
