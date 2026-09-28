# Euroins partner integration

Set these variables in the backend deployment environment. Never put the client secret in the mobile app or commit it to git:

```env
EUROINS_PARTNER_ENABLED=true
EUROINS_CLIENT_ID=marte-814d708c839c4b
EUROINS_CLIENT_SECRET=<value-from-the-one-time-secret>
```

The backend calls Euroins only after authentication/registration has a valid 11-digit Georgian personal ID. If an active eligible motor policy is found, MARTE grants the user a free Premium subscription and reports `active: true` to Euroins. If a previously eligible user no longer has an eligible policy, the integration reports `active: false`.

The Euroins API server must see the allow-listed source IP `208.77.244.15`; configure this on the production backend/network, not in the Expo app.
