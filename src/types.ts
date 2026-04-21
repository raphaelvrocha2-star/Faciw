export interface Merchant {
  id: string;
  ownerId: string;
  name: string;
  email: string;
  address: string;
  phone: string;
  isSubscribed: boolean;
  plan?: 'free' | 'pro' | 'premium';
  location?: {
    lat: number;
    lng: number;
  };
  rating?: number;
  reviewCount?: number;
  openingHours?: string;
}

export interface Product {
  id: string;
  merchantId: string;
  name: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  unit: string;
  imageUrl?: string;
  category?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  recommendations: Product[];
  createdAt: number;
}

export interface ShoppingItem extends Product {
  quantity: number;
  addedAt: number;
  purchased?: boolean;
}
