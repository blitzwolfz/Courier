export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type BodyType = 'none' | 'json' | 'xml' | 'text' | 'html' | 'javascript' | 'form-data' | 'x-www-form-urlencoded' | 'binary' | 'graphql';

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2' | 'digest';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface AuthConfig {
  type: AuthType;
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: { token: string; headerPrefix: string };
  digest?: { username: string; password: string };
}

export interface RequestBody {
  type: BodyType;
  content: string;
}

export interface RequestData {
  id: string;
  collectionId: string | null;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  preRequestScript: string;
  testScript: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyRequest(id: string): RequestData {
  return {
    id,
    collectionId: null,
    name: 'New Request',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { type: 'none', content: '' },
    auth: { type: 'none' },
    preRequestScript: '',
    testScript: '',
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'var(--color-success)',
  POST: 'var(--color-post)',
  PUT: 'var(--color-put)',
  PATCH: 'var(--color-patch)',
  DELETE: 'var(--color-delete)',
  HEAD: 'var(--color-gray)',
  OPTIONS: 'var(--color-gray)',
};
