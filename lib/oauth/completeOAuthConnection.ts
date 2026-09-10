export interface OAuthConnectionDeps {
  exchangeOAuthCode: (
    account: string,
    code: string,
  ) => Promise<{ accessToken: string; accountNumber: string }>;
  getSpots: (token: string) => Promise<{ spotId: number; name: string; address: string }[]>;
  upsertRestaurant: (restaurant: {
    posterAccountNumber: string;
    posterSpotId: number;
    posterToken: string;
    name: string;
  }) => Promise<void>;
}

export async function completeOAuthConnection(
  deps: OAuthConnectionDeps,
  args: { account: string; code: string },
): Promise<{ restaurantName: string }> {
  const { accessToken, accountNumber } = await deps.exchangeOAuthCode(args.account, args.code);
  const spots = await deps.getSpots(accessToken);

  if (spots.length === 0) {
    throw new Error('This Poster account has no spots to connect');
  }

  const spot = spots[0];

  await deps.upsertRestaurant({
    posterAccountNumber: accountNumber,
    posterSpotId: spot.spotId,
    posterToken: accessToken,
    name: spot.name,
  });

  return { restaurantName: spot.name };
}
