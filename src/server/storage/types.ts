export type StorageCategory = "images" | "audio" | "video" | "references";

export interface StorageProvider {
  /** Uploads a buffer and returns a publicly-fetchable URL plus the storage key. */
  put(params: {
    category: StorageCategory;
    filename: string;
    data: Buffer;
    contentType: string;
  }): Promise<{ url: string; key: string }>;

  delete(key: string): Promise<void>;
}
