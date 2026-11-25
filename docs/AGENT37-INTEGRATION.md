# Connect Agent37 to MedMemory AI

MedMemory currently includes a floating **Agent37 assistant** shortcut. The basic connection opens your hosted Agent37 instance in a new tab. If Agent37 provides a dedicated embeddable URL for your instance, you can set `AGENT37_EMBED_URL` and the app will show it in a modal.

## 1. Find your Agent37 instance

1. Sign in to your Agent37 dashboard: https://www.agent37.com/dashboard
2. Open the personal agent you want to use with MedMemory.
3. Copy its instance ID and the full HTTPS instance URL shown in Agent37. A standard hosted instance URL often looks like `https://YOUR_INSTANCE_ID.agent37.app`; use the exact URL shown by your dashboard.

## 2. Add the variables to Vercel

1. Open Vercel → your MedMemory project → **Settings → Environment Variables**.
2. Add:

| Name | Value |
|---|---|
| `AGENT37_INSTANCE_ID` | Your Agent37 instance ID |
| `AGENT37_INSTANCE_URL` | Full HTTPS URL of that instance |
| `AGENT37_EMBED_URL` | Optional; only use a dedicated embed URL Agent37 provides and you have tested |

Choose Production (and Preview if you want to test there), save, then redeploy the latest deployment. Do not add a trailing slash unless the dashboard URL includes one.

## 3. Test it

Open MedMemory, sign in, and click the floating **Agent37 assistant** button near the lower-right corner. Without an embed URL, it opens your instance in another tab. With a dedicated embed URL, it opens an embedded panel.

## Important privacy and scope

This shortcut does **not** automatically share MedMemory profiles, medical reports, medications, or messages with Agent37. It also does not currently let Agent37 execute MedMemory actions. Treat it as an external agent workspace until a proper authenticated server-side API bridge is built and tested.

If you later use Agent37 Cloud's API to send chat requests from MedMemory, add the API key as a server-only Vercel environment variable (for example `AGENT37_API_KEY`) and implement a backend proxy that checks the signed-in Firebase user, limits the data sent, and logs/authorizes each requested action. Never use `NEXT_PUBLIC_` for an Agent37 secret and never put the key in `public/app.js`. Medical records should not be sent to an external agent without a clear consent and privacy design.

Agent37 product/API references:
- Personal agents: https://www.agent37.com/personal
- Agent37 Cloud API: https://www.agent37.com/cloud
- API docs: https://www.agent37.com/docs
