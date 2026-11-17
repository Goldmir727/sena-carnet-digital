import { useLayoutEffect, useRef, useState } from 'react';
import { QrCode, UserRound } from 'lucide-react';
import {
  CARNET,
  CARNET_COLORS,
  CARNET_LAYOUT,
  LOGO_URL,
  buildCarnetData,
  documentLine,
  mmToPx,
  photoUrl,
  ptToPx,
  ptToMm,
  regionalLabel,
  roleLabel,
} from '../../lib/carnetDesign';

const px = mmToPx;
const font = ptToPx;
const FONT_FAMILY = 'Helvetica, Arial, sans-serif';

function OneLineText({ top, size, color, weight = 400, letterSpacing = 0, children }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: px(CARNET_LAYOUT.contentX),
        top: px(top),
        width: px(CARNET_LAYOUT.contentW),
        fontFamily: FONT_FAMILY,
        fontSize: font(size),
        lineHeight: 1.15,
        fontWeight: weight,
        color,
        letterSpacing: letterSpacing ? px(letterSpacing) : undefined,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {children}
    </div>
  );
}

function ClampedText({ top, size, color, weight = 400, lines = 1, lineHeight = 1.2, children }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: px(CARNET_LAYOUT.contentX),
        top: px(top),
        width: px(CARNET_LAYOUT.contentW),
        fontFamily: FONT_FAMILY,
        fontSize: font(size),
        lineHeight,
        fontWeight: weight,
        color,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: lines,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        wordBreak: 'break-word',
      }}
    >
      {children}
    </div>
  );
}

function PhotoBox({ foto, alt }) {
  const src = photoUrl(foto);
  const [failed, setFailed] = useState(false);
  const { x, y, size } = CARNET_LAYOUT.photo;
  const showImage = Boolean(src) && !failed;

  return (
    <div
      style={{
        position: 'absolute',
        left: px(x),
        top: px(y),
        width: px(size),
        height: px(size),
        overflow: 'hidden',
        background: CARNET_COLORS.photoBg,
        border: `${Math.max(1, px(0.15))}px solid ${CARNET_COLORS.line}`,
      }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt || 'Fotografía del titular'}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: CARNET_COLORS.photoInk,
          }}
        >
          <UserRound style={{ width: px(7), height: px(7) }} strokeWidth={1.5} />
          <span
            style={{
              marginTop: px(0.7),
              fontFamily: FONT_FAMILY,
              fontSize: font(4.4),
              fontWeight: 700,
              letterSpacing: px(0.12),
            }}
          >
            SIN FOTO
          </span>
        </div>
      )}
    </div>
  );
}

function QrBox({ qrUrl }) {
  const { x, y, w, h, radius } = CARNET_LAYOUT.qrPanel;
  const size = CARNET_LAYOUT.qr.size;

  return (
    <div
      style={{
        position: 'absolute',
        left: px(x),
        top: px(y),
        width: px(w),
        height: px(h),
        border: `${Math.max(1, px(0.18))}px solid ${CARNET_COLORS.line}`,
        borderRadius: px(radius),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: CARNET_COLORS.white,
      }}
    >
      {qrUrl ? (
        <img
          src={qrUrl}
          alt="Código QR permanente"
          style={{ width: px(size), height: px(size), objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: px(0.5),
            color: CARNET_COLORS.photoInk,
          }}
        >
          <QrCode style={{ width: px(6), height: px(6) }} strokeWidth={1.5} />
          <span style={{ fontFamily: FONT_FAMILY, fontSize: font(4.2), fontWeight: 700 }}>
            QR NO DISPONIBLE
          </span>
        </div>
      )}
    </div>
  );
}

export default function CarnetPreview({ carnet, user, qrUrl }) {
  const data = buildCarnetData(carnet, user);
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ scale: 1, left: 0 });
  const [logoFailed, setLogoFailed] = useState(false);

  const designW = px(CARNET.width);
  const designH = px(CARNET.height);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth || designW;
      const scale = Math.min(1, width / designW);
      setBox({ scale, left: Math.max(0, (width - designW * scale) / 2) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [designW]);

  return (
    <div ref={wrapRef} className="w-full">
      <div style={{ position: 'relative', width: '100%', height: designH * box.scale }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: box.left,
            width: designW,
            height: designH,
            transform: `scale(${box.scale})`,
            transformOrigin: 'top left',
            background: CARNET_COLORS.white,
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.16)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: px(CARNET_LAYOUT.topBand.h),
              background: CARNET_COLORS.greenBand,
            }}
          />

          {logoFailed ? (
            <div
              style={{
                position: 'absolute',
                left: px(CARNET_LAYOUT.logo.x),
                top: px(CARNET_LAYOUT.logo.y),
                width: px(CARNET_LAYOUT.logo.w),
                height: px(CARNET_LAYOUT.logo.h),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: CARNET_COLORS.greenLogo,
                fontFamily: FONT_FAMILY,
                fontSize: font(18),
                fontWeight: 700,
              }}
            >
              SENA
            </div>
          ) : (
            <img
              src={LOGO_URL}
              alt="SENA"
              onError={() => setLogoFailed(true)}
              style={{
                position: 'absolute',
                left: px(CARNET_LAYOUT.logo.x),
                top: px(CARNET_LAYOUT.logo.y),
                width: px(CARNET_LAYOUT.logo.w),
                height: px(CARNET_LAYOUT.logo.h),
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}

          <PhotoBox
            key={data.foto_perfil || 'sin-foto'}
            foto={data.foto_perfil}
            alt={data.nombres}
          />

          <div
            style={{
              position: 'absolute',
              left: 0,
              top: px(CARNET_LAYOUT.divider.y),
              width: '100%',
              height: px(CARNET_LAYOUT.divider.h),
              background: CARNET_COLORS.green,
            }}
          />

          <OneLineText top={CARNET_LAYOUT.name1.y} size={CARNET_LAYOUT.name1.size} color={CARNET_COLORS.green} weight={700}>
            {data.nombres || '—'}
          </OneLineText>
          <OneLineText top={CARNET_LAYOUT.name2.y} size={CARNET_LAYOUT.name2.size} color={CARNET_COLORS.ink} weight={700}>
            {data.apellidos || ''}
          </OneLineText>
          <OneLineText
            top={CARNET_LAYOUT.doc.y}
            size={CARNET_LAYOUT.doc.size}
            color={CARNET_COLORS.muted}
            weight={700}
            letterSpacing={0.12}
          >
            {documentLine(data)}
          </OneLineText>

          <div
            style={{
              position: 'absolute',
              left: px(CARNET_LAYOUT.contentX),
              top: px(CARNET_LAYOUT.badge.y),
              height: px(CARNET_LAYOUT.badge.h),
              minWidth: px(14),
              padding: `0 ${px(2.4)}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `${Math.max(1, px(0.18))}px solid ${CARNET_COLORS.green}`,
              borderRadius: px(CARNET_LAYOUT.badge.radius),
              color: CARNET_COLORS.green,
              fontFamily: FONT_FAMILY,
              fontSize: font(CARNET_LAYOUT.badge.size),
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              maxWidth: px(CARNET_LAYOUT.contentW),
              overflow: 'hidden',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {roleLabel(data)}
            </span>
          </div>

          <QrBox qrUrl={qrUrl} />

          <ClampedText
            top={CARNET_LAYOUT.centro.y}
            size={CARNET_LAYOUT.centro.size}
            color={CARNET_COLORS.muted}
            lines={1}
            lineHeight={1.2}
          >
            {data.centro_nombre || 'Centro de formación no disponible'}
          </ClampedText>
          <ClampedText
            top={CARNET_LAYOUT.programa.y}
            size={CARNET_LAYOUT.programa.size}
            color={CARNET_COLORS.ink}
            weight={700}
            lines={2}
            lineHeight={CARNET_LAYOUT.programa.line / ptToMm(CARNET_LAYOUT.programa.size)}
          >
            {data.programa_nombre || 'Programa de formación no disponible'}
          </ClampedText>

          <div
            style={{
              position: 'absolute',
              left: 0,
              top: px(CARNET_LAYOUT.bottomBand.y),
              width: '100%',
              height: px(CARNET_LAYOUT.bottomBand.h),
              background: CARNET_COLORS.bottomBand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                maxWidth: '100%',
                padding: `0 ${px(3)}px`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: FONT_FAMILY,
                fontSize: font(CARNET_LAYOUT.bottomBand.size),
                fontWeight: 700,
                letterSpacing: px(0.32),
                color: CARNET_COLORS.white,
                boxSizing: 'border-box',
              }}
            >
              {regionalLabel(data.regional)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
