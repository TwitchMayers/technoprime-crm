export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  // ✅ ВАЖНО: Все запросы идут через наш фронтенд-прокси
  // /api/sharing-systems → /api/sharing-systems (frontend) → http://localhost:4000/api/sharing-systems (backend)
  
  let fullUrl: string;

  // Правильная обработка URL
  if (url.startsWith('http')) {
    // Прямой URL, оставляем как есть (для внешних API)
    fullUrl = url;
  } else if (url.startsWith('/api/')) {
    // Если уже начинается с /api/, используем как есть
    // Пример: /api/analytics/overview → /api/analytics/overview
    fullUrl = url;
  } else {
    // Если без /api/, добавляем его
    // Пример: analytics/overview → /api/analytics/overview
    fullUrl = `/api/${url.startsWith('/') ? url.slice(1) : url}`;
  }

  // Получаем токен из localStorage
  const token = typeof window !== 'undefined' 
    ? localStorage.getItem('token') 
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  };

  console.log(`🔍 Fetch: ${options.method || 'GET'} ${fullUrl}`);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: 'include',
      cache: 'no-store', // Отключаем кэширование для динамических данных
    });

    console.log(`📡 Response: ${response.status} ${response.statusText}`);

    // Обработка 401 (Unauthorized)
    if (response.status === 401) {
      console.log('❌ Unauthorized - очищаем токен');
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Редирект на логин, если не на странице логина
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      
      throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
    }

    // Обработка других ошибок
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        }
      } catch {
        // Не удалось распарсить JSON, оставляем стандартное сообщение
      }
      
      throw new Error(errorMessage);
    }

    // Проверяем Content-Type для пустых ответов
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Если ответ не JSON (например, 204 No Content)
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Fetch error:', error);
    
    // Прокидываем ошибку дальше для обработки в компонентах
    throw error;
  }
}