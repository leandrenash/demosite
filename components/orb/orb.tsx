"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRealtimeConnection } from '@/lib/realtime/webrtc';
import { useAudioLevel } from './use-audio-level';
import { SfxController } from '@/components/sfx/sfx-controller';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';

export const Orb = () => {
  const [connState, setConnState] = useState<ConnectionState>('idle');
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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

  const size = 140 + Math.round(level * 90);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-4">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full blur-3xl opacity-50 animate-glow"
          style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,0.08), transparent)' }}
          aria-hidden
        />
        <div
          className="relative rounded-full animate-breathe animate-swirl-slow transition-all duration-100 ease-out"
          style={{ width: '100%', height: '100%', background: 'radial-gradient(closest-side, rgba(255,255,255,0.4), transparent), conic-gradient(from 180deg at 50% 50%, hsl(210 80% 60%), hsl(280 90% 60%))' }}
          aria-label="AI orb"
          role="img"
          tabIndex={0}
        />
      </div>

      <div className="flex items-center gap-2">
        {connState === 'idle' || connState === 'error' || connState === 'ended' ? (
          <button
            onClick={handleStart}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            aria-label="Start"
            className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            Start
          </button>
        ) : (
          <button
            onClick={handleEnd}
            onKeyDown={(e) => e.key === 'Enter' && handleEnd()}
            aria-label="End"
            className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            End
          </button>
        )}

        <label className="flex items-center gap-1 text-xs text-white/70">
          <input
            type="checkbox"
            checked={sfxEnabled}
            onChange={(e) => setSfxEnabled(e.target.checked)}
            aria-label="Sound effects"
          />
          SFX
        </label>
      </div>

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


