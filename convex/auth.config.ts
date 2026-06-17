// Clerk → Convex auth. The host signs in with Clerk (email magic link); Convex
// validates the Clerk-issued JWT from the "convex" JWT template.
// CLERK_JWT_ISSUER_DOMAIN is set in Convex env (the template's Issuer URL).
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
}

export default authConfig
