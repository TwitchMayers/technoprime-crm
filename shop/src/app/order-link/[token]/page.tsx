import OrderLinkClient from './OrderLinkClient';

export default async function OrderLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OrderLinkClient token={token || ''} />;
}
