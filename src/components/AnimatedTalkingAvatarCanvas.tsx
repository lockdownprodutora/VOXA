import React, { useEffect, useRef } from 'react';
import {
  VoxaPresenterAvatar,
  VoxaPresenterScenario,
  PresenterAspectRatio,
  CaptionSegment,
  CaptionStyleType
} from '../utils/voxaPresenterDb';

export interface AnimatedTalkingAvatarCanvasProps {
  avatar: VoxaPresenterAvatar;
  scenario: VoxaPresenterScenario;
  customBackgroundUrl?: string;
  aspectRatio: PresenterAspectRatio;
  showVoxaLogo: boolean;
  voxaWatermark: boolean;
  companyLogoUrl?: string;
  captions: CaptionSegment[];
  captionStyle: CaptionStyleType;
  generateCaptions: boolean;
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  lipSyncEnvelope?: number[];
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  className?: string;
}

export function drawAnimatedAvatarFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsedSec: number,
  params: {
    avatar: VoxaPresenterAvatar;
    scenario: VoxaPresenterScenario;
    avatarImg: HTMLImageElement | null;
    bgImg: HTMLImageElement | null;
    logoImg: HTMLImageElement | null;
    showVoxaLogo: boolean;
    voxaWatermark: boolean;
    captions: CaptionSegment[];
    captionStyle: CaptionStyleType;
    generateCaptions: boolean;
    isPlaying: boolean;
    lipSyncEnvelope?: number[];
  }
) {
  const {
    avatar,
    scenario,
    avatarImg,
    bgImg,
    logoImg,
    showVoxaLogo,
    voxaWatermark,
    captions,
    captionStyle,
    generateCaptions,
    isPlaying,
    lipSyncEnvelope
  } = params;

  ctx.clearRect(0, 0, w, h);

  // 1. Background Studio Environment
  const isWhiteStudio = scenario.backgroundType === 'white_studio';
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    const imgRatio = bgImg.width / bgImg.height;
    const canvasRatio = w / h;
    let drawW = w;
    let drawH = h;
    let drawX = 0;
    let drawY = 0;
    if (imgRatio > canvasRatio) {
      drawW = h * imgRatio;
      drawX = (w - drawW) / 2;
    } else {
      drawH = w / imgRatio;
      drawY = (h - drawH) / 2;
    }
    ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);
    ctx.fillStyle = isWhiteStudio ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.38)';
    ctx.fillRect(0, 0, w, h);
  } else {
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.35, w * 0.05, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    grad.addColorStop(0, scenario.backgroundColor || '#FFFFFF');
    grad.addColorStop(1, scenario.secondaryColor || '#E5E7EB');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle studio lighting beams
    const lightGrad = ctx.createRadialGradient(w * 0.5, h * 0.15, 10, w * 0.5, h * 0.25, w * 0.65);
    lightGrad.addColorStop(0, isWhiteStudio ? 'rgba(255,0,51,0.06)' : 'rgba(255,0,51,0.18)');
    lightGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lightGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // Top red/black signature bar for VOXA OFFICIAL STUDIO
  ctx.fillStyle = '#FF0033';
  ctx.fillRect(0, 0, w, Math.max(4, h * 0.005));

  // 2. VOXA Official Backdrop Logo
  if (showVoxaLogo) {
    ctx.save();
    ctx.globalAlpha = isWhiteStudio ? 0.12 : 0.16;
    ctx.fillStyle = isWhiteStudio ? '#09090B' : '#FFFFFF';
    ctx.font = `900 ${Math.round(w * 0.15)}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('VOXA', w / 2, h * 0.23);
    ctx.restore();

    // Corner Studio Badge
    const badgeX = w * 0.05;
    const badgeY = h * 0.04;
    const badgeH = Math.max(28, h * 0.036);
    const badgeW = Math.max(125, w * 0.24);
    ctx.save();
    ctx.fillStyle = isWhiteStudio ? 'rgba(255,255,255,0.92)' : 'rgba(12,11,22,0.88)';
    ctx.strokeStyle = isWhiteStudio ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fill();
    ctx.stroke();

    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      const iconS = badgeH * 0.65;
      ctx.drawImage(logoImg, badgeX + 10, badgeY + (badgeH - iconS) / 2, iconS, iconS);
    } else {
      ctx.fillStyle = '#FF0033';
      ctx.beginPath();
      ctx.arc(badgeX + badgeH * 0.5, badgeY + badgeH * 0.5, badgeH * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isWhiteStudio ? '#09090B' : '#FFFFFF';
    ctx.font = `900 ${Math.max(10, Math.round(badgeH * 0.36))}px Orbitron, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('VOXA STUDIO', badgeX + badgeH * 0.9, badgeY + badgeH * 0.63);
    ctx.restore();
  }

  // 3. Compute Real-Time Kinematic Parameters (Lip-Sync, Blinks, Head Tilt, Shoulders, Gestures)
  const frameIdx = Math.floor(elapsedSec * 30);
  let speechEnergy = 0;
  if (isPlaying) {
    if (lipSyncEnvelope && lipSyncEnvelope.length > 0) {
      speechEnergy = lipSyncEnvelope[frameIdx % lipSyncEnvelope.length] ?? 0.35;
    } else {
      speechEnergy =
        0.35 +
        0.35 * Math.abs(Math.sin(elapsedSec * 11.5)) +
        0.25 * Math.abs(Math.cos(elapsedSec * 7.3));
    }
  }

  // Natural breathing & shoulder motion
  const breathOffsetY = Math.sin(elapsedSec * 2.3) * (h * 0.0045) + (isPlaying ? speechEnergy * (h * 0.003) : 0);
  const shoulderScaleX = 1 + Math.sin(elapsedSec * 2.3) * 0.008 + (isPlaying ? speechEnergy * 0.012 : 0);

  // Subtle head sway & tilt
  const headTiltRad = isPlaying
    ? Math.sin(elapsedSec * 1.65) * 0.022 + Math.cos(elapsedSec * 2.9) * 0.009
    : Math.sin(elapsedSec * 0.9) * 0.006;
  const headShiftX = isPlaying ? Math.sin(elapsedSec * 1.3) * (w * 0.008) : 0;

  // Periodic natural eye blink every ~3.4s + micro eye saccade
  const blinkCycle = elapsedSec % 3.4;
  const isBlinking = blinkCycle > 3.18 && blinkCycle < 3.34;

  // 4. Draw Animated Presenter Avatar with Kinematic Warp Rig (Head + Torso + Mouth + Eyes + Gestures)
  const avatarBoxW = Math.min(w * 0.68, h * 0.48);
  const avatarBoxH = avatarBoxW * 1.18;
  const centerX = w / 2 + headShiftX;
  const centerY = h * 0.46 + breathOffsetY;

  ctx.save();
  ctx.translate(centerX, centerY);

  // Rim glow behind presenter
  const auraGrad = ctx.createRadialGradient(0, 0, avatarBoxW * 0.2, 0, 0, avatarBoxW * 0.65);
  auraGrad.addColorStop(0, 'rgba(255, 0, 51, 0.20)');
  auraGrad.addColorStop(1, 'rgba(255, 0, 51, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(0, 0, avatarBoxW * 0.65, 0, Math.PI * 2);
  ctx.fill();

  if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
    // Draw Upper Body / Shoulders Layer (breathing + shoulder micro-gesture)
    ctx.save();
    ctx.scale(shoulderScaleX, 1 + speechEnergy * 0.014);
    ctx.beginPath();
    ctx.roundRect(-avatarBoxW / 2, -avatarBoxH / 2, avatarBoxW, avatarBoxH, avatarBoxW * 0.12);
    ctx.clip();

    // Draw base portrait scaled to cover
    const imgR = avatarImg.width / avatarImg.height;
    const boxR = avatarBoxW / avatarBoxH;
    let sw = avatarImg.width;
    let sh = avatarImg.height;
    let sx = 0;
    let sy = 0;
    if (imgR > boxR) {
      sw = avatarImg.height * boxR;
      sx = (avatarImg.width - sw) / 2;
    } else {
      sh = avatarImg.width / boxR;
      sy = (avatarImg.height - sh) / 2;
    }

    // Apply subtle head rotation and dynamic jaw/lip-sync slice displacement
    ctx.rotate(headTiltRad);
    ctx.drawImage(
      avatarImg,
      sx,
      sy,
      sw,
      sh,
      -avatarBoxW / 2,
      -avatarBoxH / 2,
      avatarBoxW,
      avatarBoxH
    );

    // Dynamic Lower-Face / Jaw Articulation Slice when speaking (Lip-Sync Warping)
    if (isPlaying && speechEnergy > 0.08) {
      const jawSliceTopRatio = 0.50;
      const jawSliceHeightRatio = 0.24;
      const jawDropPx = speechEnergy * (avatarBoxH * 0.026);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(
        0,
        -avatarBoxH * 0.5 + avatarBoxH * 0.60,
        avatarBoxW * 0.24,
        avatarBoxH * 0.13,
        0,
        0,
        Math.PI * 2
      );
      ctx.clip();

      ctx.drawImage(
        avatarImg,
        sx,
        sy + sh * jawSliceTopRatio,
        sw,
        sh * jawSliceHeightRatio,
        -avatarBoxW / 2,
        -avatarBoxH / 2 + avatarBoxH * jawSliceTopRatio + jawDropPx,
        avatarBoxW,
        avatarBoxH * jawSliceHeightRatio
      );

      // Subtle oral cavity shadow synced to vowel peak
      const mouthOpenH = Math.max(2, speechEnergy * (avatarBoxH * 0.032));
      const mouthOpenW = avatarBoxW * (0.11 + speechEnergy * 0.05);
      const mouthY = -avatarBoxH * 0.5 + avatarBoxH * 0.585 + jawDropPx * 0.5;
      const mouthGrad = ctx.createRadialGradient(0, mouthY, 1, 0, mouthY, mouthOpenW);
      mouthGrad.addColorStop(0, `rgba(35, 8, 14, ${Math.min(0.68, speechEnergy * 0.72)})`);
      mouthGrad.addColorStop(0.7, `rgba(110, 25, 38, ${Math.min(0.38, speechEnergy * 0.42)})`);
      mouthGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mouthGrad;
      ctx.beginPath();
      ctx.ellipse(0, mouthY, mouthOpenW, mouthOpenH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Natural Eye Blink Overlay
    if (isBlinking) {
      const eyeY = -avatarBoxH * 0.5 + avatarBoxH * 0.385;
      const eyeOffsetX = avatarBoxW * 0.115;
      const eyeW = avatarBoxW * 0.065;
      const eyeH = avatarBoxH * 0.012;
      ctx.fillStyle = 'rgba(185, 142, 118, 0.68)';
      ctx.beginPath();
      ctx.ellipse(-eyeOffsetX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.ellipse(eyeOffsetX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Frame border & animated speaking pulse ring
    ctx.strokeStyle = isPlaying && speechEnergy > 0.25 ? '#FF0033' : isWhiteStudio ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = isPlaying ? 2.5 + speechEnergy * 3.5 : 2;
    ctx.beginPath();
    ctx.roundRect(-avatarBoxW / 2, -avatarBoxH / 2, avatarBoxW, avatarBoxH, avatarBoxW * 0.12);
    ctx.stroke();

    // Animated Gesturing Hand / Audio-Reactive Presenter HUD Accent
    if (isPlaying) {
      const barCount = 15;
      const totalBarW = avatarBoxW * 0.55;
      const startX = -totalBarW / 2;
      const baseWaveY = avatarBoxH / 2 - avatarBoxH * 0.06;
      for (let b = 0; b < barCount; b++) {
        const waveFactor = Math.abs(Math.sin(elapsedSec * 12 + b * 0.55)) * speechEnergy;
        const bh = Math.max(4, waveFactor * (avatarBoxH * 0.075));
        const bx = startX + (b / barCount) * totalBarW;
        ctx.fillStyle = b % 2 === 0 ? '#FF0033' : '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(bx, baseWaveY - bh / 2, Math.max(3, totalBarW / (barCount * 1.8)), bh, 3);
        ctx.fill();
      }
    }
  } else {
    // Fallback vector silhouette if image is still loading
    ctx.fillStyle = '#18181B';
    ctx.beginPath();
    ctx.roundRect(-avatarBoxW / 2, -avatarBoxH / 2, avatarBoxW, avatarBoxH, avatarBoxW * 0.12);
    ctx.fill();
  }

  ctx.restore();

  // 5. Lower-Third Presenter Nameplate
  const plateW = Math.min(w * 0.72, 360);
  const plateH = Math.max(38, h * 0.052);
  const plateX = (w - plateW) / 2;
  const plateY = centerY + avatarBoxH / 2 + h * 0.022;

  ctx.save();
  ctx.fillStyle = isWhiteStudio ? 'rgba(9,9,11,0.92)' : 'rgba(18,17,29,0.92)';
  ctx.strokeStyle = 'rgba(255,0,51,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `900 ${Math.max(12, Math.round(plateH * 0.36))}px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(avatar.name.toUpperCase(), w / 2, plateY + plateH * 0.48);

  ctx.fillStyle = '#FF0033';
  ctx.font = `700 ${Math.max(9, Math.round(plateH * 0.24))}px sans-serif`;
  ctx.fillText((avatar.roleTitle || 'VOXA STUDIO IA').toUpperCase(), w / 2, plateY + plateH * 0.80);
  ctx.restore();

  // 6. Synchronized Timed Captions (Clean / Bold / Social / Minimal)
  if (generateCaptions && captions.length > 0) {
    const activeCap =
      captions.find((c) => elapsedSec >= c.startSec && elapsedSec <= c.endSec) ||
      captions[captions.length - 1];

    if (activeCap && activeCap.text) {
      const capBoxW = w * 0.86;
      const capBoxH = Math.max(58, h * 0.095);
      const capX = (w - capBoxW) / 2;
      const capY = h - capBoxH - h * 0.055;

      ctx.save();
      if (captionStyle === 'Social') {
        ctx.fillStyle = 'rgba(255, 0, 51, 0.94)';
        ctx.strokeStyle = '#FFFFFF';
      } else if (captionStyle === 'Minimal') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      } else {
        ctx.fillStyle = 'rgba(9, 9, 11, 0.90)';
        ctx.strokeStyle = captionStyle === 'Bold' ? '#FF0033' : 'rgba(255,255,255,0.22)';
      }
      ctx.lineWidth = captionStyle === 'Bold' ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(capX, capY, capBoxW, capBoxH, 14);
      ctx.fill();
      ctx.stroke();

      const fontSize = Math.max(13, Math.round(w * (captionStyle === 'Bold' ? 0.036 : 0.032)));
      ctx.fillStyle = captionStyle === 'Bold' ? '#FACC15' : '#FFFFFF';
      ctx.font = `${captionStyle === 'Minimal' ? '600' : '800'} ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';

      // Wrap caption text into max 2 lines
      const words = activeCap.text.split(' ');
      const mid = Math.ceil(words.length / 2);
      const line1 = words.length > 5 ? words.slice(0, mid).join(' ') : activeCap.text;
      const line2 = words.length > 5 ? words.slice(mid).join(' ') : '';

      if (line2) {
        ctx.fillText(line1, w / 2, capY + capBoxH * 0.42, capBoxW * 0.92);
        ctx.fillText(line2, w / 2, capY + capBoxH * 0.76, capBoxW * 0.92);
      } else {
        ctx.fillText(line1, w / 2, capY + capBoxH * 0.58, capBoxW * 0.92);
      }
      ctx.restore();
    }
  }

  // 7. Responsible AI Watermark ("Criado com VOXA AI")
  if (voxaWatermark) {
    ctx.save();
    ctx.fillStyle = 'rgba(9,9,11,0.72)';
    const wmW = Math.max(115, w * 0.22);
    const wmH = Math.max(22, h * 0.026);
    const wmX = w - wmW - w * 0.04;
    const wmY = h - wmH - h * 0.015;
    ctx.beginPath();
    ctx.roundRect(wmX, wmY, wmW, wmH, wmH / 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${Math.max(9, Math.round(wmH * 0.45))}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Criado com VOXA AI', wmX + wmW / 2, wmY + wmH * 0.66);
    ctx.restore();
  }
}

export const AnimatedTalkingAvatarCanvas: React.FC<AnimatedTalkingAvatarCanvasProps> = ({
  avatar,
  scenario,
  customBackgroundUrl,
  aspectRatio,
  showVoxaLogo,
  voxaWatermark,
  companyLogoUrl,
  captions,
  captionStyle,
  generateCaptions,
  isPlaying,
  currentTimeSec,
  lipSyncEnvelope,
  canvasRef: externalCanvasRef,
  className
}) => {
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;

  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!avatar?.avatarUrl) {
      avatarImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = avatar.avatarUrl;
    img.onload = () => {
      avatarImgRef.current = img;
    };
  }, [avatar?.avatarUrl]);

  useEffect(() => {
    const bgSrc = customBackgroundUrl || scenario?.backgroundImageUrl;
    if (!bgSrc) {
      bgImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = bgSrc;
    img.onload = () => {
      bgImgRef.current = img;
    };
  }, [customBackgroundUrl, scenario?.backgroundImageUrl]);

  useEffect(() => {
    if (!companyLogoUrl) {
      logoImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = companyLogoUrl;
    img.onload = () => {
      logoImgRef.current = img;
    };
  }, [companyLogoUrl]);

  useEffect(() => {
    let rafId: number;
    const startTime = performance.now();

    const renderLoop = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const idleSec = (now - startTime) / 1000;
          const effectiveTime = isPlaying ? currentTimeSec : idleSec;
          drawAnimatedAvatarFrame(ctx, canvas.width, canvas.height, effectiveTime, {
            avatar,
            scenario,
            avatarImg: avatarImgRef.current,
            bgImg: bgImgRef.current,
            logoImg: logoImgRef.current,
            showVoxaLogo,
            voxaWatermark,
            captions,
            captionStyle,
            generateCaptions,
            isPlaying,
            lipSyncEnvelope
          });
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    avatar,
    scenario,
    customBackgroundUrl,
    showVoxaLogo,
    voxaWatermark,
    captions,
    captionStyle,
    generateCaptions,
    isPlaying,
    currentTimeSec,
    lipSyncEnvelope
  ]);

  const dims =
    aspectRatio === '9:16'
      ? { width: 540, height: 960 }
      : aspectRatio === '1:1'
      ? { width: 720, height: 720 }
      : aspectRatio === '4:5'
      ? { width: 640, height: 800 }
      : { width: 960, height: 540 };

  return (
    <canvas
      ref={canvasRef}
      width={dims.width}
      height={dims.height}
      className={className || 'w-full h-full object-contain rounded-2xl shadow-2xl'}
    />
  );
};
