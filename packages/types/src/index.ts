export type Identifier = string;
export type PermissionCode = string;
export interface ApiEnvelope<T> { data: T; meta?: Record<string, unknown>; }
export interface SessionUser { id:string; name:string; email:string; role:string; branches:{id:string;name:string;code:string}[]; permissions:string[]; }
