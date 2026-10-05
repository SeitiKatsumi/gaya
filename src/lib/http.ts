const firstHeaderValue = (value: string | null) => value?.split(',')[0]?.trim() || '';

export function publicOrigin(req: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return new URL(configured).origin;

  const forwardedHost = firstHeaderValue(req.headers.get('x-forwarded-host'));
  const forwardedProto = firstHeaderValue(req.headers.get('x-forwarded-proto'));
  if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`;

  const host = firstHeaderValue(req.headers.get('host'));
  if (host) {
    const protocol = forwardedProto || new URL(req.url).protocol.replace(':', '');
    return `${protocol}://${host}`;
  }

  return new URL(req.url).origin;
}

export function appUrl(req: Request, pathname: string) {
  return new URL(pathname, `${publicOrigin(req)}/`);
}
