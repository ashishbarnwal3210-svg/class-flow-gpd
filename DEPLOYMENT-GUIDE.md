# ClassFlow production and updates

- Live app: https://class-flow-gpd.vercel.app
- GitHub: https://github.com/ashishbarnwal3210-svg/class-flow-gpd (`main`)
- Vercel project `class-flow-gpd` is connected to the GitHub repository. Commits pushed to `main` trigger a Vercel deployment automatically.
- Vercel already has the browser-safe Supabase URL and publishable key; Supabase Auth's production Site URL and redirect allow-list are configured.

## Updating the site

Make requested UI/code changes in the authorized coding session or a local checkout, test them, then commit and push to `main`. Vercel builds and deploys that commit. Never commit `.env.local`, Supabase service-role keys, AI provider secrets, or GitHub tokens. The repository is currently public; it contains source and placeholder-only `.env.example` values.

## Integrations not yet enabled

LiveKit audio/video calling and document indexing remain unconfigured. They require their own providers and server-side secrets; they are not needed for the core site.
