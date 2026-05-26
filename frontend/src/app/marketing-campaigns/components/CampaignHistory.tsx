import {
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { CopyPlus, Repeat2, Send } from 'lucide-react';
import { CHANNEL_OPTIONS, MarketingCampaign } from '../types';

const TP_TEXT_PRIMARY = '#e2e8f0';
const TP_TEXT_SECONDARY = '#94a3b8';

type Props = {
  campaigns: MarketingCampaign[];
  loading?: boolean;
  actionLoadingId?: number | null;
  onSend: (campaignId: number) => void;
  onRepeat: (campaignId: number) => void;
  onDuplicate: (campaignId: number) => void;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

function statusColor(campaign: MarketingCampaign) {
  if (campaign.isSending) {
    return { color: 'warning' as const, label: 'Отправляется' };
  }
  if (campaign.status === 'SENT') {
    return { color: 'success' as const, label: 'Отправлена' };
  }
  return { color: 'default' as const, label: 'Черновик' };
}

export function CampaignHistory({
  campaigns,
  loading,
  actionLoadingId,
  onSend,
  onRepeat,
  onDuplicate,
}: Props) {
  if (loading) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={120} />
      </Stack>
    );
  }

  if (!campaigns.length) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(148,163,184,0.22)',
          bgcolor: 'rgba(15,23,42,0.55)',
          color: TP_TEXT_PRIMARY,
        }}
      >
        <CardContent>
          <Typography variant="body2" sx={{ color: TP_TEXT_SECONDARY }}>
            Пока нет созданных рассылок.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      {campaigns.map(campaign => {
        const status = statusColor(campaign);
        const isActionLoading = actionLoadingId === campaign.id;

        return (
          <Card
            key={campaign.id}
            sx={{
              borderRadius: 3,
              border: '1px solid rgba(148,163,184,0.22)',
              bgcolor: 'rgba(15,23,42,0.55)',
              color: TP_TEXT_PRIMARY,
            }}
          >
            <CardContent>
              <Stack spacing={1.4}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
                  <Stack spacing={0.2}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY }}>
                      {campaign.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: TP_TEXT_SECONDARY }}>
                      Создана: {formatDate(campaign.createdAt)} | Отправлена: {formatDate(campaign.sentAt)}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={status.label}
                    color={status.color}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>

                <Typography
                  variant="body2"
                  sx={{
                    color: TP_TEXT_SECONDARY,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {campaign.message}
                </Typography>

                <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
                  {campaign.channels.map(channel => (
                    <Chip
                      key={`${campaign.id}-${channel}`}
                      size="small"
                      label={CHANNEL_OPTIONS.find(item => item.value === channel)?.short || channel}
                      sx={{
                        bgcolor: 'rgba(14,165,233,0.16)',
                        border: '1px solid rgba(56,189,248,0.45)',
                        color: TP_TEXT_PRIMARY,
                      }}
                    />
                  ))}
                  {campaign.attachments?.length ? (
                    <Chip
                      size="small"
                      label={`Файлы: ${campaign.attachments.length}`}
                      sx={{
                        bgcolor: 'rgba(100,116,139,0.24)',
                        color: TP_TEXT_PRIMARY,
                      }}
                    />
                  ) : null}
                  <Typography variant="caption" sx={{ color: TP_TEXT_SECONDARY, ml: 'auto' }}>
                    Успешно: {campaign.sentCount} | Ошибки: {campaign.errorCount}
                  </Typography>
                </Stack>

                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Tooltip title="Поставить кампанию в очередь отправки">
                    <span>
                      <Chip
                        icon={<Send size={14} />}
                        label={isActionLoading ? 'Обработка...' : 'Отправить'}
                        onClick={() => onSend(campaign.id)}
                        clickable
                        disabled={isActionLoading || campaign.isSending}
                        color="info"
                        variant="outlined"
                        sx={{ color: TP_TEXT_PRIMARY }}
                      />
                    </span>
                  </Tooltip>
                  <Tooltip title="Отправить кампанию повторно">
                    <span>
                      <Chip
                        icon={<Repeat2 size={14} />}
                        label="Повторить"
                        onClick={() => onRepeat(campaign.id)}
                        clickable
                        disabled={isActionLoading || campaign.isSending}
                        color="warning"
                        variant="outlined"
                        sx={{ color: TP_TEXT_PRIMARY }}
                      />
                    </span>
                  </Tooltip>
                  <Tooltip title="Создать копию как новую кампанию">
                    <span>
                      <Chip
                        icon={<CopyPlus size={14} />}
                        label="Дублировать"
                        onClick={() => onDuplicate(campaign.id)}
                        clickable
                        disabled={isActionLoading}
                        color="default"
                        variant="outlined"
                        sx={{ color: TP_TEXT_PRIMARY }}
                      />
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
