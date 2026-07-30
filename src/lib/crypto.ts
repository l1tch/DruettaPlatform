import crypto from "crypto";

// Cifratura simmetrica AES-256-GCM per campi sensibili (es. codice fiscale) a
// livello applicativo, cosi' i dati restano protetti anche in caso di accesso
// diretto al database (dump, backup, ecc.) - requisito minimo per uno studio
// legale che tratta dati personali/giudiziari (GDPR art. 32).

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY non configurata. Generarla con: openssl rand -hex 32"
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("FIELD_ENCRYPTION_KEY deve essere una stringa esadecimale di 64 caratteri (32 byte).");
  }
  return key;
}

export interface CipherPayload {
  iv: string;
  tag: string;
  data: string;
}

export function encryptField(plainText: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: CipherPayload = {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
  return JSON.stringify(payload);
}

export function decryptField(cipherText: string | null | undefined): string | null {
  if (!cipherText) return null;
  const key = getKey();
  let payload: CipherPayload;
  try {
    payload = JSON.parse(cipherText);
  } catch {
    return null;
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
