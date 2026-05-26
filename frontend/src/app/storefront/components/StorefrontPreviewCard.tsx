'use client';

import { Box, Card, CardContent, Chip, Typography } from '@mui/material';

type StorefrontPreviewCardProps = {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  price?: string | null;
  oldPrice?: string | null;
  isPromo?: boolean;
  promoEndsIn?: string | null;
  image?: string | null;
};

export function StorefrontPreviewCard({
  title,
  subtitle,
  badge,
  price,
  oldPrice,
  isPromo = false,
  promoEndsIn,
  image,
}: StorefrontPreviewCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: 'rgba(148, 163, 184, 0.24)',
        bgcolor: 'rgba(15, 23, 42, 0.72)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: 176,
          bgcolor: 'rgba(2, 6, 23, 0.7)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 1.5,
        }}
      >
        {image ? (
          <Box
            component="img"
            src={image}
            alt={title}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              borderRadius: 2,
              bgcolor: 'rgba(15, 23, 42, 0.45)',
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              borderRadius: 2,
              border: '1px dashed rgba(148, 163, 184, 0.35)',
              bgcolor: 'rgba(15, 23, 42, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.85)' }}>
              Превью без фото
            </Typography>
          </Box>
        )}
      </Box>

      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.25 }}>
          <Typography
            variant="subtitle1"
            sx={{
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {title || 'Новая карточка'}
          </Typography>
          {badge ? (
            <Chip
              label={badge}
              size="small"
              sx={{
                bgcolor: 'rgba(34, 211, 238, 0.15)',
                color: '#a5f3fc',
                border: '1px solid rgba(34, 211, 238, 0.35)',
                fontWeight: 600,
              }}
            />
          ) : null}
        </Box>

        {subtitle ? (
          <Typography variant="body2" sx={{ color: 'rgba(226, 232, 240, 0.85)', mt: 0.75 }}>
            {subtitle}
          </Typography>
        ) : null}

        {isPromo && oldPrice ? (
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(148, 163, 184, 0.9)',
              mt: 1.15,
              textDecoration: 'line-through',
            }}
          >
            {oldPrice}
          </Typography>
        ) : null}

        {price ? (
          <Typography variant="h6" sx={{ color: '#67e8f9', fontWeight: 700, mt: isPromo ? 0.25 : 1.25 }}>
            {price}
          </Typography>
        ) : null}

        {isPromo && promoEndsIn ? (
          <Typography variant="caption" sx={{ color: '#a5f3fc', mt: 0.65, display: 'block' }}>
            До конца: {promoEndsIn}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}
