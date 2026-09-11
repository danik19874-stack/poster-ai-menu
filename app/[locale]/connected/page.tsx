import { headers } from "next/headers";
import ConnectedClient from "./ConnectedClient";

export default async function ConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string; name?: string }>;
}) {
  const { restaurant, name } = await searchParams;
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "";

  return (
    <ConnectedClient
      origin={origin}
      restaurantId={restaurant ?? ""}
      restaurantName={name ?? ""}
    />
  );
}
