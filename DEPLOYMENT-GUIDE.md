# ClassFlow: GitHub + Vercel quick deploy

The project is already configured in Vercel as `class-flow-gpd`, but Vercel needs the source code in a Git repository before it can build and host the site.

## 1. Create a GitHub repository and upload the source

1. Download `ClassFlow-source.zip` and unzip it on your computer.
2. On GitHub, create a **new empty repository** named `class-flow-gpd` (private is fine). Do not add a README, license, or `.gitignore` during creation.
3. In the new repository, choose **Add file → Upload files**. Drag the **contents** of the extracted project folder into the upload area (do not upload the ZIP itself). Commit the upload to the `main` branch.
4. Do not upload or share `.env.local`, passwords, a Supabase service-role key, or other provider secrets. `.env.local` is intentionally not in this archive.

## 2. Connect the repo to the existing Vercel project

1. Open Vercel and select the existing project `class-flow-gpd`.
2. Go to **Settings → Git → Connect Git Repository**, select the repository, and confirm the production branch is `main`.
3. In **Settings → Environment Variables**, add these two browser-safe variables for **Production**, **Preview**, and **Development**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Save, then redeploy. The project already has Vite build settings (`npm run build`, output `dist`) and SPA rewrites configured.

Once the repository is connected, future commits to `main` deploy automatically. The publishable/anon key is intended for browser use; never add the Supabase service-role key or AI provider secrets as `VITE_` variables.

## 3. Finish Supabase redirect setup

After Vercel gives the site a production URL, add that exact URL to Supabase **Authentication → URL Configuration** as the Site URL and an allowed redirect URL. Then verify login and account workflows on the live site.
