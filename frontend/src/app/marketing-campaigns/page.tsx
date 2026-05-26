'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Card, CardContent, Grid, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { CampaignForm } from './components/CampaignForm';
import { CampaignHistory } from './components/CampaignHistory';
import { CampaignPreview } from './components/CampaignPreview';
import { CampaignStats } from './components/CampaignStats';
import {
  ActiveChannel,
  AudienceType,
  CampaignFormState,
  ClientAudienceItem,
  initialCampaignForm,
  MarketingCampaign,
} from './types';

const TP_TEXT_PRIMARY = '#e2e8f0';
const TP_TEXT_SECONDARY = '#94a3b8';

function parseResponseList<T>(raw: any): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (Array.isArray(raw?.items)) return raw.items as T[];
  if (Array.isArray(raw?.data)) return raw.data as T[];
  return [];
}

function inRegisteredRange(client: ClientAudienceItem, from?: string, to?: string) {
  if (!from && !to) return true;
  if (!client.createdAt) return false;
  const createdAt = new Date(client.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime()) && createdAt < fromDate) {
      return false;
    }
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime()) && createdAt > toDate) {
      return false;
    }
  }
  return true;
}

export default function MarketingCampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [clients, setClients] = useState<ClientAudienceItem[]>([]);
  const [form, setFormState] = useState<CampaignFormState>(initialCampaignForm);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const isAdmin = useMemo(
    () => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    [user?.role],
  );

  const setForm = (updater: (prev: CampaignFormState) => CampaignFormState) => {
    setFormState(prev => updater(prev));
  };

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const data = await fetchWithAuth('/api/marketing-campaigns');
      setCampaigns(parseResponseList<MarketingCampaign>(data));
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить кампании');
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const data = await fetchWithAuth('/api/clients?limit=1000');
      const items = parseResponseList<ClientAudienceItem>(data);
      setClients(items);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить клиентов для предпросмотра');
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void Promise.all([loadCampaigns(), loadClients()]);
  }, [isAdmin, loadCampaigns, loadClients]);

  const filteredAudience = useMemo(() => {
    const consented = clients.filter(client => Boolean(client.marketingConsent));
    return consented.filter(client => {
      if (form.audienceType === 'ACTIVE_ORDERS') {
        return (client.orders?.length || 0) > 0;
      }
      if (form.audienceType === 'SUBSCRIPTIONS') {
        return (client.subscriptions?.length || 0) > 0;
      }
      if (form.audienceType === 'REGISTERED_RANGE') {
        return inRegisteredRange(client, form.registeredFrom, form.registeredTo);
      }
      return true;
    });
  }, [clients, form.audienceType, form.registeredFrom, form.registeredTo]);

  const channelEligibleCounts = useMemo(() => {
    return {
      TELEGRAM: filteredAudience.filter(client => Boolean(client.telegramId)).length,
      VK: filteredAudience.filter(client => Boolean(client.vkId)).length,
    } as Record<ActiveChannel, number>;
  }, [filteredAudience]);

  const estimatedAudience = useMemo(() => {
    const selectedChannels = form.channels;
    if (!selectedChannels.length) return 0;
    return filteredAudience.filter(client =>
      selectedChannels.some(channel => {
        if (channel === 'TELEGRAM') return Boolean(client.telegramId);
        if (channel === 'VK') return Boolean(client.vkId);
        return false;
      }),
    ).length;
  }, [filteredAudience, form.channels]);

  const startProgress = () => {
    setSubmitProgress(10);
    return window.setInterval(() => {
      setSubmitProgress(prev => (prev >= 88 ? prev : prev + 7));
    }, 240);
  };

  const stopProgress = (timerId: number) => {
    window.clearInterval(timerId);
    setSubmitProgress(100);
    window.setTimeout(() => {
      setSubmitProgress(0);
    }, 320);
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      toast.error('Укажите заголовок рассылки');
      return false;
    }
    if (!form.message.trim() && !form.files.length) {
      toast.error('Введите текст сообщения или прикрепите файл');
      return false;
    }
    if (!form.channels.length) {
      toast.error('Выберите хотя бы один канал');
      return false;
    }
    if (estimatedAudience <= 0) {
      toast.error('Нет получателей для выбранной аудитории и каналов');
      return false;
    }
    if (
      form.audienceType === 'REGISTERED_RANGE' &&
      !form.registeredFrom &&
      !form.registeredTo
    ) {
      toast.error('Для кастомного фильтра задайте диапазон дат');
      return false;
    }
    const buttonText = form.buttonText.trim();
    const buttonUrl = form.buttonUrl.trim();
    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
      toast.error('Для кнопки укажите и текст, и ссылку');
      return false;
    }
    if (buttonUrl && !/^https:\/\//i.test(buttonUrl)) {
      toast.error('Ссылка кнопки должна начинаться с https://');
      return false;
    }
    return true;
  };

  const createCampaign = async (sendImmediately: boolean) => {
    if (!validateForm()) return;

    setSubmitting(true);
    const timerId = startProgress();

    try {
      const payload = new FormData();
      payload.append('title', form.title.trim());
      if (form.message.trim()) {
        payload.append('message', form.message.trim());
      }
      if (form.buttonText.trim()) {
        payload.append('buttonText', form.buttonText.trim());
      }
      if (form.buttonUrl.trim()) {
        payload.append('buttonUrl', form.buttonUrl.trim());
      }
      for (const channel of form.channels) {
        payload.append('channels', channel);
      }
      payload.append('audienceType', form.audienceType as AudienceType);
      if (form.registeredFrom) {
        payload.append('registeredFrom', form.registeredFrom);
      }
      if (form.registeredTo) {
        payload.append('registeredTo', form.registeredTo);
      }
      for (const file of form.files) {
        payload.append('files', file);
      }

      const created = await fetchWithAuth('/api/marketing-campaigns', {
        method: 'POST',
        body: payload,
      });

      if (sendImmediately && created?.id) {
        await fetchWithAuth(`/api/marketing-campaigns/${created.id}/send`, { method: 'POST' });
        toast.success('Кампания создана и поставлена в очередь отправки');
      } else {
        toast.success('Кампания сохранена как черновик');
      }

      setFormState(initialCampaignForm);
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error?.message || 'Операция не выполнена');
    } finally {
      stopProgress(timerId);
      setSubmitting(false);
    }
  };

  const runAction = async (
    campaignId: number,
    action: 'send' | 'repeat' | 'duplicate',
    successText: string,
  ) => {
    setActionLoadingId(campaignId);
    try {
      await fetchWithAuth(`/api/marketing-campaigns/${campaignId}/${action}`, {
        method: 'POST',
      });
      toast.success(successText);
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error?.message || 'Операция завершилась с ошибкой');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <Card sx={{ borderRadius: 3, border: '1px solid rgba(251,113,133,0.4)', bgcolor: 'rgba(127,29,29,0.2)' }}>
        <CardContent>
          <Typography variant="h6" sx={{ color: TP_TEXT_PRIMARY, fontWeight: 700 }}>
            Доступ запрещен
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: TP_TEXT_SECONDARY }}>
            Раздел «Рассылки» доступен только администраторам.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={3} sx={{ pb: 4, color: TP_TEXT_PRIMARY }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack spacing={0.4}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: TP_TEXT_PRIMARY }}>
            Рассылки
          </Typography>
          <Typography variant="body2" sx={{ color: TP_TEXT_SECONDARY }}>
            Маркетинговые кампании с фильтрацией аудитории и отправкой по каналам
          </Typography>
        </Stack>
        <Tooltip title="Обновить">
          <IconButton
            onClick={() => void Promise.all([loadCampaigns(), loadClients()])}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              border: '1px solid rgba(100,116,139,0.48)',
              bgcolor: 'rgba(15,23,42,0.6)',
              color: TP_TEXT_PRIMARY,
            }}
          >
            <RefreshCw
              className={`h-4 w-4 ${loadingCampaigns || loadingClients ? 'animate-spin' : ''}`}
            />
          </IconButton>
        </Tooltip>
      </Stack>

      <CampaignStats campaigns={campaigns} loading={loadingCampaigns} />

      <Grid
        container
        spacing={3}
        alignItems="stretch"
        sx={{
          '& .tpCard': {
            borderRadius: 3,
            border: `1px solid ${alpha('#94a3b8', 0.22)}`,
          },
        }}
      >
        <Grid size={{ xs: 12, lg: 8 }} sx={{ minWidth: 0 }}>
          <CampaignForm
            form={form}
            setForm={setForm}
            estimatedAudience={estimatedAudience}
            channelEligibleCounts={channelEligibleCounts}
            submitting={submitting}
            submitProgress={submitProgress}
            onCreateDraft={() => void createCampaign(false)}
            onCreateAndSend={() => void createCampaign(true)}
          />
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY, mb: 1 }}>
              История рассылок
            </Typography>
            <CampaignHistory
              campaigns={campaigns}
              loading={loadingCampaigns}
              actionLoadingId={actionLoadingId}
              onSend={campaignId =>
                void runAction(campaignId, 'send', 'Кампания поставлена в очередь отправки')
              }
              onRepeat={campaignId =>
                void runAction(campaignId, 'repeat', 'Кампания повторно поставлена в очередь')
              }
              onDuplicate={campaignId =>
                void runAction(campaignId, 'duplicate', 'Кампания продублирована')
              }
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }} sx={{ minWidth: 0 }}>
          <CampaignPreview
            form={form}
            estimatedAudience={estimatedAudience}
            channelEligibleCounts={channelEligibleCounts}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
