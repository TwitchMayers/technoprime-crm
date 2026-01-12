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
  manager?: OrderUser;   // ✅ КТО ЗАКРЫЛ
};

export type Subscription = {
  id: number;
  type: string;
  endDate: string;
  status: string;
  accountType?: 'PERSONAL' | 'SHARING_CLIENT';
  sharingSystem?: {
    id: number;
    name: string;
    donor: {
      email: string;
      consoleType: 'PS4' | 'PS5';
    };
  };
};

export type Client = {
  id: number;
  name: string;
  phone: string;
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