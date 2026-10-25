# Share screenshots from the iPhone to Daybook

An iPhone web app can't appear in the share sheet, so a Shortcut does it: it sends each shared
screenshot to `/api/import`, which reads it and adds the lines as waiting lines. The next time you open
Daybook, home says "From your phone: read 2 screenshots" and the lines are waiting to be checked.

## Before you start (once)

1. Make a long random token, for example on a computer: `openssl rand -hex 32`.
2. In Vercel, open the project → Settings → Environment Variables, add `IMPORT_TOKEN` with that value
   for Production (and Preview if you want to try it there), and redeploy. Without `IMPORT_TOKEN` the
   route is off and answers "Sharing to Daybook is off."
3. Keep the token handy for step 6 below. Anyone with it can add waiting lines, so don't share it.

The Shortcut needs an address the phone can reach without logging in: the production address (for
example `https://<your-app>.vercel.app`). Preview deploys usually sit behind Vercel's login, so a
Shortcut pointed at one gets the login page instead of an answer.

## Build the Shortcut

1. Open **Shortcuts** and tap **+** to make a new shortcut. Name it **Add to Daybook**.
2. Tap the **ⓘ** (Details) button and turn on **Show in Share Sheet**. Back in the editor, the first
   line now says **Receive _Any_ input from _Share Sheet_**: tap _Any_ and leave only **Images**.
   Set "If there's no input" to **Stop and Respond**.
3. Add the action **Repeat with Each** and set it to repeat with each item in **Shortcut Input**.
4. Inside the repeat, add **Get Contents of URL** and set:
   - URL: `https://<your-app>.vercel.app/api/import`
   - Method: **POST**
   - Headers: add one, key `Authorization`, text `Bearer <your token>` (the word Bearer, a space, then
     the token)
   - Request Body: **File**, and choose **Repeat Item** as the file
5. After **End Repeat**, add **Show Result** and choose **Repeat Results**.
6. Tap **Done**.

## Use it

In Photos (or right after taking a screenshot), tap **Share** → **Add to Daybook**. Several screenshots
at once are fine: each is read in turn. The Shortcut shows one answer per screenshot:

| Answer | What it means |
|---|---|
| Read 4 transactions. They're waiting in Daybook. | Done. Open Daybook to check them. |
| Nothing found. | The screenshot has no transactions. It needs to show the list of spending. |
| Couldn't read this one. | It may be blurry or cut off. Retake it, or add it in the app. |
| Couldn't read this one. Share a screenshot (PNG or JPEG). | A photo from the camera (HEIC) was shared. Share a screenshot instead, or add a **Convert Image** to JPEG action before Get Contents of URL. |
| Couldn't read this one. It's too big. | Over about 5 MB. Crop it and share again. |
| Couldn't save them. Try again in a moment. | It was read but the database didn't answer. Share it again. |
| Not allowed. Check the token in the Shortcut. | The `Authorization` header is missing or the token is wrong. |
| Sharing to Daybook is off. | `IMPORT_TOKEN` isn't set in Vercel (or the deploy predates it). |

Sharing the same screenshot twice adds its lines twice; home marks the second copy as a repeat only
once the first has been accepted, so throw the extra lines away while checking.
