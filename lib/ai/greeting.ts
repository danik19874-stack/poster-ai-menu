export function buildGreeting(restaurantName: string, description: string): string {
  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    return `Добро пожаловать в ${restaurantName}!`;
  }
  return `Добро пожаловать в ${restaurantName}, ${trimmedDescription}!`;
}
