# Scripts

## generate-submissions.mjs

Generate fake submissions for testing your Inbounce forms.

**Endpoint**: `POST /api/submit` with `Authorization: Bearer <api_key>` header

### Usage

```bash
# Using Just (recommended)
just generate-submissions YOUR_API_KEY 20

# Using Node directly
node scripts/generate-submissions.mjs YOUR_API_KEY 20

# Custom endpoint (production)
node scripts/generate-submissions.mjs YOUR_API_KEY 50 https://api.inbounce.app/submit
```

### Features

- Smart fake data generation based on field names
- Automatic schema discovery
- Progress tracking
- Batch submissions with rate limiting

### Example Output

```
🚀 Fake Submission Generator
📍 Endpoint: http://inbounce.localhost:1355/api/submit
🔑 API Key: 4a7a32c8...
📊 Count: 20

✅ Progress: 20/20 (20 success, 0 failed)

✨ Done!
📊 Results: 20 successful, 0 failed
```
