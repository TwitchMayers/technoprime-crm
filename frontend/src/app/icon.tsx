import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 184,
          fontWeight: 800,
          letterSpacing: '-0.08em',
          fontFamily: 'Arial',
        }}
      >
        <div
          style={{
            width: 384,
            height: 384,
            borderRadius: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(125,211,252,0.35)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
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
