import { useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Megaphone, Paperclip, Send, Trash2, Users } from 'lucide-react';
import { ActiveChannel, AUDIENCE_OPTIONS, CampaignFormState, CHANNEL_OPTIONS } from '../types';

const TP_TEXT_PRIMARY = '#e2e8f0';
const TP_TEXT_SECONDARY = '#94a3b8';

type Props = {
  form: CampaignFormState;
  setForm: (updater: (prev: CampaignFormState) => CampaignFormState) => void;
  estimatedAudience: number;
  channelEligibleCounts: Record<ActiveChannel, number>;
  submitting: boolean;
  submitProgress: number;
  onCreateDraft: () => void;
  onCreateAndSend: () => void;
};

const steps = ['Аудитория', 'Каналы', 'Сообщение'];

function channelTheme(channel: ActiveChannel) {
  if (channel === 'TELEGRAM') {
    return {
      bg: 'rgba(14,165,233,0.16)',
      border: 'rgba(56,189,248,0.5)',
      text: '#7dd3fc',
    };
  }
  if (channel === 'VK') {
    return {
      bg: 'rgba(37,99,235,0.16)',
      border: 'rgba(96,165,250,0.45)',
      text: '#93c5fd',
    };
  }
  return {
    bg: 'rgba(37,99,235,0.16)',
    border: 'rgba(96,165,250,0.45)',
    text: '#93c5fd',
  };
}

export function CampaignForm({
  form,
  setForm,
  estimatedAudience,
  channelEligibleCounts,
  submitting,
  submitProgress,
  onCreateDraft,
  onCreateAndSend,
}: Props) {
  const cardSx = {
    borderRadius: 3,
    border: '1px solid rgba(148,163,184,0.22)',
    bgcolor: 'rgba(15,23,42,0.58)',
    color: TP_TEXT_PRIMARY,
  } as const;

  const panelSx = {
    border: '1px solid rgba(148,163,184,0.18)',
    borderRadius: 2.5,
    bgcolor: 'rgba(15,23,42,0.38)',
    color: TP_TEXT_PRIMARY,
    p: 2.5,
  } as const;

  const inputSx = {
    '& .MuiInputBase-root': {
      borderRadius: 2,
      color: TP_TEXT_PRIMARY,
      backgroundColor: 'rgba(15,23,42,0.42)',
    },
    '& .MuiInputBase-input': {
      color: TP_TEXT_PRIMARY,
      WebkitTextFillColor: TP_TEXT_PRIMARY,
    },
    '& .MuiInputLabel-root': {
      color: TP_TEXT_SECONDARY,
    },
    '& .MuiFormHelperText-root': {
      color: TP_TEXT_SECONDARY,
    },
    '& .MuiSelect-select': {
      color: TP_TEXT_PRIMARY,
      WebkitTextFillColor: TP_TEXT_PRIMARY,
    },
  } as const;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const completedSteps = useMemo(() => {
    const audienceReady =
      form.audienceType !== 'REGISTERED_RANGE' ||
      Boolean(form.registeredFrom || form.registeredTo);
    const channelsReady = form.channels.length > 0;
    const messageReady =
      Boolean(form.title.trim()) &&
      Boolean(form.message.trim() || form.files.length > 0);
    return [audienceReady, channelsReady, messageReady];
  }, [
    form.audienceType,
    form.channels.length,
    form.files.length,
    form.message,
    form.registeredFrom,
    form.registeredTo,
    form.title,
  ]);

  const activeStep = useMemo(() => {
    const idx = completedSteps.findIndex(step => !step);
    return idx === -1 ? 2 : idx;
  }, [completedSteps]);
  const isStepCompleted = (i: number) => Boolean(completedSteps[i]) && i < activeStep;
  const isStepActive = (i: number) => i === activeStep;

  const channelSelected = (channel: ActiveChannel) =>
    form.channels.includes(channel);

  const toggleChannel = (channel: ActiveChannel) => {
    setForm(prev => {
      const exists = prev.channels.includes(channel);
      const next = exists
        ? prev.channels.filter(item => item !== channel)
        : [...prev.channels, channel];

      return {
        ...prev,
        channels: next.length ? next : prev.channels,
      };
    });
  };

  const attachFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, 6);
    setForm(prev => ({
      ...prev,
      files: [...prev.files, ...picked].slice(0, 6),
    }));
  };

  const removeFile = (index: number) => {
    setForm(prev => ({
      ...prev,
      files: prev.files.filter((_, idx) => idx !== index),
    }));
  };

  return (
    <Card className="tpCard" sx={cardSx}>
      <CardHeader
        title="Создание рассылки"
        subheader="Соберите кампанию по шагам: аудитория, каналы и контент"
        titleTypographyProps={{ variant: 'h6', fontWeight: 800, color: TP_TEXT_PRIMARY }}
        subheaderTypographyProps={{ sx: { color: TP_TEXT_SECONDARY } }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={3}>
          <Stepper
            activeStep={activeStep}
            sx={{
              '& .MuiStepLabel-label': {
                color: TP_TEXT_SECONDARY,
                fontSize: 13,
                '&.Mui-active': {
                  color: TP_TEXT_PRIMARY,
                  fontWeight: 800,
                },
                '&.Mui-completed': {
                  color: TP_TEXT_PRIMARY,
                  fontWeight: 700,
                },
              },
              '& .MuiStepIcon-root': {
                color: 'rgba(148,163,184,0.28)',
                '&.Mui-active': { color: 'info.main' },
                '&.Mui-completed': { color: 'success.main' },
              },
              '& .MuiStepConnector-line': {
                borderColor: 'rgba(148,163,184,0.22)',
              },
            }}
          >
            {steps.map((label, index) => (
              <Step key={label} completed={isStepCompleted(index)} active={isStepActive(index)}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box sx={panelSx}>
            <Stack spacing={2.5}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: TP_TEXT_PRIMARY }}>
                  1. Аудитория
                </Typography>
                <Typography variant="body2" sx={{ color: TP_TEXT_SECONDARY }}>
                  Выберите сегмент клиентов для отправки кампании.
                </Typography>
              </Stack>

              <Grid container spacing={2}>
                <Grid size={12}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Фильтр аудитории"
                    value={form.audienceType}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        audienceType: event.target.value as CampaignFormState['audienceType'],
                      }))
                    }
                    helperText="Рассылка отправляется только клиентам с согласием на маркетинг."
                    sx={inputSx}
                  >
                    {AUDIENCE_OPTIONS.map(item => (
                      <MenuItem key={item.value} value={item.value}>
                        {item.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {form.audienceType === 'REGISTERED_RANGE' ? (
                  <>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Дата регистрации от"
                        InputLabelProps={{ shrink: true }}
                        value={form.registeredFrom}
                        onChange={event =>
                          setForm(prev => ({ ...prev, registeredFrom: event.target.value }))
                        }
                        helperText="Начальная граница диапазона"
                        sx={inputSx}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Дата регистрации до"
                        InputLabelProps={{ shrink: true }}
                        value={form.registeredTo}
                        onChange={event =>
                          setForm(prev => ({ ...prev, registeredTo: event.target.value }))
                        }
                        helperText="Конечная граница диапазона"
                        sx={inputSx}
                      />
                    </Grid>
                  </>
                ) : null}
              </Grid>

              <Stack direction="row" spacing={1} alignItems="center">
                <Users size={16} color="#67e8f9" />
                <Typography variant="body2" sx={{ color: TP_TEXT_PRIMARY, fontWeight: 600 }}>
                  Прогноз аудитории: {estimatedAudience}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <Box sx={panelSx}>
            <Stack spacing={2.5}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: TP_TEXT_PRIMARY }}>
                  2. Каналы
                </Typography>
                <Typography variant="body2" sx={{ color: TP_TEXT_SECONDARY }}>
                  Доступны только каналы, где у клиента есть привязанный профиль.
                </Typography>
              </Stack>

              <Grid container spacing={1.6}>
                {CHANNEL_OPTIONS.map(channel => {
                  const selected = channelSelected(channel.value);
                  const eligible = channelEligibleCounts[channel.value];
                  const disabled = eligible <= 0;
                  const theme = channelTheme(channel.value);

                  return (
                    <Grid key={channel.value} size={{ xs: 12, md: 4 }}>
                      <Tooltip
                        title={
                          disabled
                            ? 'Нет клиентов с этим каналом'
                            : `Доступно клиентов: ${eligible}`
                        }
                      >
                        <span>
                          <Card
                            onClick={() => !disabled && toggleChannel(channel.value)}
                            sx={{
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              borderRadius: 2.2,
                              border: `1px solid ${
                                selected ? theme.border : 'rgba(100,116,139,0.38)'
                              }`,
                              bgcolor: selected
                                ? theme.bg
                                : disabled
                                  ? 'rgba(15,23,42,0.3)'
                                  : 'rgba(15,23,42,0.35)',
                              transition: 'all .16s ease',
                              '&:hover': disabled
                                ? undefined
                                : {
                                    borderColor: theme.border,
                                    transform: 'translateY(-1px)',
                                  },
                            }}
                          >
                            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                              >
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip
                                    size="small"
                                    label={channel.short}
                                    sx={{
                                      bgcolor: selected ? theme.bg : 'rgba(30,41,59,0.8)',
                                      color: selected ? theme.text : '#cbd5e1',
                                      border: `1px solid ${
                                        selected ? theme.border : 'rgba(100,116,139,0.4)'
                                      }`,
                                      fontWeight: 700,
                                    }}
                                  />
                                  <Typography
                                    variant="body2"
                                    sx={{ color: TP_TEXT_PRIMARY, fontWeight: 600 }}
                                  >
                                    {channel.label}
                                  </Typography>
                                </Stack>
                                <Typography variant="caption" sx={{ color: TP_TEXT_SECONDARY }}>
                                  {eligible}
                                </Typography>
                              </Stack>
                            </CardContent>
                          </Card>
                        </span>
                      </Tooltip>
                    </Grid>
                  );
                })}
              </Grid>
            </Stack>
          </Box>

          <Box sx={panelSx}>
            <Stack spacing={2.5}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: TP_TEXT_PRIMARY }}>
                  3. Сообщение
                </Typography>
                <Typography variant="body2" sx={{ color: TP_TEXT_SECONDARY }}>
                  Текст и вложения будут отправлены в каждый выбранный канал.
                </Typography>
              </Stack>

              <TextField
                fullWidth
                size="small"
                label="Заголовок"
                placeholder="Например: TechnoPrime — новое предложение"
                value={form.title}
                onChange={event =>
                  setForm(prev => ({ ...prev, title: event.target.value }))
                }
                helperText="Используется в истории кампаний и предпросмотре"
                sx={inputSx}
              />

              <TextField
                fullWidth
                multiline
                minRows={5}
                label="Текст сообщения"
                placeholder="Введите текст рассылки"
                value={form.message}
                onChange={event =>
                  setForm(prev => ({ ...prev, message: event.target.value }))
                }
                helperText={`Символов: ${form.message.length} • Можно отправить только файл без текста`}
                sx={inputSx}
              />

              <Grid container spacing={1.6}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Текст кнопки (опционально)"
                    placeholder="Получить скидку"
                    value={form.buttonText}
                    onChange={event =>
                      setForm(prev => ({ ...prev, buttonText: event.target.value }))
                    }
                    helperText="Например: Подробнее, Перейти, Получить скидку"
                    sx={inputSx}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Ссылка кнопки (опционально)"
                    placeholder="https://technoprimestore.ru/promo/..."
                    value={form.buttonUrl}
                    onChange={event =>
                      setForm(prev => ({ ...prev, buttonUrl: event.target.value }))
                    }
                    helperText="Если указан текст кнопки, ссылка обязательна (https://)"
                    sx={inputSx}
                  />
                </Grid>
              </Grid>

              <Stack spacing={1.4}>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={event => {
                      attachFiles(event.currentTarget.files);
                      event.currentTarget.value = '';
                    }}
                  />
              <Button
                size="small"
                variant="outlined"
                startIcon={<Paperclip size={14} />}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  color: TP_TEXT_PRIMARY,
                  borderColor: 'rgba(148,163,184,0.35)',
                }}
              >
                Прикрепить медиа/файлы
              </Button>
                  <Typography variant="caption" sx={{ color: TP_TEXT_SECONDARY }}>
                    До 6 файлов, до 10 МБ каждый
                  </Typography>
                </Stack>

                {form.files.length ? (
                  <Stack spacing={1}>
                    {form.files.map((file, index) => (
                      <Stack
                        key={`${file.name}-${index}`}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          px: 1.2,
                          py: 0.7,
                          borderRadius: 1.7,
                          border: '1px solid rgba(71,85,105,0.55)',
                          bgcolor: 'rgba(15,23,42,0.45)',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: TP_TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {file.name}
                        </Typography>
                        <IconButton size="small" onClick={() => removeFile(index)} sx={{ color: TP_TEXT_PRIMARY }}>
                          <Trash2 size={14} />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            </Stack>
          </Box>

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.22)' }} />

          {submitting ? (
            <LinearProgress
              variant="determinate"
              value={submitProgress}
              sx={{ borderRadius: 999, height: 8 }}
            />
          ) : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Megaphone size={16} />}
              onClick={onCreateDraft}
              disabled={submitting}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                minHeight: 42,
              }}
            >
              {submitting ? 'Сохранение...' : 'Сохранить как черновик'}
            </Button>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Send size={16} />}
              onClick={onCreateAndSend}
              disabled={submitting}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                minHeight: 42,
                bgcolor: 'primary.main',
                color: 'common.white',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              {submitting ? 'Отправка...' : 'Создать и отправить'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
