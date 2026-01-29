# Trust Verifier

Minimal, deterministic MVP that returns a trust verdict for a product URL.

## Setup

```
npm install
npm run dev
```

## Environment

Create a `.env.local` from `.env.example` for production usage:

```
MINO_API_URL="https://api.mino.ai/agent"
MINO_API_KEY="your_mino_api_key_here"
```

## Development mode (free)

In non-production, the app only supports these test URLs and never calls Mino:

- `https://example.com/product/clear`
- `https://example.com/product/conflict`
- `https://example.com/product/unclear`

## Production mode

In production, `/api/analyze` calls Mino using `MINO_API_URL` and `MINO_API_KEY` and
returns only:

```
{ "verdict": "good|caution|risk|unclear", "flags": [], "explanations": [] }
```
