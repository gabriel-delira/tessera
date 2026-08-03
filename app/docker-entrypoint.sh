#!/bin/sh
set -e

ADDR_FILE="/app/lib/contracts/addresses.local.json"

if [ -f "$ADDR_FILE" ]; then
  echo "Loading contract addresses from $ADDR_FILE"
  export NEXT_PUBLIC_NFT_ADDRESS=$(node -e "console.log(require('$ADDR_FILE').nft)")
  export NEXT_PUBLIC_SALE_ADDRESS=$(node -e "console.log(require('$ADDR_FILE').sale)")
  export NEXT_PUBLIC_RESALE_ADDRESS=$(node -e "console.log(require('$ADDR_FILE').resale)")
  export USDC_ADDRESS=$(node -e "console.log(require('$ADDR_FILE').usdc)")
else
  echo "WARNING: $ADDR_FILE not found — contracts-deploy may not have finished. Chain calls will fail."
fi

echo "Generating Prisma Client..."
npx prisma generate

echo "Applying migrations..."
npx prisma migrate deploy

echo "Seeding database..."
npx prisma db seed

echo "Starting Next.js dev server..."
exec npx next dev -H 0.0.0.0 -p 3000
