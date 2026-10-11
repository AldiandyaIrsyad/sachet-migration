# Sachet Migration

Concept web app for the Apple Developer Academy challenge *"How might households cut down on single-use plastic?"*

Scan a sachet product and see a cheaper, lower-plastic swap. Log what you bought and see the money saved and plastic avoided add up.

- Every pack is compared **per serving**: rupiah per cup, grams of plastic per cup.
- Swaps that need extras (sugar and creamer to match a 3-in-1) include them in the price.
- Each swap shows how much of the pack you could waste and still come out cheaper.
- Practical rule, no app needed: **skip the bulk-sachet bag.** It costs about the same per serving and adds more plastic.

Frontend only: Vite + TypeScript, no server. Purchases are stored in the browser's localStorage. Barcode scanning uses ZXing (camera or photo).

## Data

`src/data.ts` holds the sample shelf. Prices and packaging weights are **estimates**; barcodes starting `8990000` are placeholders. Replace them with real shelf prices, real barcodes, and weighed packaging.

## Run

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Push to a GitHub repo on the `main` branch.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push.

## Later

- Plastic-free refill stations ("refill at X near you").
- Crowdsourced prices and unknown barcodes.
