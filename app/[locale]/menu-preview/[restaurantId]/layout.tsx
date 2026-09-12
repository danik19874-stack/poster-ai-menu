import { CartProvider } from "./CartContext";
import styles from "./guestFrame.module.css";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return (
    <CartProvider restaurantId={restaurantId}>
      <div className={styles.frame}>{children}</div>
    </CartProvider>
  );
}
