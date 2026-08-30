import { config } from "dotenv";
import path from "path";

// Point every test at the isolated test database before anything imports
// the Prisma singleton, so tests never touch dev/seed data.
config({ path: path.resolve(__dirname, "../.env.test"), override: true });
