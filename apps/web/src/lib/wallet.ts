// The actual wallet-ledger primitives live in packages/database so both
// this app and the worker's background jobs (e.g. promotional-coin
// expiration) write through the exact same code — re-exported here so
// every existing import path in this app (./wallet) keeps working
// unchanged.
export { getOrCreateWallet, getWalletBalance, recordWalletTransaction, getPlatformUserId, PLATFORM_SYSTEM_EMAIL, isUniqueConstraintViolation } from "@cinerra/database";
export type { RecordWalletTransactionParams } from "@cinerra/database";
