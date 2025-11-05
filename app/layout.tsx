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
        <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200/70 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <a
              href="/"
              aria-label="44 willow home"
              className="select-none text-sm font-semibold tracking-tight text-neutral-900 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            >
              44 willow
            </a>
            <span className="text-[11px] text-neutral-500">powered by Sophorik</span>
          </div>
        </header>
        <div className="pt-14">
          {children}
        </div>
      </body>
    </html>
  );
}


