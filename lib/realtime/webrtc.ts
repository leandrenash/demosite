export type RealtimeConnectOptions = {
  ephemeralKey: string;
  model?: string;
  localStream: MediaStream;
  onRemoteTrack: (event: RTCTrackEvent) => void;
  onDataChannel?: (dc: RTCDataChannel) => void;
};

export const createRealtimeConnection = async (opts: RealtimeConnectOptions) => {
  const model = opts.model ?? 'gpt-4o-realtime-preview-2024-12-17';

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
  });

  opts.localStream.getTracks().forEach((track) => pc.addTrack(track, opts.localStream));
  pc.ontrack = opts.onRemoteTrack;

  // Low-latency audio preferred
  pc.addTransceiver('audio', { direction: 'recvonly' });

  const dc = pc.createDataChannel('oai-events');
  if (opts.onDataChannel) {
    opts.onDataChannel(dc);
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const baseUrl = 'https://api.openai.com/v1/realtime';
  const sdpResponse = await fetch(`${baseUrl}?model=${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.ephemeralKey}`,
      'Content-Type': 'application/sdp',
      'OpenAI-Beta': 'realtime=v1'
    },
    body: offer.sdp ?? ''
  });

  const answer = {
    type: 'answer' as const,
    sdp: await sdpResponse.text()
  };
  await pc.setRemoteDescription(answer);

  return { pc, dc };
};


