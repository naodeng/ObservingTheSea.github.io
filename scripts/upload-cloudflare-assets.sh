#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/apps/web/public"

: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID to the Cloudflare account ID}"
: "${CF_R2_BUCKET:?Set CF_R2_BUCKET to the R2 bucket name}"
: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID to the R2 access key ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY to the R2 secret access key}"

if ! command -v aws >/dev/null 2>&1; then
  echo "Install the AWS CLI before uploading assets to R2." >&2
  exit 1
fi

for directory in audio story-images textbook-pages; do
  if [ ! -d "$PUBLIC_DIR/$directory" ]; then
    echo "Missing $PUBLIC_DIR/$directory. Run bash scripts/download-assets.sh v1.2.0-assets first." >&2
    exit 1
  fi
done

ENDPOINT_URL="https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com"

aws s3 sync "$PUBLIC_DIR/audio/" "s3://${CF_R2_BUCKET}/audio/" \
  --endpoint-url "$ENDPOINT_URL" --region auto --no-guess-mime-type \
  --content-type "audio/ogg" \
  --cache-control "public, max-age=31536000, immutable" --only-show-errors

aws s3 sync "$PUBLIC_DIR/story-images/" "s3://${CF_R2_BUCKET}/story-images/" \
  --endpoint-url "$ENDPOINT_URL" --region auto \
  --cache-control "public, max-age=86400" --only-show-errors

aws s3 sync "$PUBLIC_DIR/textbook-pages/" "s3://${CF_R2_BUCKET}/textbook-pages/" \
  --endpoint-url "$ENDPOINT_URL" --region auto \
  --cache-control "public, max-age=86400" --only-show-errors
