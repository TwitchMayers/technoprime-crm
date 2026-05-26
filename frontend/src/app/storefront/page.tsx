'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { toast } from 'sonner';
import { StorefrontBlocksList } from './components/StorefrontBlocksList';
import { StorefrontEditorDrawer, type StorefrontEditorTab } from './components/StorefrontEditorDrawer';
import { StorefrontPreviewCard } from './components/StorefrontPreviewCard';
import { StorefrontPreviewPanel } from './components/StorefrontPreviewPanel';

type ProductOption = {
  id: number;
  name: string;
  price: number | string;
  costPrice?: number | string;
  coverImage?: string | null;
  previewImage?: string | null;
  gallery?: string[] | string | null;
  stock?: number;
  inStock?: boolean | null;
  category?: string | null;
  condition?: 'NEW' | 'USED' | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  catalogMainKey?: string | null;
  catalogSubKey?: string | null;
  catalogFamilyKey?: string | null;
  variants?: ProductVariant[] | null;
  shortDescription?: string | null;
  description?: string | null;
  storefrontCategory?: string | null;
  isAlwaysAvailable?: boolean;
};

type ProductVariant = {
  key: string;
  label: string;
  memoryGb: number | null;
  price: number;
  costPrice: number | null;
  stock: number;
  inStock: boolean;
  isDefault: boolean;
};

type FeaturedItem = {
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
  product?: ProductOption | null;
  productId?: number | null;
  kit?: { id: number; name: string; tier?: string | null } | null;
  kitId?: number | null;
};

type StoreCategory = {
  value: string;
  label: string;
};

type BlockKind = 'PRODUCT' | 'PROMOTION' | 'KIT';

type FormState = {
  kind: BlockKind;
  title: string;
  subtitle: string;
  badge: string;
  priceOverride: string;
  promoEnabled: boolean;
  promoPrice: string;
  promoVariantKey: string;
  promoDays: string;
  promoHours: string;
  position: string;
  productId: string;
  kitId: string;
  isActive: boolean;
};

type ProductDraft = {
  name: string;
  category: string;
  condition: 'NEW' | 'USED';
  storefrontCategory: string;
  catalogMainKey: string;
  catalogSubKey: string;
  catalogFamilyKey: string;
  brand: string;
  model: string;
  version: string;
  shortDescription: string;
  description: string;
  price: number;
  costPrice: number;
  isAlwaysAvailable: boolean;
  variants: ProductVariant[];
};

type CatalogSeedProduct = {
  name: string;
  storefrontCategory: string;
  brand: string;
  model: string;
  version?: string;
  seedPrice: number;
};

const emptyForm: FormState = {
  kind: 'PRODUCT',
  title: '',
  subtitle: '',
  badge: '',
  priceOverride: '',
  promoEnabled: true,
  promoPrice: '',
  promoVariantKey: '',
  promoDays: '0',
  promoHours: '1',
  position: '0',
  productId: '',
  kitId: '',
  isActive: true,
};

const storefrontCategoryLabel: Record<string, string> = {
  HOME_CONSOLES: 'Игровые приставки',
  PORTABLE_CONSOLES: 'Портативные приставки',
  GAME_DISKS: 'Игровые диски',
  DIGITAL_SERVICES: 'Цифровые сервисы',
};

const defaultStoreCategories: StoreCategory[] = [
  { value: 'HOME_CONSOLES', label: 'Игровые приставки' },
  { value: 'PORTABLE_CONSOLES', label: 'Портативные приставки' },
  { value: 'GAME_DISKS', label: 'Игровые диски' },
  { value: 'DIGITAL_SERVICES', label: 'Цифровые сервисы' },
];

const requiredCatalogProducts: CatalogSeedProduct[] = [
  {
    name: 'PlayStation 4 FAT',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Sony',
    model: 'PlayStation 4 FAT',
    version: 'Standard',
    seedPrice: 24990,
  },
  {
    name: 'PlayStation 4 Slim',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Sony',
    model: 'PlayStation 4 Slim',
    version: 'Standard',
    seedPrice: 29990,
  },
  {
    name: 'PlayStation 4 Pro',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Sony',
    model: 'PlayStation 4 Pro',
    version: 'Standard',
    seedPrice: 34990,
  },
  {
    name: 'Sony PlayStation 5 FAT Digital',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Sony',
    model: 'Sony PlayStation 5 FAT',
    version: 'Digital Edition',
    seedPrice: 52990,
  },
  {
    name: 'Sony PlayStation 5 FAT Blu-Ray',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Sony',
    model: 'Sony PlayStation 5 FAT',
    version: 'Blu-Ray Edition',
    seedPrice: 55990,
  },
  {
    name: 'Sony PlayStation 5 Slim Digital',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Sony',
    model: 'Sony PlayStation 5 Slim',
    version: 'Digital Edition',
    seedPrice: 58990,
  },
  {
    name: 'Sony PlayStation 5 Slim Blu-Ray',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Sony',
    model: 'Sony PlayStation 5 Slim',
    version: 'Blu-Ray Edition',
    seedPrice: 61990,
  },
  {
    name: 'Xbox One S',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Microsoft',
    model: 'Xbox One S',
    version: 'Standard',
    seedPrice: 24990,
  },
  {
    name: 'Xbox One X',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Microsoft',
    model: 'Xbox One X',
    version: 'Standard',
    seedPrice: 31990,
  },
  {
    name: 'Xbox Series S',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Microsoft',
    model: 'Xbox Series S',
    version: 'Standard',
    seedPrice: 35990,
  },
  {
    name: 'Xbox Series X',
    storefrontCategory: 'HOME_CONSOLES',
    brand: 'Microsoft',
    model: 'Xbox Series X',
    version: 'Standard',
    seedPrice: 54990,
  },
  {
    name: 'PlayStation Portal',
    storefrontCategory: 'PORTABLE_CONSOLES',
    brand: 'Sony',
    model: 'PlayStation Portal',
    version: 'Standard',
    seedPrice: 26990,
  },
  {
    name: 'Steam Deck LCD',
    storefrontCategory: 'PORTABLE_CONSOLES',
    brand: 'Valve',
    model: 'Steam Deck LCD',
    version: '512GB / 1024GB',
    seedPrice: 49990,
  },
  {
    name: 'Steam Deck OLED',
    storefrontCategory: 'PORTABLE_CONSOLES',
    brand: 'Valve',
    model: 'Steam Deck OLED',
    version: '512GB / 1024GB',
    seedPrice: 59990,
  },
  {
    name: 'Nintendo Switch Lite',
    storefrontCategory: 'PORTABLE_CONSOLES',
    brand: 'Nintendo',
    model: 'Nintendo Switch Lite',
    version: 'Standard',
    seedPrice: 21990,
  },
  {
    name: 'Nintendo Switch 2',
    storefrontCategory: 'PORTABLE_CONSOLES',
    brand: 'Nintendo',
    model: 'Nintendo Switch 2',
    version: 'Standard',
    seedPrice: 42990,
  },
];

function isCatalogCard(item: ProductOption) {
  return Boolean(String(item.storefrontCategory || '').trim());
}

const modelPresetsByBrand: Record<string, string[]> = {
  Sony: [
    'PlayStation 4 FAT',
    'PlayStation 4 Slim',
    'PlayStation 4 Pro',
    'Sony PlayStation 5 FAT Digital',
    'Sony PlayStation 5 FAT Blu-Ray',
    'Sony PlayStation 5 Slim Digital',
    'Sony PlayStation 5 Slim Blu-Ray',
    'Sony PlayStation 5 FAT',
    'Sony PlayStation 5 Slim',
    'PlayStation Portal',
  ],
  Microsoft: ['Xbox One S', 'Xbox One X', 'Xbox Series S', 'Xbox Series X'],
  Valve: ['Steam Deck LCD', 'Steam Deck OLED'],
  Nintendo: ['Nintendo Switch Lite', 'Nintendo Switch 2'],
};

const versionPresetsByModel: Record<string, string[]> = {
  'PlayStation 4 FAT': ['Standard'],
  'PlayStation 4 Slim': ['Standard'],
  'PlayStation 4 Pro': ['Standard'],
  'Sony PlayStation 5 FAT Digital': [
    'Digital Edition',
  ],
  'Sony PlayStation 5 FAT Blu-Ray': [
    'Blu-Ray Edition',
  ],
  'Sony PlayStation 5 Slim Digital': [
    'Digital Edition',
  ],
  'Sony PlayStation 5 Slim Blu-Ray': [
    'Blu-Ray Edition',
  ],
  'Sony PlayStation 5 FAT': [
    'Digital Edition',
    'Blu-Ray Edition',
  ],
  'Sony PlayStation 5 Slim': [
    'Digital Edition',
    'Blu-Ray Edition',
  ],
  'Steam Deck LCD': ['512GB', '1024GB', '512GB / 1024GB'],
  'Steam Deck OLED': ['512GB', '1024GB', '512GB / 1024GB'],
  'PlayStation Portal': ['Standard'],
  'Nintendo Switch Lite': ['Standard'],
  'Nintendo Switch 2': ['Standard'],
  'Xbox One S': ['Standard'],
  'Xbox One X': ['Standard'],
  'Xbox Series S': ['Standard'],
  'Xbox Series X': ['Standard'],
};

const presetSubtitles: Record<string, string> = {
  'PlayStation 4 FAT': 'Стационарная консоль PlayStation',
  'PlayStation 4 Slim': 'Стационарная консоль PlayStation',
  'PlayStation 4 Pro': 'Стационарная консоль PlayStation',
  'Sony PlayStation 5 FAT Digital': 'Digital Edition',
  'Sony PlayStation 5 FAT Blu-Ray': 'Blu-Ray Edition',
  'Sony PlayStation 5 Slim Digital': 'Digital Edition',
  'Sony PlayStation 5 Slim Blu-Ray': 'Blu-Ray Edition',
  'Sony PlayStation 5 FAT': 'Digital / Blu-Ray Edition',
  'Sony PlayStation 5 Slim': 'Digital / Blu-Ray Edition',
  'Xbox One S': 'Стационарная консоль Xbox',
  'Xbox One X': 'Стационарная консоль Xbox',
  'Xbox Series S': 'Стационарная консоль Xbox',
  'Xbox Series X': 'Стационарная консоль Xbox',
  'PlayStation Portal': 'Портативная приставка',
  'Steam Deck LCD': '512GB / 1024GB',
  'Steam Deck OLED': '512GB / 1024GB',
  'Nintendo Switch Lite': 'Портативная приставка',
  'Nintendo Switch 2': 'Портативная приставка',
};

const seedSubtitle = (name: string) => {
  return presetSubtitles[name] || 'Карточка для витрины';
};

const catalogMainOptions = [
  { key: 'home-consoles', label: 'Игровые приставки' },
  { key: 'portable-consoles', label: 'Портативные приставки' },
  { key: 'game-disks', label: 'Игровые диски' },
  { key: 'digital-services', label: 'Цифровые сервисы' },
];

const catalogSubOptions: Record<string, Array<{ key: string; label: string }>> = {
  'home-consoles': [
    { key: 'playstation', label: 'PlayStation' },
    { key: 'xbox', label: 'Xbox' },
  ],
  'portable-consoles': [
    { key: 'portable-playstation', label: 'PlayStation' },
    { key: 'steam-deck', label: 'Steam Deck' },
    { key: 'nintendo-switch', label: 'Nintendo Switch' },
  ],
};

const catalogFamilyOptions: Record<string, Array<{ key: string; label: string }>> = {
  'home-consoles:playstation': [
    { key: 'ps4', label: 'PlayStation 4' },
    { key: 'ps5', label: 'PlayStation 5' },
  ],
  'home-consoles:xbox': [
    { key: 'xbox-one', label: 'Xbox One' },
    { key: 'xbox-series', label: 'Xbox Series' },
  ],
  'portable-consoles:portable-playstation': [
    { key: 'playstation-portal', label: 'PlayStation Portal' },
  ],
  'portable-consoles:steam-deck': [
    { key: 'steam-deck-lcd', label: 'Steam Deck LCD' },
    { key: 'steam-deck-oled', label: 'Steam Deck OLED' },
  ],
  'portable-consoles:nintendo-switch': [
    { key: 'switch-lite', label: 'Nintendo Switch Lite' },
    { key: 'switch-2', label: 'Nintendo Switch 2' },
  ],
};

function inferCatalogKeys(text: string) {
  const value = text.toLowerCase();
  if (value.includes('playstation portal')) {
    return {
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'portable-playstation',
      catalogFamilyKey: 'playstation-portal',
    };
  }
  if (value.includes('steam deck oled')) {
    return {
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'steam-deck',
      catalogFamilyKey: 'steam-deck-oled',
    };
  }
  if (value.includes('steam deck lcd')) {
    return {
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'steam-deck',
      catalogFamilyKey: 'steam-deck-lcd',
    };
  }
  if (value.includes('switch lite')) {
    return {
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'nintendo-switch',
      catalogFamilyKey: 'switch-lite',
    };
  }
  if (value.includes('switch 2')) {
    return {
      catalogMainKey: 'portable-consoles',
      catalogSubKey: 'nintendo-switch',
      catalogFamilyKey: 'switch-2',
    };
  }
  if (value.includes('playstation 5')) {
    return {
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps5',
    };
  }
  if (value.includes('playstation 4')) {
    return {
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'playstation',
      catalogFamilyKey: 'ps4',
    };
  }
  if (value.includes('xbox one')) {
    return {
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'xbox',
      catalogFamilyKey: 'xbox-one',
    };
  }
  if (value.includes('xbox series')) {
    return {
      catalogMainKey: 'home-consoles',
      catalogSubKey: 'xbox',
      catalogFamilyKey: 'xbox-series',
    };
  }
  return {
    catalogMainKey: 'home-consoles',
    catalogSubKey: '',
    catalogFamilyKey: '',
  };
}

function toVariantKey(memoryGb: number) {
  return `${Math.max(1, Math.round(memoryGb))}gb`;
}

function normalizeProductVariants(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: ProductVariant[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const key = String(row.key || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    if (!key || seen.has(key)) continue;
    const memoryGbRaw = Number(row.memoryGb ?? NaN);
    const memoryGb =
      Number.isFinite(memoryGbRaw) && memoryGbRaw > 0 ? Math.round(memoryGbRaw) : null;
    const price = Number(row.price ?? 0);
    if (!Number.isFinite(price) || price < 0) continue;
    const costPriceRaw = Number(row.costPrice ?? NaN);
    const costPrice =
      Number.isFinite(costPriceRaw) && costPriceRaw >= 0 ? costPriceRaw : null;
    const stock = Math.max(0, Math.floor(Number(row.stock ?? 0)));
    const inStock = row.inStock !== undefined ? Boolean(row.inStock) : stock > 0;
    const label = String(row.label || (memoryGb ? `${memoryGb} GB` : key)).trim() || key;
    const isDefault = Boolean(row.isDefault);

    seen.add(key);
    items.push({
      key,
      label,
      memoryGb,
      price,
      costPrice,
      stock,
      inStock,
      isDefault,
    });
  }

  if (items.length > 0 && !items.some((item) => item.isDefault)) {
    items[0].isDefault = true;
  }

  return items;
}

function shouldUseMemoryVariants(text: string) {
  const value = text.toLowerCase();
  return (
    value.includes('steam deck lcd') ||
    value.includes('steam deck oled') ||
    value.includes('playstation 4 fat') ||
    value.includes('playstation 4 slim') ||
    value.includes('playstation 4 pro') ||
    value.includes('xbox one s')
  );
}

function buildDefaultMemoryVariants(basePrice: number, baseCostPrice: number): ProductVariant[] {
  const firstPrice = Math.max(0, Math.round(basePrice || 0));
  const secondPrice = Math.max(firstPrice, Math.round(firstPrice + 3000));
  const firstCost = Math.max(0, Math.round(baseCostPrice || firstPrice * 0.75));
  const secondCost = Math.max(0, Math.round(firstCost + 2000));
  return [
    {
      key: toVariantKey(512),
      label: '512 GB',
      memoryGb: 512,
      price: firstPrice,
      costPrice: firstCost,
      stock: 0,
      inStock: false,
      isDefault: true,
    },
    {
      key: toVariantKey(1024),
      label: '1024 GB',
      memoryGb: 1024,
      price: secondPrice,
      costPrice: secondCost,
      stock: 0,
      inStock: false,
      isDefault: false,
    },
  ];
}

function parseId(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amount))} ₽`;
}

function formatFileSize(bytes: number) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPromoRemaining(seconds: number) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days <= 0 && hours <= 0) return 'меньше 1ч';
  if (days <= 0) return `${hours}ч`;
  return `${days}д ${hours}ч`;
}

function aliasTokensForText(text: string) {
  const value = text.toLowerCase();
  const aliases: string[] = [];
  if (value.includes('playstation 5')) aliases.push('ps5');
  if (value.includes('playstation 4')) aliases.push('ps4');
  if (value.includes('xbox one s')) aliases.push('xbox one s', 'xone s');
  if (value.includes('xbox one')) aliases.push('xbox one');
  if (value.includes('steam deck')) aliases.push('steamdeck', 'deck');
  return aliases;
}

function resolveMediaUrl(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return url;

  const envOrigin = String(process.env.NEXT_PUBLIC_BACKEND_ORIGIN || '').trim().replace(/\/+$/, '');
  const fallbackOrigin =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://127.0.0.1:3000';
  const origin = envOrigin || fallbackOrigin;

  return `${origin}/${url}`;
}

function normalizeGallery(
  value: ProductOption['gallery'],
  coverImage?: string | null,
): string[] {
  let list: string[] = [];
  if (Array.isArray(value)) {
    list = value.filter(
      (item): item is string => typeof item === 'string' && Boolean(item.trim()),
    );
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        list = parsed.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        );
      }
    } catch {
      list = value.trim() ? [value.trim()] : [];
    }
  }
  if (coverImage && !list.includes(coverImage)) {
    return [coverImage, ...list];
  }
  return list;
}

function toProductDraft(product: ProductOption): ProductDraft {
  const inferredKeys = inferCatalogKeys(
    [product.name, product.model, product.version].filter(Boolean).join(' '),
  );
  const normalizedVariants = normalizeProductVariants(product.variants);
  const variants =
    normalizedVariants.length > 0
      ? normalizedVariants
      : shouldUseMemoryVariants([product.name, product.model].filter(Boolean).join(' '))
        ? buildDefaultMemoryVariants(Number(product.price || 0), Number(product.costPrice || 0))
        : [];

  return {
    name: product.name || '',
    category: String(product.category || 'CONSOLE'),
    condition: product.condition === 'NEW' ? 'NEW' : 'USED',
    storefrontCategory: String(product.storefrontCategory || 'HOME_CONSOLES'),
    catalogMainKey: String(product.catalogMainKey || inferredKeys.catalogMainKey || ''),
    catalogSubKey: String(product.catalogSubKey || inferredKeys.catalogSubKey || ''),
    catalogFamilyKey: String(product.catalogFamilyKey || inferredKeys.catalogFamilyKey || ''),
    brand: String(product.brand || ''),
    model: String(product.model || ''),
    version: String(product.version || ''),
    shortDescription: String(product.shortDescription || ''),
    description: String(product.description || ''),
    price: Number(product.price || 0),
    costPrice: Number(product.costPrice || 0),
    isAlwaysAvailable: Boolean(product.isAlwaysAvailable),
    variants,
  };
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default function StorefrontPage() {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<ProductOption[]>([]);
  const [warehouseProductsLoaded, setWarehouseProductsLoaded] = useState(false);
  const [storeCategories, setStoreCategories] =
    useState<StoreCategory[]>(defaultStoreCategories);

  const [productSearch, setProductSearch] = useState('');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');

  const [loading, setLoading] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const seedingRef = useRef(false);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PROMOTIONS'>('ALL');
  const [blockCategoryFilter, setBlockCategoryFilter] = useState('ALL');
  const [blockSort, setBlockSort] = useState<
    'POSITION_ASC' | 'POSITION_DESC' | 'TITLE_ASC' | 'TITLE_DESC'
  >('POSITION_ASC');
  const [blockSearch, setBlockSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<StorefrontEditorTab>('CONTENT');
  const [editingFeaturedId, setEditingFeaturedId] = useState<number | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<FeaturedItem | null>(null);

  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [galleryDragSource, setGalleryDragSource] = useState<number | null>(null);
  const [galleryDragTarget, setGalleryDragTarget] = useState<number | null>(null);
  const [galleryReordering, setGalleryReordering] = useState(false);
  const [previewUploading, setPreviewUploading] = useState(false);
  const [warehouseSourceId, setWarehouseSourceId] = useState('');
  const [warehouseAttachQty, setWarehouseAttachQty] = useState('1');
  const [warehouseTargetVariantKey, setWarehouseTargetVariantKey] = useState('');
  const [attachingWarehouse, setAttachingWarehouse] = useState(false);
  const editorSnapshotRef = useRef<string>('');
  const snapshotPendingRef = useRef(false);
  const warehouseProductsLoadingRef = useRef(false);

  const debouncedProductSearch = useDebouncedValue(productSearch, 300);
  const debouncedBlockSearch = useDebouncedValue(blockSearch, 250);

  const loadFeatured = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/shop/admin/featured');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Не удалось загрузить карточки');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetchWithAuth('/api/products?isArchived=false&limit=5000&scope=storefront');
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const normalized = list
        .filter((row: any) => row?.id && row?.name)
        .map((row: any) => ({
          id: Number(row.id),
          name: String(row.name),
          price: row.price,
          costPrice: row.costPrice,
          coverImage: row.coverImage ?? null,
          previewImage: row.previewImage ?? null,
          gallery: row.gallery ?? null,
          stock: Number(row.stock ?? 0),
          inStock: row.inStock ?? null,
          category: row.category ?? null,
          condition: row.condition ?? 'USED',
          brand: row.brand ?? null,
          model: row.model ?? null,
          version: row.version ?? null,
          catalogMainKey: row.catalogMainKey ?? null,
          catalogSubKey: row.catalogSubKey ?? null,
          catalogFamilyKey: row.catalogFamilyKey ?? null,
          variants: normalizeProductVariants(row.variants ?? null),
          shortDescription: row.shortDescription ?? null,
          description: row.description ?? null,
          storefrontCategory: row.storefrontCategory ?? null,
          isAlwaysAvailable: Boolean(row.isAlwaysAvailable),
        })) as ProductOption[];
      setProducts(normalized);
    } catch {
      toast.error('Не удалось загрузить товары');
    } finally {
      setProductsLoaded(true);
    }
  };

  const loadWarehouseProducts = async (force = false) => {
    if (!force && (warehouseProductsLoaded || warehouseProductsLoadingRef.current)) {
      return;
    }

    warehouseProductsLoadingRef.current = true;
    try {
      const res = await fetchWithAuth('/api/products?isArchived=false&limit=5000&scope=warehouse');
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const normalized = list
        .filter((row: any) => row?.id && row?.name)
        .map((row: any) => ({
          id: Number(row.id),
          name: String(row.name),
          price: row.price,
          costPrice: row.costPrice,
          coverImage: row.coverImage ?? null,
          previewImage: row.previewImage ?? null,
          gallery: row.gallery ?? null,
          stock: Number(row.stock ?? 0),
          inStock: row.inStock ?? null,
          category: row.category ?? null,
          condition: row.condition ?? 'USED',
          brand: row.brand ?? null,
          model: row.model ?? null,
          version: row.version ?? null,
          catalogMainKey: row.catalogMainKey ?? null,
          catalogSubKey: row.catalogSubKey ?? null,
          catalogFamilyKey: row.catalogFamilyKey ?? null,
          variants: normalizeProductVariants(row.variants ?? null),
          shortDescription: row.shortDescription ?? null,
          description: row.description ?? null,
          storefrontCategory: row.storefrontCategory ?? null,
          isAlwaysAvailable: Boolean(row.isAlwaysAvailable),
        })) as ProductOption[];
      setWarehouseProducts(normalized);
      setWarehouseProductsLoaded(true);
    } catch {
      setWarehouseProducts([]);
      if (force) {
        setWarehouseProductsLoaded(false);
      }
    } finally {
      warehouseProductsLoadingRef.current = false;
    }
  };

  const loadStoreCategories = async () => {
    try {
      const data = await fetchWithAuth('/api/products/storefront-categories');
      if (Array.isArray(data) && data.length > 0) {
        setStoreCategories(
          data.map((item: any) => ({
            value: String(item.value),
            label:
              storefrontCategoryLabel[String(item.value)] ||
              String(item.label || item.value),
          })),
        );
      }
    } catch {
      setStoreCategories(defaultStoreCategories);
    }
  };

  const ensureBaseCatalogProducts = async () => {
    if (seedingRef.current || !productsLoaded) return;
    seedingRef.current = true;

    const keyOfExisting = (product: ProductOption) =>
      `${product.name.trim().toLowerCase()}|${String(product.storefrontCategory || '').trim().toLowerCase()}`;
    const existing = new Set(products.map((product) => keyOfExisting(product)));

    const missing = requiredCatalogProducts.filter((seed) => {
      const key = `${seed.name.trim().toLowerCase()}|${seed.storefrontCategory.trim().toLowerCase()}`;
      return !existing.has(key);
    });

    if (missing.length === 0) return;

    try {
      for (const seed of missing) {
        const inferredKeys = inferCatalogKeys(`${seed.name} ${seed.model || ''}`);
        const seedVariants = shouldUseMemoryVariants(`${seed.name} ${seed.model || ''}`)
          ? buildDefaultMemoryVariants(seed.seedPrice, Math.round(seed.seedPrice * 0.75))
          : [];

        // eslint-disable-next-line no-await-in-loop
        await fetchWithAuth('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            name: seed.name,
            category: 'CONSOLE',
            storefrontCategory: seed.storefrontCategory,
            catalogMainKey: inferredKeys.catalogMainKey,
            catalogSubKey: inferredKeys.catalogSubKey,
            catalogFamilyKey: inferredKeys.catalogFamilyKey,
            brand: seed.brand,
            model: seed.model,
            version: seed.version || seedSubtitle(seed.name),
            stock: seedVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0),
            price: seed.seedPrice,
            costPrice: Math.max(0, Math.round(seed.seedPrice * 0.75)),
            isAlwaysAvailable: false,
            isActive: true,
            variants: seedVariants.length > 0 ? seedVariants : null,
          }),
        });
      }

      await Promise.all([loadProducts(), loadStoreCategories()]);
      toast.success(`Добавлены карточки каталога: ${missing.length}`);
    } catch {
      toast.error('Не удалось автоматически подготовить карточки каталога');
    }
  };

  useEffect(() => {
    void Promise.all([loadFeatured(), loadProducts(), loadStoreCategories()]);
  }, []);

  useEffect(() => {
    if (!editorOpen || editorTab !== 'STOCK') return;
    void loadWarehouseProducts();
  }, [editorOpen, editorTab]);

  useEffect(() => {
    if (!productsLoaded) return;
    void ensureBaseCatalogProducts();
  }, [productsLoaded, products]);

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === parseId(form.productId)) || null,
    [products, form.productId],
  );

  const selectedStoreVariants = useMemo(
    () => (Array.isArray(selectedProduct?.variants) ? selectedProduct.variants : []),
    [selectedProduct?.variants],
  );
  const selectedPromoVariant = useMemo(() => {
    const normalizedKey = String(form.promoVariantKey || '').trim().toLowerCase();
    if (!selectedStoreVariants.length) return null;
    if (normalizedKey) {
      return selectedStoreVariants.find((variant) => variant.key === normalizedKey) || null;
    }
    return selectedStoreVariants.find((variant) => variant.isDefault) || selectedStoreVariants[0] || null;
  }, [form.promoVariantKey, selectedStoreVariants]);

  useEffect(() => {
    if (!selectedProduct) {
      setProductDraft(null);
      setPendingFiles([]);
      setWarehouseSourceId('');
      setWarehouseAttachQty('1');
      setWarehouseTargetVariantKey('');
      return;
    }
    setProductDraft(toProductDraft(selectedProduct));
    setPendingFiles([]);
    setWarehouseSourceId('');
    setWarehouseAttachQty('1');
    const defaultVariant =
      selectedStoreVariants.find((variant) => variant.isDefault) || selectedStoreVariants[0];
    setWarehouseTargetVariantKey(defaultVariant?.key || '');
  }, [selectedProduct?.id, selectedStoreVariants]);

  useEffect(() => {
    if (!editorOpen) return;
    if (!snapshotPendingRef.current) return;

    const selectedId = parseId(form.productId);
    if (selectedId && !productDraft) return;

    markEditorSynced();
  }, [editorOpen, form.productId, productDraft, editingFeaturedId]);

  const storefrontCards = useMemo(
    () => products.filter((item) => isCatalogCard(item)),
    [products],
  );

  const selectedWarehouseProduct = useMemo(
    () => warehouseProducts.find((item) => item.id === Number(warehouseSourceId)) || null,
    [warehouseProducts, warehouseSourceId],
  );

  const availableBrands = useMemo(() => {
    const list = storefrontCards
      .filter((item) => {
        if (storeCategoryFilter === 'ALL') return true;
        return String(item.storefrontCategory || '') === storeCategoryFilter;
      })
      .map((item) => String(item.brand || '').trim())
      .filter(Boolean);
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [storefrontCards, storeCategoryFilter]);

  const filteredProducts = useMemo(() => {
    const q = debouncedProductSearch.trim().toLowerCase();
    return storefrontCards.filter((item) => {
      if (
        storeCategoryFilter !== 'ALL' &&
        String(item.storefrontCategory || '') !== storeCategoryFilter
      ) {
        return false;
      }
      if (brandFilter !== 'ALL' && String(item.brand || '') !== brandFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        item.name,
        item.brand,
        item.model,
        item.version,
        item.storefrontCategory,
        ...aliasTokensForText(
          [item.name, item.brand, item.model, item.version].filter(Boolean).join(' '),
        ),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q) || String(item.id).includes(q);
    });
  }, [storefrontCards, debouncedProductSearch, storeCategoryFilter, brandFilter]);

  const editorDefaultVariant =
    selectedStoreVariants.find((variant) => variant.isDefault) || selectedStoreVariants[0];
  const editorOldPromoPrice = Number(
    selectedPromoVariant?.price ??
      editorDefaultVariant?.price ??
      selectedProduct?.price ??
      (form.priceOverride || 0),
  );
  const promoDaysInput = Math.max(0, Math.floor(Number(form.promoDays || 0)));
  const promoHoursInput = Math.max(0, Math.min(23, Math.floor(Number(form.promoHours || 0))));
  const promoDurationHours = promoDaysInput * 24 + promoHoursInput;
  const promoEndsPreviewText =
    promoDurationHours > 0
      ? new Date(Date.now() + promoDurationHours * 60 * 60 * 1000).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  const previewPayload = useMemo(() => {
    const isPromotion = form.kind === 'PROMOTION';
    const badge = isPromotion ? 'Акция' : form.badge.trim();
    const title = form.title.trim() || selectedProduct?.name || 'Новая карточка';
    const subtitle =
      form.subtitle.trim() ||
      selectedProduct?.version ||
      selectedProduct?.model ||
      '';
    const normalPrice = form.priceOverride.trim()
      ? formatPrice(form.priceOverride.trim())
      : selectedProduct
        ? formatPrice(selectedProduct.price)
        : null;

    const promoPriceValue = Number(form.promoPrice || 0);
    const promoEnabled = isPromotion && form.promoEnabled && promoDurationHours > 0;
    const promoOldPriceText = editorOldPromoPrice > 0 ? formatPrice(editorOldPromoPrice) : null;
    const promoNewPriceText =
      promoEnabled && Number.isFinite(promoPriceValue) && promoPriceValue > 0
        ? formatPrice(promoPriceValue)
        : null;

    return {
      title,
      subtitle,
      badge: badge || null,
      price: isPromotion ? promoNewPriceText : normalPrice,
      oldPrice: isPromotion ? promoOldPriceText : null,
      isPromo: isPromotion && Boolean(promoNewPriceText),
      promoEndsIn:
        isPromotion && promoEnabled ? formatPromoRemaining(promoDurationHours * 60 * 60) : null,
      image: selectedProduct?.previewImage || selectedProduct?.coverImage || null,
    };
  }, [form, selectedProduct, editorOldPromoPrice, promoDurationHours]);

  const selectedGallery = useMemo(
    () => normalizeGallery(selectedProduct?.gallery, selectedProduct?.coverImage),
    [selectedProduct?.gallery, selectedProduct?.coverImage],
  );

  const brandSuggestions = useMemo(
    () => Object.keys(modelPresetsByBrand).sort((a, b) => a.localeCompare(b, 'ru')),
    [],
  );

  const modelSuggestions = useMemo(() => {
    if (!productDraft) return [];
    const byBrand = modelPresetsByBrand[productDraft.brand.trim()];
    if (byBrand?.length) return byBrand;
    return Array.from(
      new Set(
        Object.values(modelPresetsByBrand)
          .flat()
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [productDraft?.brand]);

  const versionSuggestions = useMemo(() => {
    if (!productDraft) return [];
    return versionPresetsByModel[productDraft.model.trim()] || [];
  }, [productDraft?.model]);

  const catalogSubSuggestions = useMemo(() => {
    if (!productDraft) return [];
    return catalogSubOptions[productDraft.catalogMainKey] || [];
  }, [productDraft?.catalogMainKey]);

  const catalogFamilySuggestions = useMemo(() => {
    if (!productDraft) return [];
    const key = `${productDraft.catalogMainKey}:${productDraft.catalogSubKey}`;
    return catalogFamilyOptions[key] || [];
  }, [productDraft?.catalogMainKey, productDraft?.catalogSubKey]);

  const removeFeatured = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/shop/admin/featured/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        toast.error('Не удалось удалить');
        return;
      }

      toast.success('Удалено');
      await loadFeatured();
    } catch {
      toast.error('Ошибка сети');
    }
  };

  const updateLocalItem = (id: number, patch: Partial<FeaturedItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const currentFeaturedPayloadFromForm = () => {
    const isPromotion = form.kind === 'PROMOTION';
    const selectedPromotionVariant =
      selectedPromoVariant ||
      selectedStoreVariants.find((variant) => variant.isDefault) ||
      selectedStoreVariants[0];
    const productBasePrice = Number(selectedPromotionVariant?.price ?? selectedProduct?.price ?? 0);
    const oldPriceFromForm = Number(productBasePrice || form.priceOverride || 0);
    const promoDays = Math.max(0, Math.floor(Number(form.promoDays || 0)));
    const promoHours = Math.max(0, Math.min(23, Math.floor(Number(form.promoHours || 0))));
    const totalPromoHours = promoDays * 24 + promoHours;
    const promoEnabled = isPromotion ? Boolean(form.promoEnabled) : false;
    const promoEndsAt =
      isPromotion && promoEnabled && totalPromoHours > 0
        ? new Date(Date.now() + totalPromoHours * 60 * 60 * 1000).toISOString()
        : null;

    const title = form.title.trim() || selectedProduct?.name || '';
    return {
      title,
      subtitle: form.subtitle.trim() || null,
      badge: isPromotion ? 'Акция' : form.badge.trim() || null,
      priceOverride: form.priceOverride.trim() || null,
      position: Number(form.position || 0),
      isActive: form.isActive,
      productId: form.kind === 'KIT' ? null : parseId(form.productId),
      kitId: form.kind === 'KIT' ? parseId(form.kitId) : null,
      promoBlock: isPromotion,
      promoEnabled,
      promoPrice:
        isPromotion && promoEnabled && form.promoPrice.trim() ? form.promoPrice.trim() : null,
      promoVariantKey:
        isPromotion && selectedStoreVariants.length > 0
          ? String(form.promoVariantKey || selectedPromotionVariant?.key || '')
          : null,
      promoOldPrice:
        isPromotion && promoEnabled && Number.isFinite(oldPriceFromForm) && oldPriceFromForm > 0
          ? String(oldPriceFromForm)
          : null,
      promoEndsAt,
    };
  };

  const openCreateEditor = () => {
    setEditingFeaturedId(null);
    setEditorTab('CONTENT');
    setForm(emptyForm);
    setProductSearch('');
    setStoreCategoryFilter('ALL');
    setBrandFilter('ALL');
    editorSnapshotRef.current = '';
    snapshotPendingRef.current = true;
    setEditorOpen(true);
  };

  const openBlockEditor = (item: FeaturedItem) => {
    const isKit = Boolean(item.kitId ?? item.kit?.id);
    const isPromotion =
      !isKit &&
      Boolean(
        item.promoBlock ||
          item.isPromo ||
          String(item.badge || '').toLowerCase().includes('акц'),
      );
    const now = Date.now();
    const endsAtTs = item.promoEndsAt ? new Date(item.promoEndsAt).getTime() : 0;
    const remainingSec = endsAtTs > now ? Math.floor((endsAtTs - now) / 1000) : 0;
    const promoDays = Math.floor(remainingSec / 86400);
    const promoHours = Math.floor((remainingSec % 86400) / 3600);
    setEditingFeaturedId(item.id);
    setForm({
      kind: isKit ? 'KIT' : isPromotion ? 'PROMOTION' : 'PRODUCT',
      title: String(item.title || ''),
      subtitle: String(item.subtitle || ''),
      badge: String(item.badge || ''),
      priceOverride: String(item.priceOverride || ''),
      promoEnabled: item.promoEnabled !== undefined ? Boolean(item.promoEnabled) : isPromotion,
      promoPrice: String(item.promoPrice || ''),
      promoVariantKey: String(item.promoVariantKey || ''),
      promoDays: String(Math.max(0, promoDays)),
      promoHours: String(Math.max(0, promoHours || (isPromotion ? 1 : 0))),
      position: String(item.position ?? 0),
      productId: String(item.productId ?? item.product?.id ?? ''),
      kitId: String(item.kitId ?? item.kit?.id ?? ''),
      isActive: Boolean(item.isActive),
    });
    setEditorTab('CONTENT');
    editorSnapshotRef.current = '';
    snapshotPendingRef.current = true;
    setEditorOpen(true);
  };

  const buildEditorSnapshot = () => {
    return JSON.stringify({
      editingFeaturedId,
      form,
      productDraft,
      pendingFiles: pendingFiles.map((file) => ({
        name: file.name,
        size: file.size,
        modified: file.lastModified,
      })),
      warehouseSourceId,
      warehouseAttachQty,
      warehouseTargetVariantKey,
    });
  };

  const markEditorSynced = () => {
    editorSnapshotRef.current = buildEditorSnapshot();
    snapshotPendingRef.current = false;
  };

  const hasUnsavedChanges =
    editorOpen && Boolean(editorSnapshotRef.current) && editorSnapshotRef.current !== buildEditorSnapshot();

  const closeEditorImmediately = () => {
    setEditorOpen(false);
    setEditingFeaturedId(null);
    setEditorTab('CONTENT');
    setForm(emptyForm);
    setProductSearch('');
    setStoreCategoryFilter('ALL');
    setBrandFilter('ALL');
    setPendingFiles([]);
    setCloseConfirmOpen(false);
    editorSnapshotRef.current = '';
    snapshotPendingRef.current = false;
  };

  const requestCloseEditor = () => {
    if (hasUnsavedChanges) {
      setCloseConfirmOpen(true);
      return;
    }
    closeEditorImmediately();
  };

  const saveFeaturedFromEditor = async () => {
    const payload = currentFeaturedPayloadFromForm();
    if (!payload.title.trim()) {
      toast.error('Укажи заголовок карточки');
      return;
    }
    if (form.kind === 'PROMOTION') {
      if (!payload.productId) {
        toast.error('Для акционного блока выберите существующий товар');
        return;
      }
      if (form.promoEnabled) {
        const promoPriceNumber = Number(form.promoPrice || 0);
        const promoDays = Math.max(0, Math.floor(Number(form.promoDays || 0)));
        const promoHoursRaw = Number(form.promoHours || 0);
        const promoHours = Math.floor(promoHoursRaw);
        if (!Number.isFinite(promoHoursRaw) || promoHours < 0 || promoHours > 23) {
          toast.error('Часы акции должны быть в диапазоне 0..23');
          return;
        }
        if (promoDays === 0 && promoHours === 0) {
          toast.error('Укажите период акции: минимум 0д 1ч');
          return;
        }
        if (!Number.isFinite(promoPriceNumber) || promoPriceNumber <= 0) {
          toast.error('Укажите корректную акционную цену');
          return;
        }
        const oldPrice = Number(payload.promoOldPrice || 0);
        if (oldPrice > 0 && promoPriceNumber >= oldPrice) {
          toast.error('Акционная цена должна быть меньше старой');
          return;
        }
      }
    }

    try {
      if (editingFeaturedId) {
        const res = await fetchWithAuth(`/api/shop/admin/featured/${editingFeaturedId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          toast.error('Не удалось сохранить блок');
          return;
        }

        toast.success('Блок витрины сохранен');
      } else {
        const res = await fetchWithAuth('/api/shop/admin/featured', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          toast.error('Ошибка создания');
          return;
        }
        toast.success('Карточка создана');
      }

      await loadFeatured();
      markEditorSynced();
      if (!editingFeaturedId) {
        setForm(emptyForm);
        closeEditorImmediately();
      }
    } catch {
      toast.error('Ошибка сети');
    }
  };

  const toggleFeaturedActive = async (item: FeaturedItem) => {
    const nextActive = !item.isActive;
    updateLocalItem(item.id, { isActive: nextActive });
    try {
      await fetchWithAuth(`/api/shop/admin/featured/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: item.title,
          subtitle: item.subtitle ?? null,
          badge: item.badge ?? null,
          priceOverride: item.priceOverride ?? null,
          position: item.position,
          isActive: nextActive,
          productId: item.productId ?? item.product?.id ?? null,
          kitId: item.kitId ?? item.kit?.id ?? null,
          promoBlock: item.promoBlock ?? false,
          promoEnabled: item.promoEnabled ?? false,
        }),
      });
      toast.success(nextActive ? 'Блок опубликован' : 'Блок скрыт');
    } catch {
      updateLocalItem(item.id, { isActive: item.isActive });
      toast.error('Не удалось изменить статус блока');
    }
  };

  const saveSelectedProduct = async () => {
    if (!selectedProduct || !productDraft) return;
    setSavingProduct(true);
    try {
      const preparedVariants = normalizeProductVariants(productDraft.variants).map((variant) => ({
        ...variant,
        inStock: Number(variant.stock || 0) > 0,
      }));
      const hasVariants = preparedVariants.length > 0;

      await fetchWithAuth(`/api/products/${selectedProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: productDraft.name,
          category: productDraft.category,
          condition: productDraft.condition,
          storefrontCategory: productDraft.storefrontCategory,
          catalogMainKey: productDraft.catalogMainKey || null,
          catalogSubKey: productDraft.catalogSubKey || null,
          catalogFamilyKey: productDraft.catalogFamilyKey || null,
          brand: productDraft.brand || null,
          model: productDraft.model || null,
          version: productDraft.version || null,
          shortDescription: productDraft.shortDescription || null,
          description: productDraft.description || null,
          price: productDraft.price,
          costPrice: productDraft.costPrice,
          isAlwaysAvailable: productDraft.isAlwaysAvailable,
          variants: hasVariants ? preparedVariants : null,
        }),
      });

      if (pendingFiles.length > 0) {
        const formData = new FormData();
        pendingFiles.forEach((file) => formData.append('files', file));
        await fetchWithAuth(`/api/products/${selectedProduct.id}/images`, {
          method: 'POST',
          body: formData,
        });
      }

      setPendingFiles([]);
      await loadProducts();
      await loadStoreCategories();
      markEditorSynced();
      toast.success('Товар сохранен');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось сохранить товар');
    } finally {
      setSavingProduct(false);
    }
  };

  const attachStockFromWarehouse = async () => {
    if (!selectedProduct) return;
    if (!selectedProduct.storefrontCategory) {
      toast.error('Наличие можно прикреплять только к карточке витрины');
      return;
    }

    const sourceProductId = Number(warehouseSourceId || 0);
    if (!Number.isFinite(sourceProductId) || sourceProductId <= 0) {
      toast.error('Выберите складскую позицию');
      return;
    }

    const qty = Math.max(1, Math.floor(Number(warehouseAttachQty || 1)));
    const fallbackVariant =
      selectedStoreVariants.find((variant) => variant.isDefault)?.key ||
      selectedStoreVariants[0]?.key ||
      '';
    const targetVariantKey =
      selectedStoreVariants.length > 0
        ? String(warehouseTargetVariantKey || fallbackVariant || '')
        : '';

    setAttachingWarehouse(true);
    try {
      await fetchWithAuth(`/api/products/${selectedProduct.id}/stock/attach`, {
        method: 'POST',
        body: JSON.stringify({
          sourceProductId,
          qty,
          targetVariantKey: targetVariantKey || null,
        }),
      });
      await Promise.all([loadProducts(), loadWarehouseProducts(true)]);
      toast.success(`Прикреплено со склада: ${qty} шт`);
      setWarehouseAttachQty('1');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось прикрепить наличие со склада');
    } finally {
      setAttachingWarehouse(false);
    }
  };

  const setCover = async (url: string) => {
    if (!selectedProduct) return;
    try {
      await fetchWithAuth(`/api/products/${selectedProduct.id}/images/cover`, {
        method: 'PATCH',
        body: JSON.stringify({ url }),
      });
      await loadProducts();
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка выбора главного фото');
    }
  };

  const uploadPreviewImage = async (file: File) => {
    if (!selectedProduct) return;
    if (!file) return;

    setPreviewUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await fetchWithAuth(`/api/products/${selectedProduct.id}/preview-image`, {
        method: 'POST',
        body: formData,
      });
      await loadProducts();
      toast.success('Превью карточки обновлено');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить превью');
    } finally {
      setPreviewUploading(false);
    }
  };

  const setPreviewFromGallery = async (url: string) => {
    if (!selectedProduct) return;
    try {
      await fetchWithAuth(`/api/products/${selectedProduct.id}/preview-image`, {
        method: 'PATCH',
        body: JSON.stringify({ url }),
      });
      await loadProducts();
      toast.success('Превью выбрано из галереи');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось выбрать превью');
    }
  };

  const removePreviewImage = async () => {
    if (!selectedProduct) return;
    try {
      await fetchWithAuth(`/api/products/${selectedProduct.id}/preview-image`, {
        method: 'DELETE',
      });
      await loadProducts();
      toast.success('Превью удалено');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось удалить превью');
    }
  };

  const reorderGallery = async (images: string[]) => {
    if (!selectedProduct) return false;
    try {
      await fetchWithAuth(`/api/products/${selectedProduct.id}/images/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ images }),
      });
      await loadProducts();
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка сортировки фото');
      return false;
    }
  };

  const removeImage = async (url: string) => {
    if (!selectedProduct) return;
    try {
      await fetchWithAuth(`/api/products/${selectedProduct.id}/images`, {
        method: 'DELETE',
        body: JSON.stringify({ url }),
      });
      await loadProducts();
      toast.success('Фото удалено');
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка удаления фото');
    }
  };

  const normalizeForMatch = (input?: string | null) =>
    String(input || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const parseMemoryFromText = (input?: string | null) => {
    const text = normalizeForMatch(input);
    if (!text) return null;

    const tbMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(tb|тб|тера|терабайт)/i);
    if (tbMatch) {
      const raw = Number(String(tbMatch[1]).replace(',', '.'));
      if (Number.isFinite(raw) && raw > 0) return Math.round(raw * 1024);
    }

    const gbMatch = text.match(/(\d{2,4})\s*(gb|гб)/i);
    if (gbMatch) {
      const raw = Number(gbMatch[1]);
      if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
    }

    return null;
  };

  const findBestStorefrontProduct = (item: FeaturedItem) => {
    const sourceText = normalizeForMatch([item.title, item.subtitle].filter(Boolean).join(' '));
    if (!sourceText) return null;
    const sourceMemoryGb = parseMemoryFromText(sourceText);

    const scored = storefrontCards
      .map((product) => {
        const productName = normalizeForMatch(product.name);
        const productModel = normalizeForMatch(product.model);
        const productVersion = normalizeForMatch(product.version);
        const productTokens = new Set(
          [productName, productModel, productVersion]
            .filter(Boolean)
            .join(' ')
            .split(' ')
            .filter(Boolean),
        );
        const sourceTokens = new Set(sourceText.split(' ').filter(Boolean));

        let score = 0;
        if (productName && sourceText === productName) score += 14;
        if (productName && sourceText.includes(productName)) score += 10;
        if (productModel && sourceText.includes(productModel)) score += 8;
        if (productVersion && sourceText.includes(productVersion)) score += 4;

        let overlap = 0;
        for (const token of sourceTokens) {
          if (productTokens.has(token)) overlap += 1;
        }
        score += Math.min(8, overlap);

        if (sourceMemoryGb && Array.isArray(product.variants) && product.variants.length > 0) {
          const memories = product.variants
            .map((variant) => Number(variant.memoryGb || 0))
            .filter((value) => Number.isFinite(value) && value > 0);
          if (memories.length > 0) {
            const nearest = Math.min(
              ...memories.map((value) => Math.abs(Number(value) - sourceMemoryGb)),
            );
            if (nearest <= 32) score += 6;
            else if (nearest <= 128) score += 3;
          }
        }

        return { product, score };
      })
      .sort((a, b) => {
        if (a.score === b.score) return a.product.id - b.product.id;
        return b.score - a.score;
      });

    const best = scored[0];
    if (!best || best.score < 7) return null;
    return best.product;
  };

  const autoBindUnlinkedBlocks = async (showToast = true) => {
    const unlinked = items.filter((item) => !item.kitId && !(item.productId || item.product?.id));
    if (!unlinked.length) {
      if (showToast) toast.message('Нет блоков без привязки');
      return;
    }

    let linked = 0;
    for (const item of unlinked) {
      const matched = findBestStorefrontProduct(item);
      if (!matched) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        await fetchWithAuth(`/api/shop/admin/featured/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ productId: matched.id, kitId: null }),
        });
        linked += 1;
      } catch {
        // ignore single-item failures
      }
    }

    if (linked > 0) {
      await loadFeatured();
      if (showToast) {
        toast.success(`Автопривязано блоков: ${linked}`);
      }
    } else if (showToast) {
      toast.error('Не удалось найти совпадения для автопривязки');
    }
  };

  const patchVariantRow = (index: number, patch: Partial<ProductVariant>) => {
    if (!productDraft) return;
    setProductDraft((current) => {
      if (!current) return current;
      const nextVariants = [...current.variants];
      const row = nextVariants[index];
      if (!row) return current;
      nextVariants[index] = { ...row, ...patch };
      return { ...current, variants: nextVariants };
    });
  };

  const setDefaultVariantRow = (index: number) => {
    if (!productDraft) return;
    setProductDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        variants: current.variants.map((variant, variantIndex) => ({
          ...variant,
          isDefault: variantIndex === index,
        })),
      };
    });
  };

  const removeVariantRow = (index: number) => {
    if (!productDraft) return;
    setProductDraft((current) => {
      if (!current) return current;
      const next = current.variants.filter((_, variantIndex) => variantIndex !== index);
      if (next.length > 0 && !next.some((variant) => variant.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return { ...current, variants: next };
    });
  };

  const addVariantRow = () => {
    if (!productDraft) return;
    setProductDraft((current) => {
      if (!current) return current;
      const nextMemory = current.variants.length
        ? Math.max(
            256,
            ...current.variants.map((variant) => Math.max(0, Number(variant.memoryGb || 0))),
          ) + 256
        : 512;
      const key = toVariantKey(nextMemory);
      const alreadyHas = current.variants.some((variant) => variant.key === key);
      const safeKey = alreadyHas ? `${key}-${current.variants.length + 1}` : key;
      return {
        ...current,
        variants: [
          ...current.variants,
          {
            key: safeKey,
            label: `${nextMemory} GB`,
            memoryGb: nextMemory,
            price: Math.max(0, Number(current.price || 0)),
            costPrice: Math.max(0, Number(current.costPrice || 0)),
            stock: 0,
            inStock: false,
            isDefault: current.variants.length === 0,
          },
        ],
      };
    });
  };

  const applyMemoryTemplate = () => {
    if (!productDraft) return;
    setProductDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        variants: buildDefaultMemoryVariants(Number(current.price || 0), Number(current.costPrice || 0)),
      };
    });
  };

  const moveGalleryImage = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= selectedGallery.length || toIndex >= selectedGallery.length) return;

    const next = [...selectedGallery];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);

    setGalleryReordering(true);
    const saved = await reorderGallery(next);
    setGalleryReordering(false);

    if (saved) {
      toast.success(`Позиция фото обновлена: ${fromIndex + 1} → ${toIndex + 1}`);
    }
  };

  const handleGalleryDrop = async (dropIndex: number, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    const parsed = Number(raw);
    const sourceIndex = Number.isFinite(parsed) ? parsed : galleryDragSource;

    setGalleryDragSource(null);
    setGalleryDragTarget(null);

    if (sourceIndex == null || !Number.isFinite(sourceIndex)) return;
    await moveGalleryImage(sourceIndex, dropIndex);
  };

  const blockCategoryOptions = useMemo(() => {
    const categories = new Set(
      items
        .map((item) => String(item.product?.storefrontCategory || '').trim())
        .filter(Boolean),
    );
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [items]);

  const visibleItems = useMemo(() => {
    let next = [...items];

    if (filter === 'ACTIVE') next = next.filter((item) => item.isActive);
    if (filter === 'PROMOTIONS') {
      next = next.filter((item) => Boolean(item.promoBlock || item.isPromo));
    }

    if (blockCategoryFilter !== 'ALL') {
      next = next.filter(
        (item) => String(item.product?.storefrontCategory || '') === blockCategoryFilter,
      );
    }

    const q = debouncedBlockSearch.trim().toLowerCase();
    if (q) {
      next = next.filter((item) => {
        const haystack = [
          item.id,
          item.title,
          item.subtitle,
          item.badge,
          item.productId,
          item.product?.id,
          item.product?.name,
          item.product?.model,
          item.product?.brand,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (blockSort === 'POSITION_DESC') {
      next.sort((a, b) => b.position - a.position);
      return next;
    }
    if (blockSort === 'TITLE_ASC') {
      next.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'));
      return next;
    }
    if (blockSort === 'TITLE_DESC') {
      next.sort((a, b) => String(b.title || '').localeCompare(String(a.title || ''), 'ru'));
      return next;
    }
    next.sort((a, b) => a.position - b.position);
    return next;
  }, [items, filter, blockCategoryFilter, debouncedBlockSearch, blockSort]);

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      bgcolor: 'rgba(2, 6, 23, 0.45)',
      '& fieldset': {
        borderColor: 'rgba(148, 163, 184, 0.35)',
      },
      '&:hover fieldset': {
        borderColor: 'rgba(56, 189, 248, 0.48)',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'rgba(34, 211, 238, 0.72)',
      },
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(148, 163, 184, 0.9)',
    },
  } as const;

  const editorMode: 'create' | 'edit' = editingFeaturedId ? 'edit' : 'create';
  const selectedCategoryLabel = selectedProduct?.storefrontCategory
    ? storefrontCategoryLabel[selectedProduct.storefrontCategory] || selectedProduct.storefrontCategory
    : null;
  const totalBlocks = items.length;
  const totalActiveBlocks = items.filter((item) => item.isActive).length;
  const totalPromotionBlocks = items.filter((item) => Boolean(item.promoBlock || item.isPromo)).length;

  const removeFeaturedWithConfirm = async () => {
    if (!deleteCandidate) return;
    const deletingId = deleteCandidate.id;
    setDeleteCandidate(null);
    await removeFeatured(deletingId);
    if (editingFeaturedId === deletingId) {
      closeEditorImmediately();
    }
  };

  const editorContent = (
    <Stack spacing={2.5}>
      <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(148, 163, 184, 0.25)', bgcolor: 'rgba(2, 6, 23, 0.36)' }}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
              Настройки блока
            </Typography>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel id="editor-kind-label">Тип блока</InputLabel>
                  <Select
                    labelId="editor-kind-label"
                    label="Тип блока"
                    value={form.kind}
                  onChange={(event) => setForm({ ...form, kind: event.target.value as BlockKind })}
                >
                  <MenuItem value="PRODUCT">Товарный блок</MenuItem>
                  <MenuItem value="PROMOTION">Акционный блок</MenuItem>
                  <MenuItem value="KIT">Комплект (по ID)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Позиция"
                  value={form.position}
                  onChange={(event) => setForm({ ...form, position: event.target.value })}
                  sx={fieldSx}
                />
              </Grid>

              {form.kind !== 'KIT' ? (
                <>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth size="small" sx={fieldSx}>
                      <InputLabel id="editor-category-filter-label">Раздел каталога</InputLabel>
                      <Select
                        labelId="editor-category-filter-label"
                        label="Раздел каталога"
                        value={storeCategoryFilter}
                        onChange={(event) => setStoreCategoryFilter(String(event.target.value))}
                      >
                        <MenuItem value="ALL">Все разделы</MenuItem>
                        {storeCategories.map((category) => (
                          <MenuItem key={category.value} value={category.value}>
                            {category.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth size="small" sx={fieldSx}>
                      <InputLabel id="editor-brand-filter-label">Бренд</InputLabel>
                      <Select
                        labelId="editor-brand-filter-label"
                        label="Бренд"
                        value={brandFilter}
                        onChange={(event) => setBrandFilter(String(event.target.value))}
                      >
                        <MenuItem value="ALL">Все бренды</MenuItem>
                        {availableBrands.map((brand) => (
                          <MenuItem key={brand} value={brand}>
                            {brand}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Поиск товара"
                      placeholder="Имя, модель, ID"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      helperText="Поиск применяется с debounce 300ms"
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormControl fullWidth size="small" sx={fieldSx}>
                      <InputLabel id="editor-product-label">Товар</InputLabel>
                      <Select
                        labelId="editor-product-label"
                        label="Товар"
                        value={form.productId}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            productId: String(event.target.value),
                            title:
                              prev.title ||
                              filteredProducts.find((product) => product.id === Number(event.target.value))
                                ?.name ||
                              '',
                          }))
                        }
                      >
                        <MenuItem value="">Не выбран</MenuItem>
                        {filteredProducts.map((product) => (
                          <MenuItem key={product.id} value={String(product.id)}>
                            #{product.id} · {product.name}
                            {product.model ? ` · ${product.model}` : ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              ) : (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="ID комплекта"
                    value={form.kitId}
                    onChange={(event) => setForm({ ...form, kitId: event.target.value })}
                    sx={fieldSx}
                  />
                </Grid>
              )}

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Заголовок"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Подзаголовок"
                  value={form.subtitle}
                  onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={form.kind === 'PROMOTION' ? 'Метка' : 'Бейдж'}
                  value={form.kind === 'PROMOTION' ? 'Акция' : form.badge}
                  onChange={(event) => setForm({ ...form, badge: event.target.value })}
                  disabled={form.kind === 'PROMOTION'}
                  sx={fieldSx}
                />
              </Grid>
              {form.kind !== 'PROMOTION' ? (
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Цена витрины (опц.)"
                    value={form.priceOverride}
                    onChange={(event) => setForm({ ...form, priceOverride: event.target.value })}
                    sx={fieldSx}
                  />
                </Grid>
              ) : null}
            </Grid>

            {form.kind === 'PROMOTION' ? (
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2.25,
                  borderColor: 'rgba(251, 146, 60, 0.35)',
                  bgcolor: 'rgba(249, 115, 22, 0.08)',
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2" sx={{ color: '#ffedd5', fontWeight: 700 }}>
                      Настройки акции
                    </Typography>

                    <Grid container spacing={1.25} alignItems="center">
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Старая цена"
                          value={editorOldPromoPrice > 0 ? formatPrice(editorOldPromoPrice) : '—'}
                          InputProps={{ readOnly: true }}
                          helperText="Берётся из базовой цены товара/варианта"
                          sx={fieldSx}
                        />
                      </Grid>
                      {selectedStoreVariants.length > 0 ? (
                        <Grid size={{ xs: 12, md: 4 }}>
                          <FormControl fullWidth size="small" sx={fieldSx}>
                            <InputLabel id="promo-variant-select-label">Вариация акции</InputLabel>
                            <Select
                              labelId="promo-variant-select-label"
                              label="Вариация акции"
                              value={form.promoVariantKey || selectedPromoVariant?.key || ''}
                              onChange={(event) =>
                                setForm((prev) => ({
                                  ...prev,
                                  promoVariantKey: String(event.target.value),
                                }))
                              }
                            >
                              {selectedStoreVariants.map((variant) => (
                                <MenuItem key={variant.key} value={variant.key}>
                                  {variant.label}
                                  {variant.isDefault ? ' · По умолчанию' : ''}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      ) : null}
                      <Grid size={{ xs: 12, md: 4 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Новая цена (promo)"
                          value={form.promoPrice}
                          onChange={(event) => setForm({ ...form, promoPrice: event.target.value })}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, md: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Дни"
                          value={form.promoDays}
                          onChange={(event) => setForm({ ...form, promoDays: event.target.value })}
                          inputProps={{ min: 0 }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, md: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Часы"
                          value={form.promoHours}
                          onChange={(event) => setForm({ ...form, promoHours: event.target.value })}
                          inputProps={{ min: 0, max: 23 }}
                          sx={fieldSx}
                        />
                      </Grid>
                    </Grid>

                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={form.promoEnabled}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, promoEnabled: event.target.checked }))
                            }
                          />
                        }
                        label="Акция активна"
                        sx={{ color: 'rgba(255, 237, 213, 0.95)', mr: 0 }}
                      />
                      <Typography variant="caption" sx={{ color: '#fed7aa' }}>
                        Период: {promoDaysInput}д {promoHoursInput}ч
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#fdba74' }}>
                        Завершение: {promoEndsPreviewText || 'укажите период'}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ) : null}

            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
              }
              label="Показывать блок на сайте"
              sx={{ color: 'rgba(226, 232, 240, 0.9)' }}
            />

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" onClick={saveFeaturedFromEditor} sx={{ textTransform: 'none', borderRadius: 2 }}>
                {editingFeaturedId ? 'Сохранить блок' : 'Создать блок'}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setForm(emptyForm);
                  setProductSearch('');
                  setStoreCategoryFilter('ALL');
                  setBrandFilter('ALL');
                }}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Очистить форму
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {selectedProduct && productDraft ? (
        <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(34, 211, 238, 0.3)', bgcolor: 'rgba(6, 182, 212, 0.06)' }}>
          <CardContent sx={{ p: 2.25 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ color: '#ecfeff', fontWeight: 700 }}>
                Контент карточки товара #{selectedProduct.id}
              </Typography>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Название"
                    value={productDraft.name}
                    onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })}
                    sx={fieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel id="product-store-category-label">Категория витрины</InputLabel>
                    <Select
                      labelId="product-store-category-label"
                      label="Категория витрины"
                      value={productDraft.storefrontCategory}
                      onChange={(event) =>
                        setProductDraft({ ...productDraft, storefrontCategory: String(event.target.value) })
                      }
                    >
                      {storeCategories.map((category) => (
                        <MenuItem key={category.value} value={category.value}>
                          {category.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel id="catalog-main-label">Раздел main</InputLabel>
                    <Select
                      labelId="catalog-main-label"
                      label="Раздел main"
                      value={productDraft.catalogMainKey}
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          catalogMainKey: String(event.target.value),
                          catalogSubKey: '',
                          catalogFamilyKey: '',
                        })
                      }
                    >
                      <MenuItem value="">Не выбран</MenuItem>
                      {catalogMainOptions.map((option) => (
                        <MenuItem key={option.key} value={option.key}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel id="catalog-sub-label">Подраздел sub</InputLabel>
                    <Select
                      labelId="catalog-sub-label"
                      label="Подраздел sub"
                      value={productDraft.catalogSubKey}
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          catalogSubKey: String(event.target.value),
                          catalogFamilyKey: '',
                        })
                      }
                      disabled={!productDraft.catalogMainKey}
                    >
                      <MenuItem value="">Не выбран</MenuItem>
                      {catalogSubSuggestions.map((option) => (
                        <MenuItem key={option.key} value={option.key}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel id="catalog-family-label">Семейство family</InputLabel>
                    <Select
                      labelId="catalog-family-label"
                      label="Семейство family"
                      value={productDraft.catalogFamilyKey}
                      onChange={(event) => setProductDraft({ ...productDraft, catalogFamilyKey: String(event.target.value) })}
                      disabled={!productDraft.catalogMainKey || !productDraft.catalogSubKey}
                    >
                      <MenuItem value="">Не выбран</MenuItem>
                      {catalogFamilySuggestions.map((option) => (
                        <MenuItem key={option.key} value={option.key}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel id="product-category-label">Тип товара</InputLabel>
                    <Select
                      labelId="product-category-label"
                      label="Тип товара"
                      value={productDraft.category}
                      onChange={(event) => setProductDraft({ ...productDraft, category: String(event.target.value) })}
                    >
                      <MenuItem value="CONSOLE">CONSOLE</MenuItem>
                      <MenuItem value="DISK">DISK</MenuItem>
                      <MenuItem value="SERVICE">SERVICE</MenuItem>
                      <MenuItem value="SUBSCRIPTION_KEY">SUBSCRIPTION_KEY</MenuItem>
                      <MenuItem value="ACCESSORY">ACCESSORY</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel id="condition-label">Состояние</InputLabel>
                    <Select
                      labelId="condition-label"
                      label="Состояние"
                      value={productDraft.condition}
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          condition: event.target.value === 'NEW' ? 'NEW' : 'USED',
                        })
                      }
                    >
                      <MenuItem value="NEW">Новое</MenuItem>
                      <MenuItem value="USED">Б/У</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Бренд"
                    value={productDraft.brand}
                    onChange={(event) => setProductDraft({ ...productDraft, brand: event.target.value })}
                    sx={fieldSx}
                    inputProps={{ list: 'storefront-brand-suggestions' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Модель"
                    value={productDraft.model}
                    onChange={(event) => setProductDraft({ ...productDraft, model: event.target.value })}
                    sx={fieldSx}
                    inputProps={{ list: 'storefront-model-suggestions' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Версия"
                    value={productDraft.version}
                    onChange={(event) => setProductDraft({ ...productDraft, version: event.target.value })}
                    sx={fieldSx}
                    inputProps={{ list: 'storefront-version-suggestions' }}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Краткое описание для каталога"
                    value={productDraft.shortDescription}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, shortDescription: event.target.value })
                    }
                    sx={fieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    size="small"
                    label="Полное описание"
                    value={productDraft.description}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, description: event.target.value })
                    }
                    sx={fieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    size="small"
                    label="Цена продажи"
                    value={productDraft.price}
                    onChange={(event) =>
                      setProductDraft({
                        ...productDraft,
                        price: Math.max(0, Number(event.target.value)),
                      })
                    }
                    sx={fieldSx}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    size="small"
                    label="Себестоимость"
                    value={productDraft.costPrice}
                    onChange={(event) =>
                      setProductDraft({
                        ...productDraft,
                        costPrice: Math.max(0, Number(event.target.value)),
                      })
                    }
                    sx={fieldSx}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={productDraft.isAlwaysAvailable}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, isAlwaysAvailable: event.target.checked })
                    }
                  />
                }
                label="Всегда в наличии (для цифровых сервисов)"
                sx={{ color: 'rgba(226, 232, 240, 0.9)' }}
              />

              <Button
                variant="contained"
                onClick={saveSelectedProduct}
                disabled={savingProduct}
                sx={{ textTransform: 'none', borderRadius: 2, alignSelf: 'flex-start' }}
              >
                {savingProduct ? 'Сохраняем...' : 'Сохранить карточку товара'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Alert severity="info" sx={{ bgcolor: 'rgba(2, 132, 199, 0.15)', color: '#dbeafe', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
          Для редактирования контента карточки выберите товар в блоке.
        </Alert>
      )}

      <datalist id="storefront-brand-suggestions">
        {brandSuggestions.map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
      <datalist id="storefront-model-suggestions">
        {modelSuggestions.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
      <datalist id="storefront-version-suggestions">
        {versionSuggestions.map((version) => (
          <option key={version} value={version} />
        ))}
      </datalist>
    </Stack>
  );

  const editorMedia = selectedProduct ? (
    <Stack spacing={2.5}>
      <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(34, 211, 238, 0.35)', bgcolor: 'rgba(6, 182, 212, 0.06)' }}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="subtitle1" sx={{ color: '#ecfeff', fontWeight: 700 }}>
                  Превью для каталога
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.88)' }}>
                  Отдельная картинка для компактной карточки витрины.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  component="label"
                  variant="outlined"
                  disabled={previewUploading}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  {previewUploading ? 'Загрузка...' : 'Загрузить превью'}
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPreviewImage(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={!selectedProduct.previewImage || previewUploading}
                  onClick={() => void removePreviewImage()}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Удалить превью
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ borderRadius: 2, border: '1px solid rgba(148, 163, 184, 0.2)', p: 1.25, bgcolor: 'rgba(2, 6, 23, 0.5)' }}>
              {selectedProduct.previewImage ? (
                <Box
                  component="img"
                  src={resolveMediaUrl(selectedProduct.previewImage) || ''}
                  alt="preview"
                  sx={{ width: '100%', height: 170, objectFit: 'contain', borderRadius: 1.5 }}
                />
              ) : (
                <Box sx={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.9)' }}>
                    Превью не загружено
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(148, 163, 184, 0.26)', bgcolor: 'rgba(2, 6, 23, 0.36)' }}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Галерея фото
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.88)' }}>
                  Всего изображений: {selectedGallery.length}. Перетаскивайте для изменения порядка.
                </Typography>
              </Box>
              <Button component="label" variant="outlined" sx={{ textTransform: 'none', borderRadius: 2 }}>
                Добавить фото
                <input
                  hidden
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => setPendingFiles(Array.from(event.target.files || []))}
                />
              </Button>
            </Stack>

            {pendingFiles.length > 0 ? (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: 'rgba(34, 211, 238, 0.3)', bgcolor: 'rgba(34, 211, 238, 0.08)' }}>
                <Typography variant="caption" sx={{ color: '#a5f3fc' }}>
                  Новые файлы: {pendingFiles.length} (сохранятся после «Сохранить карточку товара»)
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 1 }}>
                  {pendingFiles.map((file) => (
                    <Typography
                      key={`${file.name}-${file.lastModified}-${file.size}`}
                      variant="caption"
                      sx={{ color: '#e0f2fe' }}
                    >
                      {file.name} · {formatFileSize(file.size)}
                    </Typography>
                  ))}
                </Stack>
              </Paper>
            ) : null}

            <Grid container spacing={1.25}>
              {selectedGallery.map((url, index) => {
                const isMain =
                  selectedProduct.coverImage === url ||
                  (!selectedProduct.coverImage && index === 0);
                const isDragSource = galleryDragSource === index;
                const isDragTarget = galleryDragTarget === index;

                return (
                  <Grid key={url} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      draggable={!galleryReordering}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(index));
                        setGalleryDragSource(index);
                        setGalleryDragTarget(index);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        if (galleryDragTarget !== index) setGalleryDragTarget(index);
                      }}
                      onDrop={(event) => {
                        void handleGalleryDrop(index, event);
                      }}
                      onDragEnd={() => {
                        setGalleryDragSource(null);
                        setGalleryDragTarget(null);
                      }}
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        borderColor: isDragTarget
                          ? 'rgba(34, 211, 238, 0.8)'
                          : 'rgba(148, 163, 184, 0.24)',
                        bgcolor: isDragSource ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.6)',
                        opacity: isDragSource ? 0.65 : 1,
                      }}
                    >
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
                            Позиция {index + 1}
                          </Typography>
                          <Typography variant="caption" sx={{ color: isMain ? '#86efac' : '#cbd5e1' }}>
                            {isMain ? 'Главная' : 'Обычная'}
                          </Typography>
                        </Stack>
                        <Box
                          component="img"
                          src={resolveMediaUrl(url) || ''}
                          alt={`product-${index + 1}`}
                          sx={{ width: '100%', height: 136, borderRadius: 1.5, objectFit: 'cover', bgcolor: 'rgba(2, 6, 23, 0.55)' }}
                        />
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={isMain}
                            onClick={() => void setCover(url)}
                            sx={{
                              textTransform: 'none',
                              borderRadius: 1.5,
                              ...(isMain
                                ? {
                                    color: '#dcfce7',
                                    borderColor: 'rgba(74, 222, 128, 0.75)',
                                    bgcolor: 'rgba(22, 101, 52, 0.28)',
                                    '&.Mui-disabled': {
                                      color: '#dcfce7',
                                      borderColor: 'rgba(74, 222, 128, 0.75)',
                                      bgcolor: 'rgba(22, 101, 52, 0.28)',
                                    },
                                  }
                                : {}),
                            }}
                          >
                            {isMain ? 'Главная фотография' : 'Сделать главной'}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => void removeImage(url)}
                            sx={{ textTransform: 'none', borderRadius: 1.5 }}
                          >
                            Удалить
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => void setPreviewFromGallery(url)}
                            sx={{ textTransform: 'none', borderRadius: 1.5 }}
                          >
                            В превью
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {galleryReordering ? (
        <Typography variant="caption" sx={{ color: '#a5f3fc' }}>
          Сохраняю новый порядок фото...
        </Typography>
      ) : null}

      <Button
        variant="contained"
        onClick={saveSelectedProduct}
        disabled={savingProduct}
        sx={{ textTransform: 'none', borderRadius: 2, alignSelf: 'flex-start' }}
      >
        {savingProduct ? 'Сохраняем...' : 'Сохранить карточку товара'}
      </Button>
    </Stack>
  ) : (
    <Alert severity="info" sx={{ bgcolor: 'rgba(2, 132, 199, 0.15)', color: '#dbeafe', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
      Выберите товар в вкладке «Контент», чтобы управлять превью и галереей.
    </Alert>
  );

  const editorStock = selectedProduct && productDraft ? (
    <Stack spacing={2.5}>
      <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(148, 163, 184, 0.26)', bgcolor: 'rgba(2, 6, 23, 0.36)' }}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Варианты памяти
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.88)' }}>
                  Цены и остатки переключаются по выбранному варианту на витрине.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" onClick={addVariantRow} sx={{ textTransform: 'none', borderRadius: 2 }}>
                  Добавить вариант
                </Button>
                <Button variant="outlined" onClick={applyMemoryTemplate} sx={{ textTransform: 'none', borderRadius: 2 }}>
                  Шаблон 512/1024
                </Button>
              </Stack>
            </Stack>

            {productDraft.variants.length > 0 ? (
              <Stack spacing={1.25}>
                <Grid
                  container
                  spacing={1.1}
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    px: 0.5,
                  }}
                >
                  <Grid size={{ md: 2 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'rgba(148, 163, 184, 0.95)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      Память
                    </Typography>
                  </Grid>
                  <Grid size={{ md: 2 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'rgba(148, 163, 184, 0.95)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      Key
                    </Typography>
                  </Grid>
                  <Grid size={{ md: 3 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'rgba(148, 163, 184, 0.95)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      Название
                    </Typography>
                  </Grid>
                  <Grid size={{ md: 2 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'rgba(148, 163, 184, 0.95)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      Цена
                    </Typography>
                  </Grid>
                  <Grid size={{ md: 1 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'rgba(148, 163, 184, 0.95)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      Остаток
                    </Typography>
                  </Grid>
                  <Grid size={{ md: 1 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'rgba(148, 163, 184, 0.95)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      По умолчанию
                    </Typography>
                  </Grid>
                  <Grid size={{ md: 1 }}>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{ color: 'rgba(148, 163, 184, 0.95)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      Действие
                    </Typography>
                  </Grid>
                </Grid>
                {productDraft.variants.map((variant, index) => (
                  <Paper
                    key={`${variant.key}-${index}`}
                    variant="outlined"
                    sx={{ p: 1.25, borderRadius: 2, borderColor: 'rgba(148, 163, 184, 0.24)', bgcolor: 'rgba(15, 23, 42, 0.55)' }}
                  >
                    <Grid container spacing={1.1} alignItems="center">
                      <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Память"
                          value={variant.memoryGb ?? 0}
                          onChange={(event) => {
                            const memoryGb = Math.max(1, Number(event.target.value || 1));
                            patchVariantRow(index, {
                              memoryGb,
                              key: toVariantKey(memoryGb),
                              label: `${memoryGb} GB`,
                            });
                          }}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Key"
                          value={variant.key}
                          onChange={(event) => patchVariantRow(index, { key: event.target.value.toLowerCase() })}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 12, md: 3 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Название"
                          value={variant.label}
                          onChange={(event) => patchVariantRow(index, { label: event.target.value })}
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label="Цена"
                          value={variant.price}
                          onChange={(event) =>
                            patchVariantRow(index, { price: Math.max(0, Number(event.target.value)) })
                          }
                          sx={fieldSx}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3, md: 1 }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            py: 0.7,
                            px: 1,
                            borderRadius: 1.5,
                            borderColor: 'rgba(148, 163, 184, 0.25)',
                            bgcolor: 'rgba(2, 6, 23, 0.5)',
                            textAlign: 'center',
                            minHeight: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                            {variant.stock}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 1 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent={{ xs: 'flex-start', md: 'center' }}
                          spacing={0.25}
                          sx={{ minHeight: 40, minWidth: 0, width: '100%', overflow: 'hidden', flexWrap: 'nowrap' }}
                        >
                          <Switch
                            size="small"
                            checked={variant.isDefault}
                            onChange={() => setDefaultVariantRow(index)}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#cbd5e1',
                              display: { xs: 'inline', md: 'none' },
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            По умолчанию
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 1 }}>
                        <Button
                          fullWidth
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => removeVariantRow(index)}
                          sx={{
                            textTransform: 'none',
                            borderRadius: 1.5,
                            minWidth: 92,
                            height: 40,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Удалить
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Alert severity="warning" sx={{ bgcolor: 'rgba(251, 146, 60, 0.15)', color: '#ffedd5', border: '1px solid rgba(251, 146, 60, 0.35)' }}>
                Варианты не заданы. Будет использована одна общая цена товара.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(34, 211, 238, 0.3)', bgcolor: 'rgba(6, 182, 212, 0.06)' }}>
        <CardContent sx={{ p: 2.25 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ color: '#ecfeff', fontWeight: 700 }}>
              Привязка наличия со склада
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.88)' }}>
              Карточка витрины хранится отдельно. Здесь можно прикрепить реальные складские единицы.
            </Typography>

            <Grid container spacing={1.25}>
              <Grid size={{ xs: 12, md: selectedStoreVariants.length > 0 ? 5 : 7 }}>
                <FormControl fullWidth size="small" sx={fieldSx}>
                  <InputLabel id="warehouse-source-label">Складская позиция</InputLabel>
                  <Select
                    labelId="warehouse-source-label"
                    label="Складская позиция"
                    value={warehouseSourceId}
                    onChange={(event) => setWarehouseSourceId(String(event.target.value))}
                  >
                    <MenuItem value="">Не выбрана</MenuItem>
                    {warehouseProducts
                      .filter(
                        (item) => item.id !== selectedProduct.id && Math.max(0, Number(item.stock || 0)) > 0,
                      )
                      .map((item) => (
                        <MenuItem key={item.id} value={String(item.id)}>
                          #{item.id} · {item.name} · {Math.max(0, Number(item.stock || 0))} шт
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              {selectedStoreVariants.length > 0 ? (
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControl fullWidth size="small" sx={fieldSx}>
                    <InputLabel id="warehouse-target-variant-label">Вариант витрины</InputLabel>
                    <Select
                      labelId="warehouse-target-variant-label"
                      label="Вариант витрины"
                      value={warehouseTargetVariantKey}
                      onChange={(event) => setWarehouseTargetVariantKey(String(event.target.value))}
                    >
                      {selectedStoreVariants.map((variant) => (
                        <MenuItem key={variant.key} value={variant.key}>
                          {variant.label}
                          {variant.isDefault ? ' · По умолчанию' : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, md: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Количество"
                  value={warehouseAttachQty}
                  onChange={(event) => setWarehouseAttachQty(event.target.value)}
                  sx={fieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, md: selectedStoreVariants.length > 0 ? 2 : 3 }}>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={
                    !selectedProduct.storefrontCategory ||
                    !warehouseSourceId ||
                    attachingWarehouse ||
                    (selectedStoreVariants.length > 0 && !warehouseTargetVariantKey)
                  }
                  onClick={() => void attachStockFromWarehouse()}
                  sx={{ textTransform: 'none', borderRadius: 2, height: 40 }}
                >
                  {attachingWarehouse ? 'Переносим...' : 'Прикрепить'}
                </Button>
              </Grid>
            </Grid>

            {selectedWarehouseProduct ? (
              <Typography variant="caption" sx={{ color: '#a5f3fc' }}>
                Источник: #{selectedWarehouseProduct.id} · {selectedWarehouseProduct.name}
              </Typography>
            ) : null}
            {selectedStoreVariants.length > 0 ? (
              <Typography variant="caption" sx={{ color: '#a5f3fc' }}>
                Вариант витрины:{' '}
                {selectedStoreVariants.find((variant) => variant.key === warehouseTargetVariantKey)?.label || '—'}
              </Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        onClick={saveSelectedProduct}
        disabled={savingProduct}
        sx={{ textTransform: 'none', borderRadius: 2, alignSelf: 'flex-start' }}
      >
        {savingProduct ? 'Сохраняем...' : 'Сохранить карточку товара'}
      </Button>
    </Stack>
  ) : (
    <Alert severity="info" sx={{ bgcolor: 'rgba(2, 132, 199, 0.15)', color: '#dbeafe', border: '1px solid rgba(56, 189, 248, 0.35)' }}>
      Для редактирования вариантов и привязки склада выберите товар в вкладке «Контент».
    </Alert>
  );

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
      <Stack spacing={2.5}>
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            borderColor: 'rgba(148, 163, 184, 0.24)',
            bgcolor: 'rgba(15, 23, 42, 0.58)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Stack direction={{ xs: 'column', xl: 'row' }} gap={2.25} justifyContent="space-between">
            <Box>
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800 }}>
                Конструктор витрины
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(203, 213, 225, 0.9)', mt: 0.55 }}>
                Управляйте блоками, товарными карточками, фото и акциями в структурированном редакторе.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Paper
                variant="outlined"
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  borderColor: 'rgba(148, 163, 184, 0.2)',
                  bgcolor: 'rgba(2, 6, 23, 0.35)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                  Всего блоков
                </Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
                  {totalBlocks}
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  borderColor: 'rgba(45, 212, 191, 0.26)',
                  bgcolor: 'rgba(15, 118, 110, 0.16)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#99f6e4', display: 'block' }}>
                  Активные
                </Typography>
                <Typography variant="h6" sx={{ color: '#ccfbf1', fontWeight: 700, lineHeight: 1.2 }}>
                  {totalActiveBlocks}
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  borderColor: 'rgba(251, 146, 60, 0.28)',
                  bgcolor: 'rgba(249, 115, 22, 0.12)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#fed7aa', display: 'block' }}>
                  Акционные
                </Typography>
                <Typography variant="h6" sx={{ color: '#ffedd5', fontWeight: 700, lineHeight: 1.2 }}>
                  {totalPromotionBlocks}
                </Typography>
              </Paper>
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, xl: 8 }}>
            <StorefrontBlocksList
              loading={loading}
              items={visibleItems}
              blockSearch={blockSearch}
              onBlockSearchChange={setBlockSearch}
              blockCategoryFilter={blockCategoryFilter}
              onBlockCategoryFilterChange={setBlockCategoryFilter}
              blockCategoryOptions={blockCategoryOptions}
              blockSort={blockSort}
              onBlockSortChange={setBlockSort}
              filter={filter}
              onFilterChange={setFilter}
              storefrontCategoryLabel={storefrontCategoryLabel}
              onOpenCreate={openCreateEditor}
              onRefresh={() => void loadFeatured()}
              onAutoBind={() => void autoBindUnlinkedBlocks(true)}
              onEdit={openBlockEditor}
              onToggleActive={(item) => void toggleFeaturedActive(item)}
              onDelete={(item) => setDeleteCandidate(item)}
              resolveMediaUrl={resolveMediaUrl}
            />
          </Grid>
          <Grid size={{ xs: 12, xl: 4 }}>
            <Stack spacing={2.5}>
              <StorefrontPreviewPanel
                preview={{
                  ...previewPayload,
                  image: resolveMediaUrl(previewPayload.image) || null,
                }}
                selectedProductName={selectedProduct?.name || null}
                selectedCategoryLabel={selectedCategoryLabel}
                mode={editorMode}
                blockId={editingFeaturedId}
                hasUnsavedChanges={hasUnsavedChanges}
              />

              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 3,
                  borderColor: 'rgba(148, 163, 184, 0.24)',
                  bgcolor: 'rgba(15, 23, 42, 0.58)',
                }}
              >
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700 }}>
                  Быстрый доступ к редактору товара
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(203, 213, 225, 0.88)', mt: 0.5 }}>
                  Выберите блок в списке и нажмите «Редактировать», затем переключитесь на вкладки
                  «Медиа» и «Склад и варианты».
                </Typography>
                {selectedProduct ? (
                  <Box sx={{ mt: 1.5 }}>
                    <StorefrontPreviewCard
                      title={selectedProduct.name}
                      subtitle={selectedProduct.model || selectedProduct.version || ''}
                      price={formatPrice(selectedProduct.price)}
                      image={resolveMediaUrl(selectedProduct.previewImage || selectedProduct.coverImage) || null}
                    />
                  </Box>
                ) : null}
              </Paper>
            </Stack>
          </Grid>
        </Grid>

        <StorefrontEditorDrawer
          open={editorOpen}
          mode={editorMode}
          blockId={editingFeaturedId}
          tab={editorTab}
          onTabChange={setEditorTab}
          onClose={requestCloseEditor}
          hasUnsavedChanges={hasUnsavedChanges}
          content={editorContent}
          media={editorMedia}
          stock={editorStock}
        />

        <Dialog
          open={closeConfirmOpen}
          onClose={() => setCloseConfirmOpen(false)}
          PaperProps={{
            sx: {
              bgcolor: '#0f172a',
              color: '#fff',
              border: '1px solid rgba(148, 163, 184, 0.24)',
            },
          }}
        >
          <DialogTitle>Закрыть редактор?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'rgba(226, 232, 240, 0.88)' }}>
              Есть несохраненные изменения. Если закрыть сейчас, они будут потеряны.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseConfirmOpen(false)} sx={{ textTransform: 'none' }}>
              Остаться
            </Button>
            <Button color="error" onClick={closeEditorImmediately} sx={{ textTransform: 'none' }}>
              Закрыть без сохранения
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteCandidate)}
          onClose={() => setDeleteCandidate(null)}
          PaperProps={{
            sx: {
              bgcolor: '#0f172a',
              color: '#fff',
              border: '1px solid rgba(248, 113, 113, 0.35)',
            },
          }}
        >
          <DialogTitle>Удалить блок витрины?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'rgba(226, 232, 240, 0.88)' }}>
              Блок #{deleteCandidate?.id} будет удален без возможности восстановления.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteCandidate(null)} sx={{ textTransform: 'none' }}>
              Отмена
            </Button>
            <Button color="error" onClick={() => void removeFeaturedWithConfirm()} sx={{ textTransform: 'none' }}>
              Удалить
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </ProtectedRoute>
  );
}
