// Load environment variables for tests
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(__dirname, ".env.test") });
