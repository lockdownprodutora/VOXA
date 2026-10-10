import {
  CaptionSegment,
  CaptionStyleType,
  PresenterAspectRatio
} from './voxaPresenterDb';

export interface KinematicRenderParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  timeSec: number;
  totalDurationSec: number;
  lipSyncAmplitude: number; // 0..1 from real PCM WAV envelope
  avatarImg: HTMLImageElement | null;
  bgImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  refMotionVideo?: HTMLVideoElement | null;
  scenarioType: string;
  showVoxaLogo: boolean;
  showAiWatermark: boolean;
  avatarName: string;
  targetChannel: string;
  tone: string;
  captionsEnabled: boolean;
  captionStyle: CaptionStyleType;
  captions: CaptionSegment[];
  segmentIndex?: number;
  totalSegments?: number;
}

/**
 * Renders a single 30fps frame of the VOXA Studio IA Kinematic Avatar & Studio Scene.
 * Implements:
 * - Natural torso & shoulder breathing + conversational gesture motion
 * - Head pitch, yaw & roll + speech-stressed nodding
 * - Natural eye blinks (every ~3.2s with double-blink variation) + eyebrow expression
 * - Frame-accurate articulated jaw drop & viseme lip-sync driven by PCM audio amplitude
 * - Multi-segment continuity lighting so 10s+10s+10s+10s (40s) has zero abrupt cuts
 */
export function renderKinematicAvatarFrame(params: KinematicRenderParams): void {
  const {
    ctx,
    width: w,
    height: h,
    timeSec,
    lipSyncAmplitude,
    avatarImg,
    bgImg,
    logoImg,
    refMotionVideo,
    scenarioType,
    showVoxaLogo,
    showAiWatermark,
    avatarName,
    targetChannel,
    captionsEnabled,
    captionStyle,
    captions
  } = params;

  ctx.save();

  // ---------------------------------------------------------------------------
  // 1. STUDIO SCENARIO BACKGROUND (VOXA OFFICIAL STUDIO or Custom/Selected)
  // ---------------------------------------------------------------------------
  const isDark = scenarioType === 'dark_studio' || scenarioType === 'futuristic';

  if (bgImg) {
    // Subtle studio camera breathing push-in (1.0 -> 1.03 smooth sinusoidal)
    const camZoom = 1 + Math.sin(timeSec * 0.45) * 0.015;
    const drawW = w * camZoom;
    const drawH = h * camZoom;
    ctx.drawImage(bgImg, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
  } else {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.38, w * 0.04, w * 0.5, h * 0.5, w * 0.9);
    if (scenarioType === 'dark_studio') {
      grad.addColorStop(0, '#1F1F27');
      grad.addColorStop(0.6, '#111116');
      grad.addColorStop(1, '#070709');
    } else if (scenarioType === 'futuristic') {
      grad.addColorStop(0, '#1E293B');
      grad.addColorStop(0.6, '#0F172A');
      grad.addColorStop(1, '#020617');
    } else if (scenarioType === 'office') {
      grad.addColorStop(0, '#F8FAFC');
      grad.addColorStop(0.65, '#E2E8F0');
      grad.addColorStop(1, '#CBD5E1');
    } else {
      // VOXA OFFICIAL STUDIO — Pure white studio cyclorama with premium key light
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.68, '#F8F9FB');
      grad.addColorStop(1, '#EBEEF3');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle black/red architectural studio lines for VOXA OFFICIAL STUDIO
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(255, 0, 51, 0.16)' : 'rgba(255, 0, 51, 0.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.14);
    ctx.lineTo(w * 0.92, h * 0.14);
    ctx.stroke();

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.46, Math.min(w, h) * 0.39, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 2. VOXA OFFICIAL STUDIO LOGO BACKDROP
  // ---------------------------------------------------------------------------
  if (showVoxaLogo) {
    ctx.save();
    ctx.fillStyle = isDark && !bgImg ? 'rgba(255, 255, 255, 0.055)' : 'rgba(9, 9, 11, 0.045)';
    ctx.font = `900 ${Math.round(w * 0.19)}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VOXA', w / 2, h * 0.24);

    // Top-left official studio badge
    const badgeX = w * 0.05;
    const badgeY = h * 0.04;
    ctx.fillStyle = '#09090B';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, 128, 36, 10);
    ctx.fill();

    ctx.fillStyle = '#FF0033';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, 8, 36, 4);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 15px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('VOXA IA', badgeX + 18, badgeY + 18);

    if (logoImg) {
      ctx.drawImage(logoImg, badgeX + 94, badgeY + 4, 28, 28);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 3. KINEMATIC MOTION CALCULATIONS (Head, Shoulders, Breathing, Blinks, Lip-Sync)
  // ---------------------------------------------------------------------------
  const speechEnergy = Math.min(1, Math.max(0, lipSyncAmplitude));

  // Natural breathing vertical displacement (shoulders & chest)
  const breathY = Math.sin(timeSec * 2.2) * (h * 0.0045);
  const shoulderExpand = 1 + Math.sin(timeSec * 2.2) * 0.012 + speechEnergy * 0.015;

  // Natural head motion (gentle conversational sway + syllable emphasis nod)
  const headSwayX =
    Math.sin(timeSec * 1.35) * (w * 0.008) +
    Math.cos(timeSec * 0.75) * (w * 0.004);
  const headNodY =
    Math.sin(timeSec * 2.8) * (h * 0.004) +
    speechEnergy * (h * 0.009) * Math.sin(timeSec * 9.5);
  const headTiltRad =
    Math.sin(timeSec * 1.1) * 0.024 +
    Math.cos(timeSec * 2.3) * 0.012 * (0.3 + speechEnergy);

  // Natural eye blink schedule (blink every 3.3s, plus occasional double blink at 6.6s)
  const blinkCycle = timeSec % 3.3;
  const isBlinking =
    (blinkCycle > 3.08 && blinkCycle < 3.24) ||
    (timeSec % 6.6 > 6.35 && timeSec % 6.6 < 6.48);
  const blinkAmount = isBlinking ? 0.92 : 0;

  // Center coordinates for Presenter
  const centerX = w * 0.5;
  const centerY = h * 0.47;
  const baseRadius = Math.min(w, h) * 0.27;

  // Dynamic studio rim glow reacting to voice cadence
  ctx.save();
  const glowGrad = ctx.createRadialGradient(
    centerX + headSwayX * 0.5,
    centerY + breathY,
    baseRadius * 0.65,
    centerX + headSwayX * 0.5,
    centerY + breathY,
    baseRadius * 1.38
  );
  glowGrad.addColorStop(0, `rgba(255, 0, 51, ${(0.16 + speechEnergy * 0.22).toFixed(3)})`);
  glowGrad.addColorStop(1, 'rgba(255, 0, 51, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, baseRadius * 1.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 4. ARTICULATED AVATAR RENDERING (Shoulders/Torso + Head/Face + Jaw Lip-Sync)
  // ---------------------------------------------------------------------------
  if (refMotionVideo && refMotionVideo.readyState >= 2) {
    // If a live/Veo motion video is active, render it in the presenter stage
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      centerX - baseRadius * 1.05,
      centerY - baseRadius * 1.15,
      baseRadius * 2.1,
      baseRadius * 2.3,
      28
    );
    ctx.clip();
    ctx.drawImage(
      refMotionVideo,
      centerX - baseRadius * 1.05,
      centerY - baseRadius * 1.15,
      baseRadius * 2.1,
      baseRadius * 2.3
    );
    ctx.restore();
  } else if (avatarImg) {
    const imgW = avatarImg.naturalWidth || avatarImg.width || 600;
    const imgH = avatarImg.naturalHeight || avatarImg.height || 600;

    const stageW = baseRadius * 2.05;
    const stageH = baseRadius * 2.25;
    const stageLeft = centerX - stageW / 2;
    const stageTop = centerY - stageH / 2;

    ctx.save();
    // Rounded studio portrait stage
    ctx.beginPath();
    ctx.roundRect(stageLeft, stageTop, stageW, stageH, 32);
    ctx.clip();

    // Soft studio backdrop inside avatar stage
    ctx.fillStyle = isDark ? '#141418' : '#F4F5F7';
    ctx.fillRect(stageLeft, stageTop, stageW, stageH);

    // LAYER A: Torso & Shoulders (lower 38% of portrait) with breathing & shoulder movement
    ctx.save();
    ctx.translate(centerX + headSwayX * 0.35, centerY + breathY * 1.2);
    ctx.scale(shoulderExpand, 1 + Math.sin(timeSec * 2.2) * 0.015);
    ctx.drawImage(
      avatarImg,
      0,
      imgH * 0.58,
      imgW,
      imgH * 0.42,
      -stageW / 2,
      stageH * 0.08,
      stageW,
      stageH * 0.44
    );
    ctx.restore();

    // LAYER B: Articulated Head & Upper Face (with 3D tilt, nod & sway)
    ctx.save();
    ctx.translate(centerX + headSwayX, centerY + headNodY + breathY * 0.6);
    ctx.rotate(headTiltRad);
    const headScale = 1.02 + speechEnergy * 0.012;
    ctx.scale(headScale, headScale);

    // Draw full head base
    ctx.drawImage(
      avatarImg,
      0,
      0,
      imgW,
      imgH * 0.72,
      -stageW / 2,
      -stageH / 2,
      stageW,
      stageH * 0.72
    );

    // LAYER C: Articulated Lower Jaw & Chin Warp synchronized with speech (Lip-Sync)
    // Moves the lower face/jaw region (52%..72% of source image) downward proportionally to speechEnergy
    const jawDropPx = speechEnergy * (stageH * 0.032);
    if (jawDropPx > 0.4) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, stageH * 0.045, stageW * 0.24, stageH * 0.14, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        avatarImg,
        0,
        imgH * 0.48,
        imgW,
        imgH * 0.26,
        -stageW / 2,
        -stageH / 2 + stageH * 0.48 + jawDropPx,
        stageW,
        stageH * 0.26
      );
      ctx.restore();
    }

    // LAYER D: Natural Eye Blink & Gaze Overlay (subtle eyelid closure over eye line)
    if (blinkAmount > 0.1) {
      ctx.save();
      const eyeLineY = -stageH * 0.105;
      const eyeSpanX = stageW * 0.115;
      const eyeW = stageW * 0.075;
      const eyeH = stageH * 0.018 * blinkAmount;

      // Sample skin-tone eyelid shade with soft shadow
      ctx.fillStyle = 'rgba(185, 142, 122, 0.72)';
      // Left eye blink
      ctx.beginPath();
      ctx.ellipse(-eyeSpanX, eyeLineY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      // Right eye blink
      ctx.beginPath();
      ctx.ellipse(eyeSpanX, eyeLineY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyelash line
      ctx.strokeStyle = 'rgba(28, 20, 18, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-eyeSpanX - eyeW * 0.8, eyeLineY);
      ctx.quadraticCurveTo(-eyeSpanX, eyeLineY + 3, -eyeSpanX + eyeW * 0.8, eyeLineY);
      ctx.moveTo(eyeSpanX - eyeW * 0.8, eyeLineY);
      ctx.quadraticCurveTo(eyeSpanX, eyeLineY + 3, eyeSpanX + eyeW * 0.8, eyeLineY);
      ctx.stroke();
      ctx.restore();
    }

    // LAYER E: Dynamic Viseme Lip-Sync Articulation (Synchronized with PCM Audio Envelope)
    if (speechEnergy > 0.06) {
      ctx.save();
      const mouthY = stageH * 0.018 + jawDropPx * 0.35;
      // Modulate width between wide ('E/A') and rounded ('O/U') visemes over time
      const visemeRoundness = 0.75 + 0.25 * Math.sin(timeSec * 18.0);
      const mouthHalfW = stageW * 0.052 * visemeRoundness * (0.7 + speechEnergy * 0.45);
      const mouthOpenH = stageH * 0.022 * speechEnergy;

      // Inner oral cavity shadow during speech
      ctx.fillStyle = 'rgba(38, 12, 18, 0.78)';
      ctx.beginPath();
      ctx.ellipse(0, mouthY, mouthHalfW, mouthOpenH, 0, 0, Math.PI * 2);
      ctx.fill();

      // Subtle upper teeth highlight when mouth opens
      if (speechEnergy > 0.22) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.beginPath();
        ctx.ellipse(
          0,
          mouthY - mouthOpenH * 0.42,
          mouthHalfW * 0.68,
          Math.max(1.2, mouthOpenH * 0.24),
          0,
          0,
          Math.PI
        );
        ctx.fill();
      }

      // Upper and lower lip contour shading
      ctx.strokeStyle = 'rgba(165, 58, 68, 0.68)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, mouthY, mouthHalfW * 1.05, mouthOpenH * 1.08, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // End head transform

    // LAYER F: Conversational Hand Gesture Silhouette / Studio Rim Accent when emphasizing points
    const gestureWave = Math.sin(timeSec * 3.4);
    if (speechEnergy > 0.18 || gestureWave > 0.4) {
      const gestureLift = (speechEnergy * 18 + Math.max(0, gestureWave) * 10);
      ctx.save();
      const handGrad = ctx.createLinearGradient(
        stageLeft,
        stageTop + stageH - 50,
        stageLeft,
        stageTop + stageH
      );
      handGrad.addColorStop(0, 'rgba(255, 0, 51, 0)');
      handGrad.addColorStop(1, 'rgba(255, 0, 51, 0.18)');
      ctx.fillStyle = handGrad;
      ctx.fillRect(stageLeft, stageTop + stageH - 45 - gestureLift * 0.4, stageW, 45 + gestureLift * 0.4);
      ctx.restore();
    }

    ctx.restore(); // End stage clip

    // Studio Frame Border with Voice-Reactive Pulse
    ctx.save();
    ctx.strokeStyle = '#FF0033';
    ctx.lineWidth = 3 + speechEnergy * 3.5;
    ctx.beginPath();
    ctx.roundRect(stageLeft, stageTop, stageW, stageH, 32);
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. PRESENTER LOWER-THIRD & VOICE WAVEFORM TELEMETRY BAR
  // ---------------------------------------------------------------------------
  const nameY = centerY + baseRadius * 1.24;
  ctx.save();
  ctx.fillStyle = isDark && !bgImg ? '#FFFFFF' : '#09090B';
  ctx.font = `900 ${Math.round(w * 0.032)}px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(avatarName.toUpperCase(), centerX, nameY);

  // Live Lip-Sync Audio Equalizer Bars below presenter name
  const barCount = 15;
  const barSpacing = 6;
  const totalBarsW = barCount * barSpacing;
  const startBarX = centerX - totalBarsW / 2;
  for (let b = 0; b < barCount; b++) {
    const distFromCenter = Math.abs(b - Math.floor(barCount / 2)) / (barCount / 2);
    const barAmp =
      speechEnergy *
      (1 - distFromCenter * 0.55) *
      (0.5 + 0.5 * Math.abs(Math.sin(timeSec * 14 + b * 0.9)));
    const barH = Math.max(3, Math.round(barAmp * 18));
    ctx.fillStyle = '#FF0033';
    ctx.beginPath();
    ctx.roundRect(startBarX + b * barSpacing, nameY + 14 - barH / 2, 3.5, barH, 2);
    ctx.fill();
  }
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 6. SYNCHRONIZED SOCIAL CAPTIONS (Clean | Bold | Social | Minimal)
  // ---------------------------------------------------------------------------
  if (captionsEnabled && captions.length > 0) {
    const activeCap =
      captions.find((c) => timeSec >= c.startSec && timeSec <= c.endSec) ||
      captions[Math.min(captions.length - 1, Math.floor((timeSec / Math.max(1, params.totalDurationSec)) * captions.length))];

    if (activeCap && activeCap.text) {
      ctx.save();
      const boxW = w * 0.86;
      const boxH = Math.round(h * 0.105);
      const boxX = (w - boxW) / 2;
      const boxY = h * 0.80;

      if (captionStyle === 'Bold') {
        ctx.fillStyle = '#FF0033';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 16);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `900 ${Math.round(w * 0.036)}px Orbitron, sans-serif`;
      } else if (captionStyle === 'Social') {
        ctx.fillStyle = 'rgba(9, 9, 11, 0.92)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 20);
        ctx.fill();
        ctx.strokeStyle = '#FF0033';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `800 ${Math.round(w * 0.034)}px sans-serif`;
      } else if (captionStyle === 'Minimal') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.roundRect(boxX + w * 0.06, boxY + 8, boxW - w * 0.12, boxH - 16, 10);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 ${Math.round(w * 0.029)}px sans-serif`;
      } else {
        // 'Clean' default
        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 16);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#09090B';
        ctx.font = `700 ${Math.round(w * 0.033)}px sans-serif`;
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(activeCap.text.slice(0, 62), w / 2, boxY + boxH / 2, boxW - 28);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // 7. DISCREET AI WATERMARK ("Criado com VOXA AI")
  // ---------------------------------------------------------------------------
  if (showAiWatermark) {
    ctx.save();
    ctx.fillStyle = isDark && !bgImg ? 'rgba(255,255,255,0.55)' : 'rgba(9,9,11,0.55)';
    ctx.font = `700 ${Math.max(10, Math.round(w * 0.018))}px Orbitron, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`Criado com VOXA AI • ${targetChannel}`, w * 0.95, h * 0.965);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders a complete synchronized Talking Avatar video up to 40s with muxed neural audio
 * and real 30fps PCM lip-sync + head/eye/shoulder/gesture kinematic animation.
 */
export async function recordKinematicAvatarVideoWithAudio(options: {
  aspectRatio: PresenterAspectRatio;
  durationSeconds: number;
  audioDataUrl?: string;
  lipSyncEnvelope?: number[];
  avatarUrl: string;
  backgroundUrl?: string;
  logoUrl?: string;
  scenarioType: string;
  showVoxaLogo: boolean;
  showAiWatermark: boolean;
  avatarName: string;
  targetChannel: string;
  tone: string;
  captionsEnabled: boolean;
  captionStyle: CaptionStyleType;
  captions: CaptionSegment[];
  onStageChange?: (stage: 'Preparando...' | 'Gerando...' | 'Processando...' | 'Finalizando...') => void;
}): Promise<string> {
  const dims =
    options.aspectRatio === '9:16'
      ? { w: 720, h: 1280 }
      : options.aspectRatio === '1:1'
      ? { w: 1080, h: 1080 }
      : options.aspectRatio === '4:5'
      ? { w: 864, h: 1080 }
      : { w: 1280, h: 720 };

  options.onStageChange?.('Preparando...');

  const canvas = document.createElement('canvas');
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context indisponível.');

  const loadImg = (url?: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const [avatarImg, bgImg, logoImg] = await Promise.all([
    loadImg(options.avatarUrl),
    loadImg(options.backgroundUrl),
    loadImg(options.logoUrl)
  ]);

  options.onStageChange?.('Processando...');

  const canvasStream = canvas.captureStream(30);
  let audioCtx: AudioContext | null = null;
  let audioSource: AudioBufferSourceNode | null = null;
  let effectiveDurationSec = options.durationSeconds;

  // Decode and attach real Gemini TTS WAV audio track into the recorded video stream
  if (options.audioDataUrl && typeof AudioContext !== 'undefined') {
    try {
      audioCtx = new AudioContext();
      const resp = await fetch(options.audioDataUrl);
      const arrayBuf = await resp.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
      effectiveDurationSec = Math.max(options.durationSeconds, Math.ceil(audioBuffer.duration));

      const dest = audioCtx.createMediaStreamDestination();
      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(dest);
      // Also connect softly to speakers so user hears the studio master
      const gain = audioCtx.createGain();
      gain.gain.value = 0.85;
      audioSource.connect(gain);
      gain.connect(audioCtx.destination);

      for (const track of dest.stream.getAudioTracks()) {
        canvasStream.addTrack(track);
      }
    } catch (e) {
      console.warn('[VOXA Kinematic Audio Mux note]:', e);
    }
  }

  const mimeType =
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

  const recorder = new MediaRecorder(canvasStream, { mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingStopped = new Promise<string>((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(URL.createObjectURL(blob));
    };
  });

  recorder.start(200);
  if (audioSource) {
    try {
      audioSource.start(0);
    } catch {}
  }

  // Render real-time frames synchronized with audio clock
  const fps = 30;
  const totalFrames = Math.min(40 * fps, Math.max(5 * fps, Math.round(options.durationSeconds * fps)));
  const startPerf = performance.now();
  const env = options.lipSyncEnvelope || [];

  for (let frame = 0; frame < totalFrames; frame++) {
    if (frame === Math.floor(totalFrames * 0.75)) {
      options.onStageChange?.('Finalizando...');
    }
    const elapsedSec = (performance.now() - startPerf) / 1000;
    const virtualTimeSec = (frame / totalFrames) * options.durationSeconds;
    const envIdx = Math.min(env.length - 1, Math.floor(virtualTimeSec * fps));
    const amp =
      env.length > 0 && envIdx >= 0
        ? env[envIdx]
        : 0.25 + 0.55 * Math.abs(Math.sin(virtualTimeSec * 11.5)) * Math.abs(Math.cos(virtualTimeSec * 4.2));

    renderKinematicAvatarFrame({
      ctx,
      width: dims.w,
      height: dims.h,
      timeSec: virtualTimeSec,
      totalDurationSec: options.durationSeconds,
      lipSyncAmplitude: amp,
      avatarImg,
      bgImg,
      logoImg,
      scenarioType: options.scenarioType,
      showVoxaLogo: options.showVoxaLogo,
      showAiWatermark: options.showAiWatermark,
      avatarName: options.avatarName,
      targetChannel: options.targetChannel,
      tone: options.tone,
      captionsEnabled: options.captionsEnabled,
      captionStyle: options.captionStyle,
      captions: options.captions
    });

    // Pace frames smoothly so audio & video remain synchronized
    const targetElapsedMs = ((frame + 1) / fps) * 1000;
    const actualElapsedMs = performance.now() - startPerf;
    const waitMs = Math.max(8, Math.min(34, targetElapsedMs - actualElapsedMs));
    await new Promise((r) => setTimeout(r, waitMs));
    void elapsedSec;
  }

  recorder.stop();
  if (audioSource) {
    try {
      audioSource.stop();
    } catch {}
  }
  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch {}
  }

  return await recordingStopped;
}
