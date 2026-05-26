'use client';

import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

export type StorefrontEditorTab = 'CONTENT' | 'MEDIA' | 'STOCK';

type StorefrontEditorDrawerProps = {
  open: boolean;
  mode: 'create' | 'edit';
  blockId?: number | null;
  tab: StorefrontEditorTab;
  onTabChange: (tab: StorefrontEditorTab) => void;
  onClose: () => void;
  hasUnsavedChanges: boolean;
  content: React.ReactNode;
  media: React.ReactNode;
  stock: React.ReactNode;
};

const tabOrder: StorefrontEditorTab[] = ['CONTENT', 'MEDIA', 'STOCK'];

const tabLabel: Record<StorefrontEditorTab, string> = {
  CONTENT: 'Контент',
  MEDIA: 'Медиа',
  STOCK: 'Склад и варианты',
};

export function StorefrontEditorDrawer({
  open,
  mode,
  blockId,
  tab,
  onTabChange,
  onClose,
  hasUnsavedChanges,
  content,
  media,
  stock,
}: StorefrontEditorDrawerProps) {
  const renderCurrentTab = () => {
    if (tab === 'MEDIA') return media;
    if (tab === 'STOCK') return stock;
    return content;
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: 840 },
          maxWidth: '100vw',
          bgcolor: '#0b1223',
          color: '#f8fafc',
          borderLeft: '1px solid rgba(148, 163, 184, 0.25)',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            background:
              'linear-gradient(135deg, rgba(2, 132, 199, 0.18) 0%, rgba(15, 23, 42, 0.88) 55%)',
          }}
        >
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>
                {mode === 'create' ? 'Новый блок витрины' : `Редактор блока #${blockId || '—'}`}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(226, 232, 240, 0.88)', mt: 0.35 }}>
                Настройте контент, медиа и складские параметры в одном рабочем окне.
              </Typography>
            </Box>

            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Chip
                label={hasUnsavedChanges ? 'Несохраненные изменения' : 'Сохранено'}
                size="small"
                sx={{
                  bgcolor: hasUnsavedChanges ? 'rgba(249, 115, 22, 0.2)' : 'rgba(15, 118, 110, 0.25)',
                  color: hasUnsavedChanges ? '#ffedd5' : '#99f6e4',
                  border: hasUnsavedChanges
                    ? '1px solid rgba(249, 115, 22, 0.35)'
                    : '1px solid rgba(45, 212, 191, 0.3)',
                  fontWeight: 600,
                }}
              />
              <Tooltip title="Закрыть редактор">
                <IconButton onClick={onClose} sx={{ color: '#e2e8f0' }}>
                  <CloseRoundedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ px: 2.5, pt: 1.5, borderBottom: '1px solid rgba(148, 163, 184, 0.18)' }}>
          <Tabs
            value={tabOrder.indexOf(tab)}
            onChange={(_, index: number) => onTabChange(tabOrder[index] || 'CONTENT')}
            variant="scrollable"
            scrollButtons="auto"
            textColor="inherit"
            sx={{
              minHeight: 44,
              '& .MuiTabs-indicator': { backgroundColor: '#22d3ee', height: 3, borderRadius: 2 },
              '& .MuiTab-root': {
                color: 'rgba(203, 213, 225, 0.9)',
                textTransform: 'none',
                minHeight: 44,
                fontWeight: 600,
              },
              '& .Mui-selected': {
                color: '#ecfeff !important',
              },
            }}
          >
            {tabOrder.map((tabValue) => (
              <Tab key={tabValue} label={tabLabel[tabValue]} />
            ))}
          </Tabs>
        </Box>

        <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.18)' }} />

        <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2.5 }}>{renderCurrentTab()}</Box>
      </Box>
    </Drawer>
  );
}
