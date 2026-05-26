import { Card, CardContent, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { MarketingCampaign } from '../types';

const TP_TEXT_PRIMARY = '#e2e8f0';

type Props = {
  campaigns: MarketingCampaign[];
  loading?: boolean;
};

function StatCard({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string;
  accent: string;
  loading?: boolean;
}) {
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
        <Stack spacing={0.8}>
          <Typography
            variant="subtitle2"
            sx={{ color: TP_TEXT_PRIMARY, fontWeight: 700 }}
          >
            {label}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={120} height={36} />
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 800, color: accent }}>
              {value}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function CampaignStats({ campaigns, loading }: Props) {
  const total = campaigns.length;
  const sent = campaigns.filter(item => item.status === 'SENT').length;
  const delivered = campaigns.reduce((acc, item) => acc + (item.sentCount || 0), 0);
  const errors = campaigns.reduce((acc, item) => acc + (item.errorCount || 0), 0);
  const deliveryPercent = delivered + errors > 0 ? Math.round((delivered / (delivered + errors)) * 100) : 0;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <StatCard label="Всего кампаний" value={String(total)} accent={TP_TEXT_PRIMARY} loading={loading} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <StatCard label="Отправлено" value={String(sent)} accent="info.light" loading={loading} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <StatCard label="Доставлено %" value={`${deliveryPercent}%`} accent="success.light" loading={loading} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <StatCard label="Ошибки" value={String(errors)} accent="error.light" loading={loading} />
      </Grid>
    </Grid>
  );
}
