import type { SharingConsoleType } from '@/lib/sharing';

export type OrderItemProduct = {
  id: number;
  name: string;
  serialNumber?: string;
  category?: string;
  price: number;
};

export type OrderItem = {
  id: number;
  qty: number;
  unitPrice?: number;
  product: OrderItemProduct;
};

export type OrderUser = {
  id: number;
  name: string;
  email?: string;
};

export type ClientOrder = {
  id: number;
  date: string;
  status: string;
  totalPrice: number | string;
  items: OrderItem[];
  createdBy?: OrderUser; // ✅ КТО СОЗДАЛ
  manager?: OrderUser;   // ✅ КТО ВЁЛ / БЫЛ НАЗНАЧЕН
  completedBy?: OrderUser;
};

export type Subscription = {
  id: number;
  type: string;
  endDate: string;
  status: string;
  accountType?: 'PERSONAL' | 'SHARING_CLIENT' | 'SHARING_DONOR';
  clientSlot?: {
    id: number;
    consoleType?: string;
    endDate?: string;
    emailLogin?: string | null;
    emailPassword?: string | null;
    accountPassword?: string | null;
    sharingSystem?: {
      id: number;
      name: string;
      donor?: {
        consoleType?: string;
        endDate?: string;
      };
    };
  };
  donorAccount?: {
    id: number;
    consoleType?: string;
    endDate?: string;
  };
  sharingSystem?: {
    id: number;
    name: string;
    donor: {
	      consoleType?: SharingConsoleType;
      endDate?: string;
    };
  };
};

export type Client = {
  id: number;
  name: string;
  phone: string;
  telegramId?: string | null;
  vkId?: string | null;
  maxId?: string | null;
  marketingConsent?: boolean;
  city?: string;
  address?: string;
  consoleType?: string;
  emailLogin?: string;
  emailPassword?: string;
  accountPassword?: string;
  subscriptions?: Subscription[];
  orders?: ClientOrder[];
  createdAt?: string;
  isActive?: boolean;
};
