import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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

  let description = "";
  if (restaurant) {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("restaurants")
      .select("description")
      .eq("id", restaurant)
      .single();
    description = data?.description ?? "";
  }

  return (
    <ConnectedClient
      origin={origin}
      restaurantId={restaurant ?? ""}
      restaurantName={name ?? ""}
      initialDescription={description}
    />
  );
}
