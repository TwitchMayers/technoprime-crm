'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash, ArrowLeft, Package, Truck, User, CreditCard, MapPin, MessageSquare, ShoppingCart, ChevronDown, Search, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

const DELIVERY_SERVICES_LIST = [
  { value: 'YANDEX', label: 'Яндекс Доставка', color: 'from-yellow-500 to-orange-500' },
  { value: 'AVITO', label: 'Авито Доставка', color: 'from-blue-500 to-cyan-500' },
  { value: 'POST_RUSSIA', label: 'Почта России', color: 'from-red-500 to-pink-500' },
  { value: 'FIVEPOST', label: '5Post', color: 'from-purple-500 to-indigo-500' },
  { value: 'CDEK', label: 'СДЭК', color: 'from-green-500 to-emerald-500' },
  { value: 'BOXBERRY', label: 'Boxberry', color: 'from-amber-500 to-yellow-500' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Наличные', icon: '💵' },
  { value: 'TRANSFER', label: 'Перевод', icon: '💳' },
  { value: 'CARD', label: 'Карта', icon: '💳' },
];

type Client = { 
  id: number; 
  name: string; 
  phone: string;
  city?: string;
  address?: string;
};

type ProductForOrder = {
  id: string;
  productId: number;
  sizeId: number;
  brand: string;
  category: string;
  color: string;
  size: string;
  stock: number;
  price: number;
  costPrice: number;
  imageUrl?: string;
};

export default function NewRichMarketOrderPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<ProductForOrder[]>([]);
  const [clientId, setClientId] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [deliveryService, setDeliveryService] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<Array<{
    productId: number;
    sizeId: number;
    size: string;
    name: string;
    qty: number;
    salePrice: number;
    cost: number;
    imageUrl?: string;
    maxStock: number;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [clientsRes, productsRes] = await Promise.all([
          fetchWithAuth('/api/richmarket/clients?limit=500'),
          fetchWithAuth('/api/richmarket/products/for-order'),
        ]);

        const clientsData = await clientsRes.json();
        const productsData = await productsRes.json();

        setClients(clientsData.items || clientsData || []);
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('Ошибка загрузки данных');
      }
    };
    loadData();
  }, []);

  // Фильтрация клиентов для поиска
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 5);
    return clients
      .filter(client => 
        client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.phone.includes(clientSearch)
      )
      .slice(0, 5);
  }, [clients, clientSearch]);

  // Фильтрация товаров для поиска
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.filter(p => p.stock > 0).slice(0, 10);
    return products
      .filter(p => 
        p.stock > 0 && (
          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.color.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
      .slice(0, 10);
  }, [products, searchQuery]);

  const addProduct = (product: ProductForOrder) => {
    const existingItem = items.find(item => 
      item.productId === product.productId && item.size === product.size
    );

    if (existingItem) {
      if (existingItem.qty >= product.stock) {
        toast.error(`Максимальное количество: ${product.stock}`);
        return;
      }
      
      setItems(prev => prev.map(item =>
        item.productId === product.productId && item.size === product.size
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      const name = `${product.brand} ${product.category} ${product.size} (${product.color})`;
      setItems(prev => [...prev, {
        productId: product.productId,
        sizeId: product.sizeId,
        size: product.size,
        name,
        qty: 1,
        salePrice: product.price,
        cost: product.costPrice,
        imageUrl: product.imageUrl,
        maxStock: product.stock,
      }]);
    }

    setSearchQuery('');
    toast.success('Товар добавлен в заказ');
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    if (newQty > items[index].maxStock) {
      toast.error(`Максимальное количество: ${items[index].maxStock}`);
      return;
    }

    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, qty: newQty } : item
    ));
  };

  const totals = useMemo(() => {
    const sum = items.reduce((s, i) => s + i.salePrice * i.qty, 0);
    const cost = items.reduce((s, i) => s + i.cost * i.qty, 0);
    const profit = sum - cost;
    const margin = sum > 0 ? (profit / sum) * 100 : 0;
    
    return { sum, cost, profit, margin: Math.round(margin) };
  }, [items]);

  const saveOrder = async () => {
    if (!clientId) {
      toast.error('Выберите клиента');
      return;
    }

    if (items.length === 0) {
      toast.error('Добавьте товары в заказ');
      return;
    }

    const orderData = {
      clientId,
      paymentMethod,
      deliveryService: deliveryService || undefined,
      trackingCode: trackingCode || undefined,
      deliveryAddress: deliveryAddress || undefined,
      comment: comment || undefined,
      items: items.map(i => ({ 
        productId: i.productId, 
        size: i.size,
        qty: i.qty, 
        salePrice: i.salePrice 
      })),
    };

    console.log('Creating order:', orderData);

    try {
      const res = await fetchWithAuth('/api/richmarket/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Ошибка создания заказа';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          // Если ответ не JSON, используем текст как есть
          if (errorText) errorMessage = errorText;
        }
        
        toast.error(errorMessage);
        return;
      }

      toast.success('Заказ успешно создан!');
      router.push('/richmarket/orders');
    } catch (err) {
      console.error('Network error:', err);
      toast.error('Ошибка сети при создании заказа');
    }
  };

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setClientId(client.id);
    setClientSearch('');
    setShowClientDropdown(false);
    
    if (client.city || client.address) {
      setDeliveryAddress(`${client.city || ''}${client.city && client.address ? ', ' : ''}${client.address || ''}`);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER']}>
      <div className="space-y-6 pb-32 lg:pb-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.back()}
            className="p-3 rounded-2xl bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 hover:border-slate-600/70 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">
              Новый заказ
            </h1>
            <p className="text-slate-400 text-sm mt-1">Создание заказа на доставку премиальной одежды</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Order Details */}
          <div className="xl:col-span-2 space-y-6">
            {/* Client Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
                  <User className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Клиент</h3>
              </div>

              <div className="relativ z-50">
                <label className="text-sm text-slate-300 mb-3 block font-medium">Выберите клиента *</label>
                <div className="relative z-50">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    placeholder="Поиск по имени или телефону..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className="w-full pl-10 rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>

                <AnimatePresence>
  {showClientDropdown && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 mt-2 bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-2xl z-[100] max-h-60 overflow-y-auto"
    >
                      {filteredClients.map((client) => (
                        <motion.button
                          key={client.id}
                          whileHover={{ backgroundColor: 'rgba(71, 85, 105, 0.5)' }}
                          onClick={() => selectClient(client)}
                          className="w-full p-3 text-left border-b border-slate-700/50 last:border-0 hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="font-medium text-white">{client.name}</div>
                          <div className="text-sm text-slate-400">{client.phone}</div>
                          {(client.city || client.address) && (
                            <div className="text-xs text-slate-500 mt-1">
                              {client.city}{client.address && ` • ${client.address}`}
                            </div>
                          )}
                        </motion.button>
                      ))}
                      {filteredClients.length === 0 && (
                        <div className="p-4 text-center text-slate-400">
                          Клиенты не найдены
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {selectedClient && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-3 p-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl border border-pink-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{selectedClient.name}</div>
                        <div className="text-sm text-pink-400">{selectedClient.phone}</div>
                        {(selectedClient.city || selectedClient.address) && (
                          <div className="text-xs text-slate-400 mt-1">
                            {selectedClient.city}{selectedClient.address && ` • ${selectedClient.address}`}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedClient(null);
                          setClientId(0);
                          setDeliveryAddress('');
                        }}
                        className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Delivery Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Доставка и оплата</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Payment Method */}
                <div>
                  <label className="text-sm text-slate-300 mb-3 block font-medium">Способ оплаты</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <motion.button
                        key={method.value}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPaymentMethod(method.value)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${
                          paymentMethod === method.value
                            ? 'border-pink-500 bg-pink-500/20 text-white'
                            : 'border-slate-600/50 bg-slate-800/50 text-slate-400 hover:border-slate-500/50'
                        }`}
                      >
                        <div className="text-lg mb-1">{method.icon}</div>
                        <div className="text-xs font-medium">{method.label}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Delivery Service */}
                <div>
                  <label className="text-sm text-slate-300 mb-3 block font-medium">Служба доставки</label>
                  <select 
                    value={deliveryService} 
                    onChange={e => setDeliveryService(e.target.value)} 
                    className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white focus:border-pink-500/50 transition-colors"
                  >
                    <option value="">Самовывоз</option>
                    {DELIVERY_SERVICES_LIST.map(service => (
                      <option key={service.value} value={service.value}>
                        {service.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tracking Code */}
                <div>
                  <label className="text-sm text-slate-300 mb-3 block font-medium">Трек-номер</label>
                  <input
                    placeholder="AB123456789RU"
                    value={trackingCode}
                    onChange={e => setTrackingCode(e.target.value)}
                    disabled={!deliveryService}
                    className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors disabled:opacity-50 font-mono"
                  />
                </div>

                {/* Delivery Address */}
                <div className="lg:col-span-2">
                  <label className="text-sm text-slate-300 mb-3 block font-medium">Адрес доставки</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      placeholder="г. Москва, ул. Ленина, д. 1, кв. 5"
                      value={deliveryAddress}
                      onChange={e => setDeliveryAddress(e.target.value)}
                      className="w-full pl-10 rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Comment */}
                <div className="lg:col-span-2">
                  <label className="text-sm text-slate-300 mb-3 block font-medium">Комментарий к заказу</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      placeholder="Примечания для курьера или дополнительная информация..."
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      className="w-full pl-10 rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors resize-none"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Product Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Добавить товары</h3>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  placeholder="Поиск по бренду, категории или цвету..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <motion.button
                    key={product.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addProduct(product)}
                    className="p-3 rounded-xl bg-slate-700/30 border border-slate-600/50 hover:border-pink-500/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      {product.imageUrl && (
                        <img 
                          src={product.imageUrl} 
                          alt={product.brand}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {product.brand}
                        </div>
                        <div className="text-xs text-slate-400">
                          {product.category} • {product.size} • {product.color}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-pink-400 font-semibold">
                            {product.price.toLocaleString()} ₽
                          </span>
                          <span className="text-xs text-slate-500">
                            {product.stock} шт
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    Товары не найдены
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="space-y-6">
            {/* Order Items */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Товары в заказе ({items.length})
                </h3>
              </div>

              <AnimatePresence>
                {items.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12 border-2 border-dashed border-slate-700/50 rounded-xl"
                  >
                    <Package className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <div className="text-slate-400">Добавьте товары в заказ</div>
                  </motion.div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {items.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-xl border border-slate-600/50"
                      >
                        {item.imageUrl && (
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.salePrice.toLocaleString()} ₽ × {item.qty}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg">
                            <button
                              onClick={() => updateQuantity(index, item.qty - 1)}
                              className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                              disabled={item.qty <= 1}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-sm font-medium min-w-8 text-center">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => updateQuantity(index, item.qty + 1)}
                              className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                              disabled={item.qty >= item.maxStock}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeItem(index)}
                            className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 transition-colors"
                          >
                            <Trash className="w-3 h-3 text-rose-400" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 sticky top-6"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Сводка заказа</h3>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Товары:</span>
                  <span className="text-white">{items.length} позиций</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Себестоимость:</span>
                  <span className="text-slate-300">{totals.cost.toLocaleString()} ₽</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Прибыль:</span>
                  <span className="text-green-400 font-semibold">
                    {totals.profit.toLocaleString()} ₽
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Маржа:</span>
                  <span className={`font-semibold ${
                    totals.margin >= 30 ? 'text-green-400' : 
                    totals.margin >= 20 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {totals.margin}%
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-white">Итого:</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
                    {totals.sum.toLocaleString()} ₽
                  </span>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={saveOrder}
                disabled={!clientId || items.length === 0}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-500 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold text-lg shadow-lg shadow-pink-500/25 disabled:shadow-none transition-all disabled:cursor-not-allowed"
              >
                {!clientId ? 'Выберите клиента' : 
                 items.length === 0 ? 'Добавьте товары' : 
                 'Создать заказ'}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

// Добавляем недостающий компонент Minus
const Minus = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
  </svg>
);