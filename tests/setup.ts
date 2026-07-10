process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/kai_ads_test";
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-32";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.EMAIL_PROVIDER ??= "none";
process.env.STORAGE_PROVIDER ??= "none";
// Gives tests a valid "our own storage" host to use with fetchAndProcessSourceFile's SSRF allowlist.
process.env.STORAGE_PUBLIC_URL ??= "https://storage.example.com";
