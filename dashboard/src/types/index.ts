export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'collector' | 'admin';
  phone: string | null;
  is_active: boolean;
  device_connected_at: string | null;
  last_seen_at: string | null;
  nickname: string | null;
  display_id: string | null;
  tag: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivationCode {
  id: string;
  user_id: string;
  code: string;
  is_used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category_id: string;
  price: number;
  stock_quantity: number;
  carton_size: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
}

export interface DailySales {
  id: string;
  product_id: string;
  sale_date: string;
  units_sold: number;
  is_duty_day: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  collector_id: string;
  store_id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; email: string; nickname?: string | null } | null;
  stores?: { name: string; address?: string } | null;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}
