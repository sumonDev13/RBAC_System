export function getFrontendUrl(): string {
  return (
    process.env.OAUTH_REDIRECT_FRONTEND ||
    (process.env.FRONTEND_URL ?? '').split(',')[0].trim()
  );
}
