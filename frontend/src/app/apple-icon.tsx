import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top left, rgba(45,212,191,0.55), transparent 42%), linear-gradient(145deg, #0f172a 0%, #111827 45%, #1d4ed8 100%)',
          color: 'white',
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: '-0.08em',
          fontFamily: 'Arial',
        }}
      >
        <div
          style={{
            width: 136,
            height: 136,
            borderRadius: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(125,211,252,0.35)',
            background: 'linear-gradient(160deg, rgba(15,23,42,0.92), rgba(30,41,59,0.92))',
          }}
        >
          TP
        </div>
      </div>
    ),
    size,
  );
}
