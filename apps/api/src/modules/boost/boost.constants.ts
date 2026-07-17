// Kept in its own file (not boost.module.ts) so boost.service.ts can import
// the token without a module<->service circular import -- boost.module.ts
// already imports BoostService, so if BoostService imported the token back
// from boost.module.ts, the two files would require each other. That cycle
// only broke by luck depending on which file got required first (fine when
// boost.service.ts was imported standalone, broken when AppModule pulled in
// BoostModule first, which surfaced as `@Inject(LAMBDA_CLIENT)` resolving to
// undefined at runtime). Mirrors DATA_SOURCE living in database.module.ts,
// which similarly never imports back from the services that inject it.
export const LAMBDA_CLIENT = 'LAMBDA_CLIENT';
