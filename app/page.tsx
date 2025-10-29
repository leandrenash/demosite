import dynamic from 'next/dynamic';

const Orb = dynamic(() => import('@/components/orb/orb').then((m) => m.Orb), {
  ssr: false
});

export default function Page() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <section className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-800">44 Willow</h1>
        <p className="text-xs text-neutral-500">powered by Sophorik</p>
        <div className="mt-1 w-full">
          <Orb />
        </div>
      </section>
    </main>
  );
}


