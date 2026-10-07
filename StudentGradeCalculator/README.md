# JNTUK R23 SGPA & CGPA Calculator

A responsive academic calculator for JNTUK B.Tech R23 students. Manage semesters, subjects, credits, grades, backlogs, SGPA, weighted CGPA, percentage, and grade distribution from one browser-based workspace.

The first deployment is a static frontend. It needs no account, API server, database, or environment variables. Your profile and academic records are stored in the browser's `localStorage`.

## Technologies

- React 19 and JavaScript/JSX
- Vite 7 and React Router
- CSS with responsive mobile and desktop layouts
- Node.js test runner for calculation and persistence tests
- Netlify static hosting and GitHub-based continuous deployment

The existing app uses JavaScript/JSX and plain CSS rather than TypeScript and Tailwind. `vite.config.ts` is a TypeScript Vite configuration file; adding application-wide TypeScript or Tailwind is a separate optional learning step.

## Requirements

- Node.js 20.19 or newer (Node.js 22 LTS is recommended)
- npm, included with Node.js
- Git for the GitHub deployment workflow

Check installed versions:

```sh
node --version
npm --version
git --version
```

## Install and run locally

From the project directory:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`. The development command starts only the frontend; no `.env` file or backend process is required.

Run calculation and storage tests:

```sh
npm test
```

## Production build

Create the deployable static site:

```sh
npm run build
```

Vite writes the production website to `dist/`. Preview that exact output locally:

```sh
npm run preview
```

Open the preview URL printed by Vite, usually `http://127.0.0.1:4173`. `npm run preview` serves the built files; it is not a substitute for `npm run dev` while developing.

## Deploy to Netlify through GitHub

The repository includes `netlify.toml` with the build command and publish directory. Netlify's expected values are:

- Build command: `npm run build`
- Publish directory: `dist`
- Required environment variables: none

### 1. Create a GitHub repository

On GitHub, create a new empty repository. Do not add a second README or `.gitignore` if this project already has them; starting empty avoids an unrelated first-push merge conflict.

### 2. Push this project to GitHub

In a terminal opened at the project folder, check the working tree and commit the project:

```sh
git status
git add .
git commit -m "Prepare JNTUK calculator for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-NAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the repository URL with the URL GitHub shows for your repository. If a remote is already configured, inspect it with `git remote -v` rather than adding a second `origin`. GitHub receives the source files; it does not run the app for visitors.

### 3. Create a Netlify account

Create or sign in to a free Netlify account. Netlify is the static host that will build the React source and serve the generated `dist/` website.

### 4. Connect GitHub to Netlify

In Netlify, choose **Add new project** and then **Import an existing project**. Authorize Netlify to access GitHub when prompted. This grants Netlify permission to watch the repository for changes.

### 5. Select the repository

Choose the GitHub repository created in Step 1. Netlify reads the project files and prepares a build configuration.

### 6. Configure the build

Use these settings if Netlify does not fill them from `netlify.toml`:

```text
Build command:     npm run build
Publish directory: dist
```

No environment variables are needed. Netlify installs dependencies, runs the build command, and publishes the generated `dist/` directory. It does not need to run the optional Express prototype.

### 7. Deploy

Choose **Deploy**. Open the deploy log while it runs: it shows dependency installation, the Vite production build, and whether Netlify published `dist/`. A successful deploy receives a generated `*.netlify.app` URL.

### 8. Open the live website

Open the generated URL. Test the Home, Calculator, SGPA, CGPA, and Profile destinations. Also open `/calculator`, `/sgpa`, `/cgpa`, and `/profile` directly in a new tab and refresh them. `public/_redirects` sends application routes to `index.html` so React Router can render them instead of returning a host-level 404.

### 9. Make a code change

Edit the app locally and verify it first:

```sh
npm test
npm run build
```

For a browser check of the built files, run `npm run preview` and test the preview URL before pushing.

### 10. Push the update

Commit and push the change:

```sh
git add .
git commit -m "Update application"
git push
```

A commit pushed to the connected branch is the signal Netlify watches for. GitHub stores the change; Netlify starts a new build from that commit.

### 11. Verify automatic redeployment

Open the project's **Deploys** page in Netlify. Confirm a new deploy started for the commit you pushed, wait for it to finish successfully, then reload the live URL. The updated files are now served from the new `dist/` output. If the deploy fails, open its log and use the troubleshooting section below.

## Browser storage and privacy

The app saves the student profile and semester records in `localStorage` on the current browser origin. It restores them after a page refresh. Data is not synchronized to another browser, computer, or phone and is not backed up by Netlify. Clearing site data, using private browsing, or changing the site origin can make that browser's saved data unavailable. Export or back up important records before clearing browser storage.

The optional `VITE_API_BASE_URL` line in `.env.example` is only a placeholder for future API work and is not read by the current frontend. Do not put private API keys in variables prefixed with `VITE_`; Vite exposes those values to browser code. `.env` files are ignored by Git.

An Express/Clerk prototype remains under `server/` for future backend exploration. The current frontend does not call it, `npm run dev` does not start it, and the Netlify deployment does not include or require it.

## Troubleshooting

**`npm install` fails**: Confirm internet access and that the terminal is in the folder containing `package.json`. Check `node --version`; use Node 20.19+ or Node 22 LTS. If npm reports a registry or proxy error, fix that network configuration and retry. Avoid deleting `package-lock.json`; it keeps local and Netlify dependency versions consistent.

**Node version or engine error**: Install a supported Node.js LTS release, close and reopen the terminal, and check `node --version` again. Netlify is configured to use Node 22 in `netlify.toml`.

**Missing dependency / cannot resolve import**: Run `npm install` from the project root. If a dependency was added to source but not to `package.json`, add it with `npm install PACKAGE-NAME`, commit both `package.json` and `package-lock.json`, and push again.

**`npm run build` fails**: Read the first Vite error in the output; it usually identifies the missing module or source file. Run `npm install`, check import spelling and filename case, then run `npm test` and `npm run build` again. Netlify build logs show the same errors as a local production build.

**TypeScript or ESLint errors**: This project currently has JavaScript/JSX source and does not configure a TypeScript compiler or ESLint. A missing-import or JSX syntax error is still reported by the Vite build. If TypeScript or ESLint is added later, add explicit scripts and run them locally before deployment.

**404 after deployment or refresh**: Confirm `public/_redirects` is present in the repository and contains `/*    /index.html   200`. Confirm Netlify publishes `dist`, not the project root or `src`. Trigger a fresh deploy after committing the redirect file.

**Blank white page**: Open the browser developer console and Network panel. Look for a JavaScript exception or a failed asset request. Confirm the latest Netlify deploy succeeded and that its `dist/index.html` references built assets. The current frontend needs no environment variables; do not add Clerk keys to fix a frontend startup problem.

**React route works from Home but direct navigation fails**: The host must return `index.html` for unknown application paths. Check the Netlify redirect rule and test direct URLs such as `/calculator` after a successful redeploy.

**Assets fail or the app is hosted under a subdirectory**: Netlify's standard site URL hosts at `/`, which is the Vite default. If deploying under a project subpath on another host, configure Vite's `base` value for that exact path, rebuild, and verify asset URLs in the Network panel. Do not set a subpath base for a normal Netlify site URL.

**Missing environment variable warning**: The static frontend has no required environment variables. Copying `.env.example` is optional. The unused Express/Clerk prototype has separate server requirements and is not part of this Netlify deployment.

**`localStorage` data is missing**: Use the same browser and exact site origin where the data was entered. `localhost`, `127.0.0.1`, a Netlify preview URL, and the final Netlify URL have separate storage. Check that the browser permits site storage and is not in a restricted private session.

**Netlify deploy fails**: Open **Deploys**, select the failed deploy, and read the build log from the first error. Verify the connected branch, Node 22 setting, `npm run build` command, and `dist` publish directory. Reproduce locally with `npm install` and `npm run build` before pushing a fix.

**GitHub push fails**: Run `git status` and `git remote -v`. Confirm `origin` points to the correct repository and that GitHub authentication is configured. If the branch has an initial README commit that is absent locally, follow GitHub's merge instructions rather than force-pushing. Never commit `.env` or secret keys.

## Future backend architecture

The first version deliberately uses browser storage so it can be deployed and used for free as a static site. A future synchronization feature can replace the storage adapter with an API without making Netlify responsible for the database:

```text
React frontend
      ↓ REST API
Node.js / Express or Python / Flask
      ↓
PostgreSQL, MySQL, or MongoDB
```

A real backend would need its own hosting, database, authentication, validation, and secret management. Until that is implemented, browser-local records remain the source of truth.
