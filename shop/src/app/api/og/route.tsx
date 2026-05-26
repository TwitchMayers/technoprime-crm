import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = String(searchParams.get('title') || 'TechnoPrime Store').slice(0, 90);
  const subtitle = String(
    searchParams.get('subtitle') ||
      'Игровые приставки, аксессуары и комплекты с честной ценой и поддержкой.',
  ).slice(0, 160);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top right, rgba(34,211,238,0.26), transparent 34%), linear-gradient(135deg, #020617 0%, #082f49 48%, #0f172a 100%)',
          color: 'white',
          fontFamily: 'Segoe UI, Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(140deg, rgba(125,211,252,0.10), transparent 32%), linear-gradient(320deg, rgba(14,165,233,0.16), transparent 40%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            padding: '58px 64px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 74,
                height: 74,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(34,211,238,0.14)',
                border: '1px solid rgba(186,230,253,0.28)',
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: 1.5,
              }}
            >
              TP
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: 3.2,
                  textTransform: 'uppercase',
                  color: '#a5f3fc',
                }}
              >
                TechnoPrime Store
              </div>
              <div
                style={{
                  fontSize: 20,
                  color: 'rgba(226,232,240,0.88)',
                }}
              >
                Игровые приставки и готовые комплекты
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              maxWidth: 860,
            }}
          >
            <div
              style={{
                fontSize: 64,
                lineHeight: 1.06,
                fontWeight: 800,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.45,
                color: 'rgba(226,232,240,0.92)',
              }}
            >
              {subtitle}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 24,
              color: 'rgba(186,230,253,0.9)',
            }}
          >
            <div>technoprimestore.ru</div>
            <div>Проверка • Гарантия • Доставка</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
