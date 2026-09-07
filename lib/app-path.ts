// The explicit prefix also works when the canonical URL has no trailing slash.
export const APP_BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH || '';
export const appAsset = (path: string) => `${APP_BASE_PATH}/${path}`;
