export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootPage() {
  // Root routing is handled by middleware to avoid duplicate redirects
  // and header races on Safari/PWA restores.
  return null;
}
