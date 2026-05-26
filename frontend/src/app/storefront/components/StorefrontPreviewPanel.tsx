'use client';

import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { StorefrontPreviewCard } from './StorefrontPreviewCard';

type PreviewPayload = {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  price?: string | null;
  oldPrice?: string | null;
  isPromo?: boolean;
  promoEndsIn?: string | null;
  image?: string | null;
};

type StorefrontPreviewPanelProps = {
  preview: PreviewPayload;
  selectedProductName?: string | null;
  selectedCategoryLabel?: string | null;
  mode: 'create' | 'edit';
  blockId?: number | null;
  hasUnsavedChanges: boolean;
};

export function StorefrontPreviewPanel({
  preview,
  selectedProductName,
  selectedCategoryLabel,
  mode,
  blockId,
  hasUnsavedChanges,
}: StorefrontPreviewPanelProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: 'rgba(15, 23, 42, 0.58)',
        borderColor: 'rgba(148, 163, 184, 0.24)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Живое превью
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.88)', mt: 0.5 }}>
            Так карточка будет выглядеть на сайте после сохранения.
          </Typography>
        </Box>

        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            size="small"
            label={mode === 'create' ? 'Новый блок' : `Редактирование #${blockId || '—'}`}
            sx={{
              bgcolor: 'rgba(15, 118, 110, 0.3)',
              color: '#99f6e4',
              border: '1px solid rgba(45, 212, 191, 0.35)',
            }}
          />
          <Chip
            size="small"
            label={hasUnsavedChanges ? 'Есть несохраненные изменения' : 'Синхронизировано'}
            sx={{
              bgcolor: hasUnsavedChanges ? 'rgba(249, 115, 22, 0.2)' : 'rgba(51, 65, 85, 0.72)',
              color: hasUnsavedChanges ? '#fed7aa' : '#cbd5e1',
              border: hasUnsavedChanges
                ? '1px solid rgba(249, 115, 22, 0.35)'
                : '1px solid rgba(148, 163, 184, 0.22)',
            }}
          />
        </Stack>

        <StorefrontPreviewCard
          title={preview.title}
          subtitle={preview.subtitle}
          badge={preview.badge}
          price={preview.price}
          oldPrice={preview.oldPrice}
          isPromo={preview.isPromo}
          promoEndsIn={preview.promoEndsIn}
          image={preview.image}
        />

        <Alert
          severity="info"
          sx={{
            bgcolor: 'rgba(2, 132, 199, 0.14)',
            color: '#bae6fd',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            '& .MuiAlert-icon': { color: '#7dd3fc' },
          }}
        >
          Акции настраиваются отдельным типом «Акционный блок»: выберите товар, задайте новую
          цену и период действия.
        </Alert>

        {selectedProductName ? (
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(34, 211, 238, 0.25)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#99f6e4', display: 'block' }}>
              Текущий товар
            </Typography>
            <Typography variant="body2" sx={{ color: '#ecfeff', fontWeight: 600 }}>
              {selectedProductName}
            </Typography>
            {selectedCategoryLabel ? (
              <Typography variant="caption" sx={{ color: '#a5f3fc' }}>
                {selectedCategoryLabel}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}
