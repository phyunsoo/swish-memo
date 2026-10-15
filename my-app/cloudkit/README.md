# Swish Memo CloudKit schema

Container: `iCloud.com.phyunsoo.swishmemo` (team `87A9TG46YC`).

On 2026-10-15, CloudKit Console validated and imported this schema into
Development, then confirmed deployment to Production. The reviewed deployment
added three record types and three indexes, with no security-role changes.
See [deployment confirmation](verification/production-deployed.png).

`schema.ckdb` includes the existing `Users` definition and the three app record
types. App data uses `privateCloudDatabase`; app record types deliberately have
no grants in the public database. Each type includes the queryable record ID
index required for fetching its records.

`SwishMemoNote.photoAssets` is a fixed `LIST<ASSET>` field. Its order matches the
photo metadata in the JSON `payload`. Do not introduce per-photo field names:
production CloudKit cannot create schema fields dynamically.

To deploy a schema update:

1. Export the existing development schema in CloudKit Console and retain its
   existing definitions when updating this file.
2. Import `schema.ckdb` into Development and wait for validation and import to
   complete.
3. Use **Deploy Schema Changes** to review and deploy the additive changes to
   Production. Schema deployment does not copy test records.
4. Verify the three app record types and their queryable indexes in Production.

TestFlight uses Production. A successful app upload alone does not initialize
or deploy this schema. The fixed photo field requires the updated native app;
the previously uploaded build 5 still uses the old photo fields.

Reference: [Apple's schema deployment guide](https://developer.apple.com/documentation/cloudkit/deploying-an-icloud-container-s-schema).
