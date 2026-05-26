'use client';

import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

type ProductSnapshot = {
  id: number;
  name: string;
  price: number | string;
  previewImage?: string | null;
  coverImage?: string | null;
  storefrontCategory?: string | null;
  brand?: string | null;
  model?: string | null;
};

type KitSnapshot = {
  id: number;
  name: string;
  tier?: string | null;
};

type BlockItem = {
  id: number;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  priceOverride?: string | null;
  promoBlock?: boolean;
  promoEnabled?: boolean;
  promoPrice?: string | null;
  promoOldPrice?: string | null;
  promoVariantKey?: string | null;
  promoVariantLabel?: string | null;
  promoEndsAt?: string | null;
  promoRemainingSec?: number;
  isPromo?: boolean;
  position: number;
  isActive: boolean;
  product?: ProductSnapshot | null;
  productId?: number | null;
  kit?: KitSnapshot | null;
  kitId?: number | null;
};

type BlockFilter = 'ALL' | 'ACTIVE' | 'PROMOTIONS';
type BlockSort = 'POSITION_ASC' | 'POSITION_DESC' | 'TITLE_ASC' | 'TITLE_DESC';

type StorefrontBlocksListProps = {
  loading: boolean;
  items: BlockItem[];
  blockSearch: string;
  onBlockSearchChange: (value: string) => void;
  blockCategoryFilter: string;
  onBlockCategoryFilterChange: (value: string) => void;
  blockCategoryOptions: string[];
  blockSort: BlockSort;
  onBlockSortChange: (value: BlockSort) => void;
  filter: BlockFilter;
  onFilterChange: (value: BlockFilter) => void;
  storefrontCategoryLabel: Record<string, string>;
  onOpenCreate: () => void;
  onRefresh: () => void;
  onAutoBind: () => void;
  onEdit: (item: BlockItem) => void;
  onToggleActive: (item: BlockItem) => void;
  onDelete: (item: BlockItem) => void;
  resolveMediaUrl: (url?: string | null) => string | null;
};

const cardTone = {
  borderColor: 'rgba(148, 163, 184, 0.24)',
  bgcolor: 'rgba(15, 23, 42, 0.6)',
};

const actionButtonSx = {
  height: 40,
  minHeight: 40,
  borderRadius: 2,
  textTransform: 'none',
  px: 1.5,
};

export function StorefrontBlocksList({
  loading,
  items,
  blockSearch,
  onBlockSearchChange,
  blockCategoryFilter,
  onBlockCategoryFilterChange,
  blockCategoryOptions,
  blockSort,
  onBlockSortChange,
  filter,
  onFilterChange,
  storefrontCategoryLabel,
  onOpenCreate,
  onRefresh,
  onAutoBind,
  onEdit,
  onToggleActive,
  onDelete,
  resolveMediaUrl,
}: StorefrontBlocksListProps) {
  return (
    <Card variant="outlined" sx={{ ...cardTone, borderRadius: 3, overflow: 'hidden' }}>
      <CardContent sx={{ p: 2.5, pb: 2 }}>
        <Stack spacing={2.25}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            gap={1.5}
          >
            <Box>
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                Блоки витрины
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              sx={{ rowGap: 1 }}
            >
              <Button
                variant="contained"
                onClick={onOpenCreate}
                sx={{
                  bgcolor: '#0284c7',
                  '&:hover': { bgcolor: '#0369a1' },
                  ...actionButtonSx,
                }}
              >
                + Добавить блок
              </Button>
              <Button
                startIcon={<AutoFixHighRoundedIcon />}
                variant="outlined"
                onClick={onAutoBind}
                sx={{
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  color: '#bae6fd',
                  ...actionButtonSx,
                }}
              >
                Автопривязка
              </Button>
              <Tooltip title="Обновить">
                <Button
                  aria-label="Обновить"
                  variant="outlined"
                  onClick={onRefresh}
                  sx={{
                    minWidth: 40,
                    borderColor: 'rgba(148, 163, 184, 0.35)',
                    color: '#e2e8f0',
                    ...actionButtonSx,
                  }}
                >
                  <RefreshRoundedIcon fontSize="small" />
                </Button>
              </Tooltip>
            </Stack>
          </Stack>

          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
              <TextField
                fullWidth
                size="small"
                label="Поиск"
                value={blockSearch}
                onChange={(event) => onBlockSearchChange(event.target.value)}
                placeholder="ID, заголовок, товар, бренд"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    bgcolor: 'rgba(2, 6, 23, 0.45)',
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(148, 163, 184, 0.9)' },
                }}
              />
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: '100%', md: 230 },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    bgcolor: 'rgba(2, 6, 23, 0.45)',
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(148, 163, 184, 0.9)' },
                }}
              >
                <InputLabel id="storefront-category-filter-label">Категория</InputLabel>
                <Select
                  labelId="storefront-category-filter-label"
                  label="Категория"
                  value={blockCategoryFilter}
                  onChange={(event) => onBlockCategoryFilterChange(String(event.target.value))}
                >
                  <MenuItem value="ALL">Все категории</MenuItem>
                  {blockCategoryOptions.map((category) => (
                    <MenuItem key={category} value={category}>
                      {storefrontCategoryLabel[category] || category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: '100%', md: 280 },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    bgcolor: 'rgba(2, 6, 23, 0.45)',
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(148, 163, 184, 0.9)' },
                }}
              >
                <InputLabel id="storefront-sort-label">Сортировка</InputLabel>
                <Select
                  labelId="storefront-sort-label"
                  label="Сортировка"
                  value={blockSort}
                  onChange={(event) => onBlockSortChange(event.target.value as BlockSort)}
                >
                  <MenuItem value="POSITION_ASC">Позиция: по возрастанию</MenuItem>
                  <MenuItem value="POSITION_DESC">Позиция: по убыванию</MenuItem>
                  <MenuItem value="TITLE_ASC">Заголовок: А-Я</MenuItem>
                  <MenuItem value="TITLE_DESC">Заголовок: Я-А</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <ButtonGroup variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
              <Button
                onClick={() => onFilterChange('ALL')}
                variant={filter === 'ALL' ? 'contained' : 'outlined'}
                sx={{ textTransform: 'none' }}
              >
                Все
              </Button>
              <Button
                onClick={() => onFilterChange('ACTIVE')}
                variant={filter === 'ACTIVE' ? 'contained' : 'outlined'}
                sx={{ textTransform: 'none' }}
              >
                Активные
              </Button>
              <Button
                onClick={() => onFilterChange('PROMOTIONS')}
                variant={filter === 'PROMOTIONS' ? 'contained' : 'outlined'}
                sx={{ textTransform: 'none' }}
              >
                Акции
              </Button>
            </ButtonGroup>
          </Stack>

          <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.2)' }} />

          {loading ? (
            <Stack spacing={1.5}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Card
                  key={index}
                  variant="outlined"
                  sx={{ borderRadius: 2.5, borderColor: 'rgba(148, 163, 184, 0.2)', bgcolor: 'rgba(2, 6, 23, 0.35)' }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Skeleton variant="rounded" width={92} height={92} />
                      <Box sx={{ width: '100%' }}>
                        <Skeleton variant="text" width="45%" height={32} />
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="65%" />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : items.length === 0 ? (
            <Box
              sx={{
                borderRadius: 2.5,
                border: '1px dashed rgba(148, 163, 184, 0.35)',
                p: 3,
                textAlign: 'center',
                bgcolor: 'rgba(2, 6, 23, 0.35)',
              }}
            >
              <Typography variant="body1" sx={{ color: 'rgba(203, 213, 225, 0.92)' }}>
                {filter === 'PROMOTIONS'
                  ? 'Акции не найдены. Нажмите «+ Добавить блок», выберите тип «Акционный блок» и привяжите товар.'
                  : 'Блоки не найдены. Попробуйте изменить фильтры или создайте новый блок.'}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {items.map((item) => {
                const image = resolveMediaUrl(item.product?.previewImage || item.product?.coverImage || null);
                const isPromotion = Boolean(item.promoBlock || item.isPromo);
                const blockType = item.kitId ? 'Комплект' : isPromotion ? 'Акционный блок' : 'Товар';
                const category = String(item.product?.storefrontCategory || '').trim();

                return (
                  <Card
                    key={item.id}
                    variant="outlined"
                    sx={{
                      borderRadius: 2.5,
                      borderColor: 'rgba(148, 163, 184, 0.2)',
                      bgcolor: 'rgba(2, 6, 23, 0.36)',
                    }}
                  >
                    <CardContent sx={{ pb: 1.5 }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <Box
                          sx={{
                            width: { xs: '100%', md: 112 },
                            minWidth: { xs: '100%', md: 112 },
                            height: 112,
                            borderRadius: 2,
                            overflow: 'hidden',
                            bgcolor: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {image ? (
                            <Box
                              component="img"
                              src={image}
                              alt={item.title}
                              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.88)' }}>
                              Без фото
                            </Typography>
                          )}
                        </Box>

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                              justifyContent="space-between"
                              gap={1}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  variant="subtitle1"
                                  sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.3 }}
                                >
                                  #{item.id} · {item.title || 'Без заголовка'}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ color: 'rgba(203, 213, 225, 0.82)' }}
                                  noWrap
                                >
                                  {item.subtitle || item.product?.name || item.kit?.name || 'Описание не заполнено'}
                                </Typography>
                              </Box>

                              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                <Chip
                                  size="small"
                                  label={blockType}
                                  sx={{
                                    bgcolor: 'rgba(30, 64, 175, 0.25)',
                                    color: '#bfdbfe',
                                    border: '1px solid rgba(59, 130, 246, 0.35)',
                                  }}
                                />
                                <Chip
                                  size="small"
                                  label={item.isActive ? 'Активен' : 'Скрыт'}
                                  sx={{
                                    bgcolor: item.isActive
                                      ? 'rgba(6, 182, 212, 0.16)'
                                      : 'rgba(71, 85, 105, 0.5)',
                                    color: item.isActive ? '#a5f3fc' : '#cbd5e1',
                                    border: item.isActive
                                      ? '1px solid rgba(34, 211, 238, 0.35)'
                                      : '1px solid rgba(148, 163, 184, 0.3)',
                                  }}
                                />
                                {item.badge ? (
                                  <Chip
                                    size="small"
                                    label={item.badge}
                                    sx={{
                                      bgcolor: 'rgba(249, 115, 22, 0.2)',
                                      color: '#ffedd5',
                                      border: '1px solid rgba(249, 115, 22, 0.35)',
                                    }}
                                  />
                                ) : null}
                                <Chip
                                  size="small"
                                  label={`Позиция ${item.position}`}
                                  sx={{
                                    bgcolor: 'rgba(51, 65, 85, 0.7)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(148, 163, 184, 0.22)',
                                  }}
                                />
                              </Stack>
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {category ? (
                                <Chip
                                  size="small"
                                  label={storefrontCategoryLabel[category] || category}
                                  sx={{
                                    bgcolor: 'rgba(8, 47, 73, 0.6)',
                                    color: '#bae6fd',
                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                  }}
                                />
                              ) : null}
                              {item.product?.brand ? (
                                <Chip
                                  size="small"
                                  label={item.product.brand}
                                  sx={{
                                    bgcolor: 'rgba(15, 23, 42, 0.8)',
                                    color: '#e2e8f0',
                                    border: '1px solid rgba(148, 163, 184, 0.22)',
                                    }}
                                  />
                                ) : null}
                                {item.promoVariantLabel ? (
                                  <Chip
                                    size="small"
                                    label={item.promoVariantLabel}
                                    sx={{
                                      bgcolor: 'rgba(251, 146, 60, 0.12)',
                                      color: '#fdba74',
                                      border: '1px solid rgba(251, 146, 60, 0.28)',
                                    }}
                                  />
                                ) : null}
                              </Stack>
                            </Stack>
                        </Box>
                      </Stack>
                    </CardContent>

                    <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 0.75, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        startIcon={<EditRoundedIcon />}
                        variant="contained"
                        onClick={() => onEdit(item)}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        Редактировать
                      </Button>
                      <Tooltip title={item.isActive ? 'Скрыть на сайте' : 'Показать на сайте'}>
                        <Button
                          size="small"
                          startIcon={item.isActive ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                          variant="outlined"
                          onClick={() => onToggleActive(item)}
                          sx={{ textTransform: 'none', borderRadius: 2 }}
                        >
                          {item.isActive ? 'Скрыть' : 'Показать'}
                        </Button>
                      </Tooltip>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRoundedIcon />}
                        variant="outlined"
                        onClick={() => onDelete(item)}
                        sx={{ textTransform: 'none', borderRadius: 2 }}
                      >
                        Удалить
                      </Button>
                    </CardActions>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
