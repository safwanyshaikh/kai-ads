-- Advertisement JSON: the single internal representation of an advertisement.
-- Nullable so every existing advertisement keeps working; a document is
-- written the next time the advertisement is generated.
ALTER TABLE "advertisements" ADD COLUMN "documentJson" JSONB;

-- The background artwork, kept apart from the finished advertisement so an
-- edit re-renders over existing artwork instead of buying new artwork.
ALTER TABLE "advertisements" ADD COLUMN "backgroundAssetUrl" TEXT;

-- Denormalised from documentJson for filtering and reporting only.
ALTER TABLE "advertisements" ADD COLUMN "designDnaId" TEXT;
