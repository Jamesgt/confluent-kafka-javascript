import { DekClient, Dek, Kek } from "./dekregistry-client";
import { MOCK_TS } from "./constants";
import stringify from "json-stringify-deterministic";
import {RestError} from "../../../rest-error";
import {ClientConfig} from "../../../rest-service";

class MockDekRegistryClient implements DekClient {
  private clientConfig?: ClientConfig;
  private kekCache: Map<string, Kek>;
  private dekCache: Map<string, Dek>;

  constructor(config?: ClientConfig) {
    this.clientConfig = config
    this.kekCache = new Map<string, Kek>();
    this.dekCache = new Map<string, Dek>();
  }

  config(): ClientConfig {
    return this.clientConfig!;
  }

  async registerKek(name: string, kmsType: string, kmsKeyId: string, shared: boolean,
    kmsProps?: { [key: string]: string }, doc?: string): Promise<Kek> {
    const cacheKey = stringify({ name, deleted: false });
    const cachedKek = this.kekCache.get(cacheKey);
    if (cachedKek) {
      return cachedKek;
    }

    const kek: Kek = {
      name,
      kmsType,
      kmsKeyId,
      ...kmsProps && { kmsProps },
      ...doc && { doc },
      shared
    };

    this.kekCache.set(cacheKey, kek);
    return kek;
  }

  async getKek(name: string, deleted: boolean = false): Promise<Kek> {
    const cacheKey = stringify({ name, deleted });
    const cachedKek = this.kekCache.get(cacheKey);
    if (cachedKek && (!cachedKek.deleted || deleted)) {
      return cachedKek;
    }

    throw new RestError(`Kek not found: ${name}`, 404, 40400);
  }

  async registerDek(kekName: string, subject: string, algorithm: string,
    version: number = 1, encryptedKeyMaterial?: string): Promise<Dek> {
    const cacheKey = stringify({ kekName, subject, version, algorithm, deleted: false });
    const cachedDek = this.dekCache.get(cacheKey);
    if (cachedDek) {
      return cachedDek;
    }

    const dek: Dek = {
      kekName,
      subject,
      algorithm,
      ...encryptedKeyMaterial && { encryptedKeyMaterial },
      version,
      ts: MOCK_TS
    };

    this.dekCache.set(cacheKey, dek);
    return dek;
  }

  async getDek(kekName: string, subject: string,
    algorithm: string, version: number = 1, deleted: boolean = false): Promise<Dek> {
    if (version === -1) {
      let latestVersion = 0;
      for (const key of this.dekCache.keys()) {
        const parsedKey = JSON.parse(key);
        if (parsedKey.kekName === kekName && parsedKey.subject === subject
          && parsedKey.algorithm === algorithm && parsedKey.deleted === deleted) {
          latestVersion = Math.max(latestVersion, parsedKey.version);
        }
      }
      if (latestVersion === 0) {
        throw new RestError(`Dek not found: ${subject}`, 404, 40400);
      }
      version = latestVersion;
    }

    const cacheKey = stringify({ kekName, subject, version, algorithm, deleted: false });
    const cachedDek = this.dekCache.get(cacheKey);
    if (cachedDek) {
      return cachedDek;
    }

    throw new RestError(`Dek not found: ${subject}`, 404, 40400);
  }

  async getDekEncryptedKeyMaterialBytes(dek: Dek): Promise<Buffer | null> {
    if (!dek.encryptedKeyMaterial) {
      return null;
    }

    if (!dek.encryptedKeyMaterialBytes) {
      try {
        const bytes = Buffer.from(dek.encryptedKeyMaterial!, 'base64');
        dek.encryptedKeyMaterialBytes = bytes;
      } catch (err) {
        if (err instanceof Error) {
          throw new Error(`Failed to decode base64 string: ${err.message}`);
        }
        throw new Error(`Unknown error: ${err}`);
      }
    }

    return dek.encryptedKeyMaterialBytes!;
  }

  async getDekKeyMaterialBytes(dek: Dek): Promise<Buffer | null> {
    if (!dek.keyMaterial) {
      return null;
    }

    if (!dek.keyMaterialBytes) {
      try {
        const bytes = Buffer.from(dek.keyMaterial!, 'base64');
        dek.keyMaterialBytes = bytes;
      } catch (err) {
        if (err instanceof Error) {
          throw new Error(`Failed to decode base64 string: ${err.message}`);
        }
        throw new Error(`Unknown error: ${err}`);
      }
    }

    return dek.keyMaterialBytes!;
  }

  async setDekKeyMaterial(dek: Dek, keyMaterialBytes: Buffer): Promise<void> {
    if (keyMaterialBytes) {
      const str = keyMaterialBytes.toString('base64');
      dek.keyMaterial = str;
    }
  }

  async close() {
    return;
  }
}

export { MockDekRegistryClient };
