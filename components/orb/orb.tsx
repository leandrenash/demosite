"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRealtimeConnection } from '@/lib/realtime/webrtc';
import { useAudioLevel } from './use-audio-level';
import { SfxController } from '@/components/sfx/sfx-controller';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';

type Particle = {
  angle: number;
  baseRadius: number;
  radius: number;
  speed: number;
  size: number;
  hue: number;
};

const ParticleField = ({ isSpeaking, level }: { isSpeaking: boolean; level: number }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  const baseCount = 140;
  const targetCount = useMemo(() => Math.round(baseCount + level * 90 + (isSpeaking ? 100 : 0)), [baseCount, level, isSpeaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // initialize particles if needed
    const ensureParticles = () => {
      const rect = container.getBoundingClientRect();
      const maxR = Math.min(rect.width, rect.height) * 0.45;
      while (particlesRef.current.length < targetCount) {
        const angle = Math.random() * Math.PI * 2;
        const baseRadius = Math.random() * maxR;
        particlesRef.current.push({
          angle,
          baseRadius,
          radius: baseRadius,
          speed: 0.002 + Math.random() * 0.006,
          size: 1 + Math.random() * 2.2,
          hue: 210 + Math.random() * 70 // between accent and accent2
        });
      }
      if (particlesRef.current.length > targetCount) {
        particlesRef.current.length = targetCount;
      }
    };
    ensureParticles();

    const draw = () => {
      const rect = container.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.globalCompositeOperation = 'lighter';

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const speedBoost = isSpeaking ? 2 : 1;
      const sizeBoost = isSpeaking ? 1.4 : 1;
      const wobble = 0.8 + level * 0.6;

      ensureParticles();

      for (const p of particlesRef.current) {
        p.angle += p.speed * speedBoost;
        p.radius = p.baseRadius + Math.sin(p.angle * 2) * 6 * wobble;
        const x = centerX + Math.cos(p.angle) * p.radius;
        const y = centerY + Math.sin(p.angle) * p.radius;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.size * 4 * sizeBoost);
        const color = `hsla(${p.hue}, 90%, ${isSpeaking ? 65 : 60}%, ${0.9 - Math.random() * 0.4})`;
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(x, y, p.size * sizeBoost, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const onResize = () => {
      const current = rafRef.current;
      if (current) cancelAnimationFrame(current);
      resize();
      draw();
    };
    window.addEventListener('resize', onResize);
    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [isSpeaking, level, targetCount]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0" aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
};

export const Orb = () => {
  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const connectBufferRef = useRef<AudioBuffer | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const level = useAudioLevel(localStreamRef.current, audioContextRef.current);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current?.close();
    dcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (audioContextRef.current) {
      try { audioContextRef.current.suspend(); } catch {}
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      try { remoteAudioRef.current.pause(); } catch {}
    }
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setConnState('connecting');
      setError(null);

      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = media;

      // Create/resume AudioContext only after user gesture
      const Ctor: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        await ctx.resume();
        audioContextRef.current = ctx as AudioContext;
      }

      const tokenResp = await fetch('/api/realtime/session', { method: 'POST' });
      const tokenJson = await tokenResp.json();
      const ephemeralKey = tokenJson.client_secret as string;
      if (!ephemeralKey) throw new Error('No ephemeral key');

      const { pc, dc } = await createRealtimeConnection({
        ephemeralKey,
        localStream: media,
        onRemoteTrack: (e) => {
          const [stream] = e.streams;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
            const play = async () => {
              try {
                await remoteAudioRef.current?.play();
              } catch {}
            };
            void play();
          }
        },
        onDataChannel: (dc) => {
          dc.onmessage = () => {
            // If any message from server (e.g., start speaking) occurs, we can toggle states
          };
        }
      });
      pcRef.current = pc;
      dcRef.current = dc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnState('connected');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnState('error');
        }
      };

      // Trigger an initial response to kick off greeting when channel is open
      const sendInitial = () => {
        try {
          const initial = {
            type: 'response.create',
            response: { conversation: 'default' }
          } as const;
          dc.send(JSON.stringify(initial));
        } catch {}
      };
      if (dc.readyState === 'open') {
        sendInitial();
      } else {
        dc.onopen = sendInitial;
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to connect');
      setConnState('error');
      cleanup();
    }
  }, [cleanup]);

  const handleEnd = useCallback(() => {
    setConnState('ended');
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (!el) return;
    const onPlay = () => setIsSpeaking(true);
    const onEnded = () => setIsSpeaking(false);
    const onPause = () => setIsSpeaking(false);
    el.addEventListener('play', onPlay);
    el.addEventListener('ended', onEnded);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('pause', onPause);
    };
  }, []);

  // Preload connect sound once AudioContext exists
  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx || connectBufferRef.current) return;
    let aborted = false;
    const load = async () => {
      try {
        const res = await fetch('/sounds/Message%20Notification.wav');
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr.slice(0));
        if (!aborted) connectBufferRef.current = buf;
      } catch {}
    };
    void load();
    return () => {
      aborted = true;
    };
  }, [audioContextRef.current]);

  // Play connect sound when connected
  useEffect(() => {
    if (connState !== 'connected') return;
    if (!sfxEnabled) return;
    const ctx = audioContextRef.current;
    const buf = connectBufferRef.current;
    if (!ctx || !buf) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {}
  }, [connState, sfxEnabled]);

  const baseSize = 180 + Math.round(level * 110);
  const size = isSpeaking ? baseSize + 10 : baseSize;

  const swirlClass = isSpeaking ? 'animate-[spin_8s_linear_infinite]' : 'animate-[spin_16s_linear_infinite]';
  const breatheClass = isSpeaking ? 'animate-[breathe_1.8s_ease-in-out_infinite]' : 'animate-breathe';
  const haloOpacityClass = isSpeaking ? 'opacity-60' : 'opacity-40';

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-4">
      <div className="relative pointer-events-none select-none" style={{ width: size, height: size }}>
        {/* Ambient glow */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-full blur-3xl ${haloOpacityClass} animate-glow`}
          style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0.08), transparent)' }}
          aria-hidden
        />

        {/* Speaking pulse halo */}
        {isSpeaking && (
          <div
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-accent/30 animate-ping"
            aria-hidden
          />
        )}

        {/* Particle field */}
        <ParticleField isSpeaking={isSpeaking} level={level} />

        {/* Rotating dashed ring */}
        <div
          className={`pointer-events-none absolute inset-2 rounded-full border border-dashed ${isSpeaking ? 'border-accent/60' : 'border-neutral-300/40'} ${swirlClass}`}
          aria-hidden
        />

        {/* Core */}
        <div
          className={`pointer-events-none relative rounded-full ${breatheClass} transition-all duration-150 ease-out`}
          style={{ width: '100%', height: '100%', background: 'radial-gradient(closest-side, rgba(255,255,255,0.45), transparent), conic-gradient(from 180deg at 50% 50%, hsl(210 82% 60%), hsl(280 92% 60%))' }}
          aria-label="AI orb"
          role="img"
          tabIndex={0}
        />

        {/* Inner swirl overlay */}
        <div
          className={`pointer-events-none absolute inset-0 rounded-full mix-blend-plus-lighter ${swirlClass}`}
          style={{ background: 'conic-gradient(from 0deg at 50% 50%, rgba(59,130,246,0.25), rgba(168,85,247,0.25), rgba(59,130,246,0.25))' }}
          aria-hidden
        />
      </div>

      <div className="relative z-10 mt-1 flex items-center gap-3">
        {(connState === 'idle' || connState === 'error' || connState === 'ended') && (
          <button
            onClick={handleStart}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            aria-label="Start session"
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            Start session
          </button>
        )}

        {connState === 'connecting' && (
          <button
            disabled
            aria-disabled="true"
            aria-label="Connecting"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2 text-xs font-medium text-neutral-400 shadow-sm"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neutral-300" />
            Connecting…
          </button>
        )}

        {connState === 'connected' && (
          <button
            onClick={handleEnd}
            onPointerDown={handleEnd}
            onKeyDown={(e) => e.key === 'Enter' && handleEnd()}
            aria-label="End session"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-2 text-xs font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            End session
          </button>
        )}
      </div>

      {connState === 'ended' && (
        <div className="mt-3 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-neutral-500">Book a meeting with us</p>
          <a
            href="mailto:info@sophorik.io"
            aria-label="Get started via email"
            className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            Get started
          </a>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {connState === 'idle' && 'Idle'}
        {connState === 'connecting' && 'Connecting'}
        {connState === 'connected' && (isSpeaking ? 'Speaking' : 'Listening')}
        {connState === 'error' && 'Error'}
        {connState === 'ended' && 'Ended'}
      </span>

      {/* Hidden audio sink for model speech */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <SfxController enabled={sfxEnabled} isSpeaking={isSpeaking} audioContext={audioContextRef.current} />
    </div>
  );
};


