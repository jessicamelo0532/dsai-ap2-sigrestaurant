// Trava de segurança (RNF-01 da SPEC 2026-11-12-reativacao-backend):
// os testes apagam dados, então só aceitam bancos cujo nome termina em _test.
export function assertTestDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error('Defina DATABASE_URL apontando para um banco de teste (nome terminado em _test).');
  }
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('DATABASE_URL inválida.');
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Banco "${databaseName}" recusado: os testes apagam dados e só rodam em bancos com nome terminado em _test.`,
    );
  }
  return url;
}
