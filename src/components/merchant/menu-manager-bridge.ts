// Type bridge antara MenuManager dan ProfileEditor via parent state.
// Memungkinkan ProfileEditor + MenuManager share info merchant yang sama.
export interface MerchantInfo {
  id: string;
  restaurantName: string;
  description: string | null;
  address: string | null;
  cuisine: string | null;
  logoUrl: string | null;
  promoTag: string | null;
  prepTime: number;
  rating: number;
  isOpen: boolean;
}
