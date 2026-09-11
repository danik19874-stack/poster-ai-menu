import { CartProvider } from "./CartContext";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return <CartProvider restaurantId={restaurantId}>{children}</CartProvider>;
}
