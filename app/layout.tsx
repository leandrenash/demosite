import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clinical Realtime Simulation',
  description: 'Speech-to-speech clinical interviewer simulation powered by Sophorik.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-neutral-800 antialiased">
        {children}
      </body>
    </html>
  );
}


