import "dotenv/config";

// Integration tests run against a separate database; app code reads DATABASE_URL.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
