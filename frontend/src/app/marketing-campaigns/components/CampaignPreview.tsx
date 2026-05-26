import {
  Badge,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Eye, Paperclip, Users } from 'lucide-react';
import { AUDIENCE_OPTIONS, CampaignFormState, CHANNEL_OPTIONS } from '../types';

const TP_TEXT_PRIMARY = '#e2e8f0';
const TP_TEXT_SECONDARY = '#94a3b8';

type Props = {
  form: CampaignFormState;
  estimatedAudience: number;
  channelEligibleCounts: Record<'TELEGRAM' | 'VK' | 'MAX', number>;
};

export function CampaignPreview({ form, estimatedAudience, channelEligibleCounts }: Props) {
  const audienceLabel =
    AUDIENCE_OPTIONS.find(item => item.value === form.audienceType)?.label || 'Все клиенты';

  return (
    <Card
      className="tpCard"
      sx={{
        height: '100%',
        borderRadius: 3,
        border: '1px solid rgba(100,116,139,0.28)',
        bgcolor: 'rgba(2,6,23,0.72)',
        color: TP_TEXT_PRIMARY,
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack spacing={2.4}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Eye size={16} color="#67e8f9" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY }}>
                Предпросмотр кампании
              </Typography>
            </Stack>
            <Badge badgeContent={form.message.length} color="info">
              <Chip size="small" label="Символы" />
            </Badge>
          </Stack>

          <Stack direction="row" flexWrap="wrap" gap={1}>
            {form.channels.length ? (
              form.channels.map(channel => (
                <Tooltip
                  key={channel}
                  title={`Клиентов в канале: ${channelEligibleCounts[channel] || 0}`}
                >
                  <Chip
                    size="small"
                    label={CHANNEL_OPTIONS.find(item => item.value === channel)?.short || channel}
                    sx={{
                      bgcolor: 'rgba(14,165,233,0.16)',
                      border: '1px solid rgba(56,189,248,0.45)',
                      color: TP_TEXT_PRIMARY,
                    }}
                  />
                </Tooltip>
              ))
            ) : (
              <Chip size="small" label="Выберите каналы" />
            )}
          </Stack>

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY }}>
              Аудитория
            </Typography>
            <Typography variant="body2" sx={{ color: TP_TEXT_SECONDARY }}>
              {audienceLabel}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Users size={15} color="#67e8f9" />
              <Typography variant="body2" sx={{ color: TP_TEXT_PRIMARY, fontWeight: 600 }}>
                Потенциальные получатели: {estimatedAudience}
              </Typography>
            </Stack>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY }}>
              Заголовок
            </Typography>
            <Typography variant="h6" sx={{ color: TP_TEXT_PRIMARY, fontWeight: 700 }}>
              {form.title.trim() || 'Заголовок рассылки'}
            </Typography>
          </Stack>

          <Stack spacing={1.2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY }}>
              Сообщение
            </Typography>
            <Card
              variant="outlined"
              sx={{
                borderColor: 'rgba(71,85,105,0.65)',
                bgcolor: 'rgba(15,23,42,0.48)',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ py: 1.8, '&:last-child': { pb: 1.8 } }}>
                <Typography
                  variant="body2"
                  sx={{
                    color: TP_TEXT_PRIMARY,
                    whiteSpace: 'pre-wrap',
                    minHeight: 96,
                  }}
                >
                  {form.message.trim() || 'Текст сообщения появится здесь.'}
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          {form.buttonText.trim() && form.buttonUrl.trim() ? (
            <Stack spacing={0.6}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY }}>
                Кнопка
              </Typography>
              <Chip
                label={form.buttonText.trim()}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: 'rgba(56,189,248,0.2)',
                  border: '1px solid rgba(56,189,248,0.42)',
                  color: TP_TEXT_PRIMARY,
                  fontWeight: 600,
                }}
              />
              <Typography variant="caption" sx={{ color: TP_TEXT_SECONDARY }}>
                {form.buttonUrl.trim()}
              </Typography>
            </Stack>
          ) : null}

          {form.files.length ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: TP_TEXT_PRIMARY }}>
                Вложения ({form.files.length})
              </Typography>
              <Stack spacing={0.8}>
                {form.files.map((file, idx) => (
                  <Stack key={`${file.name}-${idx}`} direction="row" spacing={1} alignItems="center">
                    <Paperclip size={14} color="#94a3b8" />
                    <Typography variant="body2" sx={{ color: TP_TEXT_SECONDARY }}>
                      {file.name}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
