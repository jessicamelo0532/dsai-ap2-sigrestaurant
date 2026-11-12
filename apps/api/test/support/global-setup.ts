import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertTestDatabase } from './database-guard';

// Roda uma vez antes de toda a suíte: confere o banco e aplica as migrações.
export default function setup() {
  const databaseUrl = assertTestDatabase(process.env.DATABASE_URL);
  const apiDirectory = fileURLToPath(new URL('../..', import.meta.url));
  execSync('npx prisma migrate deploy', {
    cwd: apiDirectory,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
