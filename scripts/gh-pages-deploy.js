/* eslint-disable no-console */
import { execa } from "execa";
import fs from "fs";
import path from "path";

const WORKTREE_DIR = ".gh-pages-worktree";
const REMOTE = "gh-pages";
const BRANCH = "main";

(async () => {
  try {
    console.log("Building started in production mode...");
    await execa("npm", ["run", "build"], {
      env: { ...process.env, NODE_ENV: "production" },
    });
    const folderName = fs.existsSync("dist") ? "dist" : "build";
    await execa("cp", [
      path.join(folderName, "index.html"),
      path.join(folderName, "404.html"),
    ]);

    // Set up (or reuse) a persistent worktree tracking the real gh-pages history,
    // so git has a common ancestor to diff/negotiate against instead of an
    // orphan branch every time.
    if (!fs.existsSync(WORKTREE_DIR)) {
      console.log("Setting up gh-pages worktree...");
      await execa("git", ["fetch", REMOTE, BRANCH]);
      try {
        await execa("git", [
          "worktree", "add", "-B", "gh-pages-local",
          WORKTREE_DIR, `${REMOTE}/${BRANCH}`,
        ]);
      } catch {
        // Remote branch doesn't exist yet -> start it fresh (first-ever deploy only)
        await execa("git", [
          "worktree", "add", "--orphan", "-b", "gh-pages-local", WORKTREE_DIR,
        ]);
      }
    } else {
      // Keep it in sync with remote (in case someone else deployed, or history diverged)
      await execa("git", ["fetch", REMOTE, BRANCH]);
      await execa("git", ["-C", WORKTREE_DIR, "reset", "--hard", `${REMOTE}/${BRANCH}`]);
    }

    // Sync build output into the worktree, deleting stale files but leaving
    // .git alone and preserving unchanged files untouched.
    await execa("rsync", [
      "-a", "--delete",
      "--exclude", ".git",
      `${folderName}/`, `${WORKTREE_DIR}/`,
    ]);

    await execa("git", ["-C", WORKTREE_DIR, "add", "-A"]);
    const { exitCode } = await execa(
      "git", ["-C", WORKTREE_DIR, "diff", "--cached", "--quiet"],
      { reject: false }
    );
    if (exitCode === 0) {
      console.log("No changes to deploy.");
      return;
    }

    await execa("git", ["-C", WORKTREE_DIR, "commit", "-m", "gh-pages"]);
    console.log("Pushing to gh-pages...");
    await execa("git", [
      "-C", WORKTREE_DIR, "push", REMOTE, `gh-pages-local:${BRANCH}`,
    ]);
    console.log("Successfully deployed, check your settings");
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
})();
