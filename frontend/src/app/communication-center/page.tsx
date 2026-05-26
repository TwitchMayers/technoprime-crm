'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import { Megaphone } from 'lucide-react';
import MobilePageHeader from '@/components/MobilePageHeader';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const ClientMessengerView = dynamic(() =>
  import('@/app/clients/components/ClientMessengerView').then(module => module.ClientMessengerView),
);
const AvitoMessengerView = dynamic(() =>
  import('./AvitoMessengerView').then(module => module.AvitoMessengerView),
);
const MarketingCampaignsPage = dynamic(() => import('@/app/marketing-campaigns/page'));

type CenterTab = 'messages' | 'avito' | 'campaigns';

type AvitoConnectedMini = {
  id: number;
  displayName: string;
  externalAccountId?: string | null;
  lastSyncAt?: string | null;
  requiresReconnect?: boolean;
};

function resolveTab(raw: string | null): CenterTab {
  if (raw === 'campaigns') return 'campaigns';
  if (raw === 'avito') return 'avito';
  return 'messages';
}

function formatMiniSync(value?: string | null) {
  if (!value) return 'синк ещё не был';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'синк: —';
  return `синк ${date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

export default function CommunicationCenterPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [avitoMini, setAvitoMini] = useState<AvitoConnectedMini | null>(null);
  const [avitoMiniLoading, setAvitoMiniLoading] = useState(false);

  const activeTab = useMemo(() => resolveTab(searchParams.get('tab')), [searchParams]);

  const setTab = (nextTab: CenterTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', nextTab);
    router.replace(`${pathname}?${next.toString()}`);
  };

  useEffect(() => {
    if (activeTab !== 'avito') return;
    let cancelled = false;

    const loadAvitoMini = async () => {
      setAvitoMiniLoading(true);
      try {
        const response = await fetchWithAuth('/api/logistics/marketplace-accounts/avito/connected');
        if (cancelled) return;
        const rows = Array.isArray(response) ? response : [];
        const preferred =
          rows.find((item: AvitoConnectedMini) => !item.requiresReconnect) ||
          rows[0] ||
          null;
        setAvitoMini(preferred);
      } catch {
        if (!cancelled) {
          setAvitoMini(null);
        }
      } finally {
        if (!cancelled) {
          setAvitoMiniLoading(false);
        }
      }
    };

    void loadAvitoMini();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  return (
    <Stack spacing={{ xs: 1.25, md: 2.5 }} className="overflow-x-hidden">
      <MobilePageHeader
        title={activeTab === 'avito' ? 'Avito' : activeTab === 'campaigns' ? 'Рассылки' : 'Коммуникации'}
        subtitle={
          activeTab === 'avito'
            ? 'Чаты и ответы менеджеров'
            : activeTab === 'campaigns'
              ? 'Маркетинговые кампании'
              : 'Диалоги клиентов в одном окне'
        }
        sticky={false}
      />

      <Box
        className="md:hidden"
        sx={{
          px: 1.25,
          py: 1.1,
          borderRadius: 3,
          border: '1px solid rgba(71,85,105,0.45)',
          bgcolor: 'rgba(2,6,23,0.42)',
        }}
      >
        {activeTab === 'avito' ? (
          <Box
            sx={{
              mb: 1,
              border: '1px solid rgba(71,85,105,0.5)',
              borderRadius: 2,
              bgcolor: 'rgba(2,6,23,0.55)',
              px: 1.1,
              py: 0.55,
              fontSize: '11px',
              lineHeight: 1.25,
              color: 'rgba(226,232,240,0.92)',
            }}
          >
            {avitoMiniLoading ? (
              'Avito: загружаю подключённый аккаунт…'
            ) : avitoMini ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <span className="truncate">
                  <strong>Avito</strong> · {avitoMini.displayName}
                </span>
                <span className="shrink-0 text-[10px] text-slate-300">
                  {avitoMini.externalAccountId ? `ID ${avitoMini.externalAccountId} · ` : ''}
                  {formatMiniSync(avitoMini.lastSyncAt).replace(/^синк\s*/i, '')}
                </span>
              </Box>
            ) : (
              'Avito: подключите аккаунт в интеграциях'
            )}
          </Box>
        ) : null}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setTab('messages')}
            className={`min-h-9 rounded-2xl px-3 text-[13px] font-semibold transition ${
              activeTab === 'messages'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'border border-slate-700/70 bg-slate-950/65 text-slate-200'
            }`}
          >
            Сообщения
          </button>
          <button
            type="button"
            onClick={() => setTab('avito')}
            className={`min-h-9 rounded-2xl px-3 text-[13px] font-semibold transition ${
              activeTab === 'avito'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'border border-slate-700/70 bg-slate-950/65 text-slate-200'
            }`}
          >
            Avito
          </button>
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-2xl px-3 text-[12px] font-semibold transition ${
              activeTab === 'campaigns'
                ? 'border border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100'
                : 'border border-slate-700/70 bg-slate-950/60 text-slate-300'
            }`}
            aria-label="Перейти к рассылкам"
            title="Рассылки"
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>Рассылки</span>
          </button>
        </Box>
      </Box>

      <Box
        className="hidden md:block"
        sx={{
          p: { xs: 1.25, md: 2.5 },
          borderRadius: 3,
          border: '1px solid rgba(56,189,248,0.3)',
          bgcolor: 'rgba(15,23,42,0.55)',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#f8fafc', fontSize: { xs: '1.35rem', md: '2.125rem' } }}>
          Коммуникационный центр
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75, color: 'rgba(148,163,184,0.96)' }}>
          Сообщения клиентов, ответы менеджеров и история рассылок в одном разделе.
        </Typography>
      </Box>

      <Box
        className="hidden md:block"
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(71,85,105,0.45)',
          bgcolor: 'rgba(2,6,23,0.42)',
          px: { xs: 0.25, md: 1 },
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value: CenterTab) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            '& .MuiTabs-flexContainer': {
              gap: { xs: 0.5, md: 1 },
            },
            '& .MuiTabs-scrollButtons': {
              color: 'rgba(203,213,225,0.75)',
            },
            '& .MuiTab-root': {
              textTransform: 'none',
              minHeight: { xs: 40, md: 48 },
              minWidth: { xs: 112, md: 180 },
              color: 'rgba(203,213,225,0.84)',
              fontWeight: 700,
              fontSize: { xs: '0.76rem', md: '0.95rem' },
              px: { xs: 1.25, md: 2 },
            },
            '& .MuiTab-root.Mui-selected': {
              color: '#f8fafc',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#38bdf8',
              height: 3,
              borderRadius: 3,
            },
          }}
        >
          <Tab value="messages" label="Сообщения клиентов" />
          <Tab value="avito" label="Avito" />
          <Tab value="campaigns" label="Рассылки" />
        </Tabs>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        {activeTab === 'messages' ? <ClientMessengerView /> : activeTab === 'avito' ? <AvitoMessengerView /> : <MarketingCampaignsPage />}
      </Box>
    </Stack>
  );
}
