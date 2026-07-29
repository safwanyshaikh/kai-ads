-- Footer Library and Brand Badges.
--
-- Both belong to the agency's permanent brand identity, not to any one
-- advertisement: a footer is a letterhead, not a template. Nothing here
-- touches the creative above the branding strip.
CREATE TYPE "FooterStyle" AS ENUM (
  'CLASSIC_CORPORATE',
  'TRADITIONAL_DTP',
  'INDUSTRIAL_PREMIUM',
  'MODERN_MINIMAL',
  'AI_PREMIUM'
);

ALTER TABLE "agencies" ADD COLUMN "brandBadges" JSONB;
-- Null means KAI selects the footer that best suits each advertisement.
ALTER TABLE "agencies" ADD COLUMN "footerStyle" "FooterStyle";
