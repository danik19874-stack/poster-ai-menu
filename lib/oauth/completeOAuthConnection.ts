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
  }) => Promise<{ id: string }>;
  syncMenu: (args: { restaurantId: string; posterToken: string }) => Promise<void>;
}

export async function completeOAuthConnection(
  deps: OAuthConnectionDeps,
  args: { account: string; code: string },
): Promise<{ restaurantName: string; restaurantId: string }> {
  const { accessToken, accountNumber } = await deps.exchangeOAuthCode(args.account, args.code);
  const spots = await deps.getSpots(accessToken);

  if (spots.length === 0) {
    throw new Error('This Poster account has no spots to connect');
  }

  // MVP assumption: one Poster spot per restaurant — connects the first spot Poster
  // returns. For a multi-spot account this may not be the spot the owner meant to
  // connect. Revisit if a multi-spot account is ever onboarded via oAuth.
  const spot = spots[0];

  const { id } = await deps.upsertRestaurant({
    posterAccountNumber: accountNumber,
    posterSpotId: spot.spotId,
    posterToken: accessToken,
    name: spot.name,
  });

  try {
    await deps.syncMenu({ restaurantId: id, posterToken: accessToken });
  } catch (err) {
    // The restaurant is already connected at this point — a flaky initial
    // menu sync (Poster network blip, rate limit) must not undo that or
    // block the owner from landing on the success page. Log and move on;
    // the admin "Обновить меню" button covers a manual retry.
    console.error('completeOAuthConnection: initial menu sync failed:', err);
  }

  return { restaurantName: spot.name, restaurantId: id };
}
