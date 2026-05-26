export class CreateOrderDto {
  clientId!: number;
  managerId!: number;
  paymentMethod!: 'CASH' | 'TRANSFER' | 'TRADE_IN';
  comment?: string;
  items!: { productId: number; qty: number; salePrice: number }[];
}
