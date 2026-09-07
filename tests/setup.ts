import "dotenv/config";

// Encryption key for tests that exercise credential encryption without
// requiring a real .env value to be present.
if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
  process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
}
