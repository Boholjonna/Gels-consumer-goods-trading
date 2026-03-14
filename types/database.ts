export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'collector' | 'admin';
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  unit: string;
  carton_size: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
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
  profiles?: { full_name: string; email: string } | null;
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

export interface InventoryLog {
  id: string;
  product_id: string;
  change_amount: number;
  reason: string;
  reference_id: string | null;
  performed_by: string;
  created_at: string;
}
