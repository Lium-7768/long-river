/** 档案条目的 URL slug（用 name 编码，朝代内唯一）*/
export function itemSlug(name: string): string {
  return encodeURIComponent(name);
}
