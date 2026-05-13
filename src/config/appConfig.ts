const trimSlash = (value: string): string => value.replace(/\/+$/, '');

const rawStoragePrefix = import.meta.env.VITE_APP_STORAGE_PREFIX || 'operationTicketHelper';
const storagePrefix = trimSlash(rawStoragePrefix.trim()) || 'operationTicketHelper';

export const appConfig = {
  title: import.meta.env.VITE_APP_TITLE || '操作票助手',
  storagePrefix,
};

export const storageKey = (name: string): string => `${appConfig.storagePrefix}.${name}`;
