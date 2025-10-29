"use client";
import { useEffect, useRef, useState } from 'react';

export type SfxControllerProps = {
  enabled: boolean;
  masterVolume?: number; // 0..1
  isSpeaking: boolean;
  onReady?: () => void;
  audioContext: AudioContext | null;
};

// Lightweight SFX without external assets using Web Audio synthesis
export const SfxController = ({ enabled, masterVolume = 0.3, isSpeaking, onReady, audioContext }: SfxControllerProps) => {
  const [ready, setReady] = useState(false);
  const masterGainRef = useRef<GainNode | null>(null);
  const ambientGainRef = useRef<GainNode | null>(null);
  const beepGainRef = useRef<GainNode | null>(null);
  const duckGainRef = useRef<GainNode | null>(null);
  const beepIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      return;
    }
    const ctx = audioContext;
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.value = masterVolume;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    // Ducking gain for TTS side-chain (exposed to attach from outside if needed)
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(master);
    duckGainRef.current = duck;

    // Ambient: gentle brown noise
    const ambient = ctx.createGain();
    ambient.gain.value = 0.05; // subtle
    ambient.connect(master);
    ambientGainRef.current = ambient;

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // Brown noise approximation
      const x = Math.random() * 2 - 1;
      data[i] = (data[i - 1] || 0) * 0.98 + x * 0.02;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(ambient);
    noiseSource.start();

    // Monitor beep: quiet, periodic
    const beepGain = ctx.createGain();
    beepGain.gain.value = 0.02;
    beepGain.connect(master);
    beepGainRef.current = beepGain;

    const makeBeep = () => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 980; // medical monitor-like
      const env = ctx.createGain();
      env.gain.value = 0;
      osc.connect(env);
      env.connect(beepGain);
      const now = ctx.currentTime;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(1, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    };
    beepIntervalRef.current = setInterval(makeBeep, 3000);

    setReady(true);
    onReady?.();

    return () => {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      try { noiseSource.stop(); } catch {}
      try {
        ambient.disconnect();
        beepGain.disconnect();
        duck.disconnect();
        master.disconnect();
      } catch {}
    };
  }, [enabled, masterVolume, onReady, audioContext]);

  // Simple ducking when model is speaking
  useEffect(() => {
    const duck = duckGainRef.current;
    if (!duck) return;
    const target = isSpeaking ? 0.4 : 1;
    duck.gain.linearRampToValueAtTime(target, (audioContext?.currentTime ?? 0) + 0.05);
  }, [isSpeaking]);

  return null;
};


