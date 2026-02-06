export interface Product {
  id: string;
  name: string;
  category: 'tee' | 'hoodie' | 'tote' | 'mug';
  basePrice: number;
  colors: { name: string; hex: string }[];
  sizes: string[] | null;
  printArea: { x: number; y: number; w: number; h: number };
  emoji: string;
}

export const PRODUCTS: Product[] = [
  {
    id: 'classic-tee',
    name: 'Classic Tee',
    category: 'tee',
    basePrice: 19.99,
    colors: [
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'White', hex: '#f5f5f5' },
      { name: 'Navy', hex: '#1e3a5f' },
      { name: 'Forest', hex: '#2d5016' },
      { name: 'Burgundy', hex: '#6b1f3a' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
    printArea: { x: 30, y: 25, w: 40, h: 45 },
    emoji: '👕'
  },
  {
    id: 'hoodie',
    name: 'Comfort Hoodie',
    category: 'hoodie',
    basePrice: 39.99,
    colors: [
      { name: 'Black', hex: '#1a1a1a' },
      { name: 'Charcoal', hex: '#4a4a4a' },
      { name: 'Navy', hex: '#1e3a5f' },
      { name: 'Burgundy', hex: '#6b1f3a' },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    printArea: { x: 30, y: 28, w: 40, h: 40 },
    emoji: '🧥'
  },
  {
    id: 'tote',
    name: 'Canvas Tote',
    category: 'tote',
    basePrice: 14.99,
    colors: [
      { name: 'Natural', hex: '#f5f1e8' },
      { name: 'Black', hex: '#1a1a1a' },
    ],
    sizes: null,
    printArea: { x: 25, y: 35, w: 50, h: 35 },
    emoji: '👜'
  },
  {
    id: 'mug',
    name: 'Ceramic Mug',
    category: 'mug',
    basePrice: 12.99,
    colors: [
      { name: 'White', hex: '#ffffff' },
      { name: 'Black', hex: '#1a1a1a' },
    ],
    sizes: null,
    printArea: { x: 20, y: 30, w: 60, h: 40 },
    emoji: '☕'
  }
];

export const PRINT_FEE = 3.00;
