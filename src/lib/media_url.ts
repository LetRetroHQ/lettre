/** Build a public media URL without treating storage-key characters as URL syntax. */
export function mediaUrl(base: string, key: string): string {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
