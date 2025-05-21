# GateKeeper Bot 🤖🔐

**GateKeeper Bot** is a Reddit moderation bot designed to help subreddits filter user activity based on account age and karma. This bot acts as the first line of defense against spam, bots, and low-effort accounts, giving subreddit moderators more control and peace of mind.

---

## 🚀 Features

- ✅ Automatically filter posts/comments from users with accounts younger than a specified age.
- ✅ Automatically filter users below a minimum karma threshold (combined or separate for post/comment karma).
- ✅ Post removal with optional flair or mod comment.
- ✅ Configurable per-subreddit settings.

---

## ⚙️ How It Works

The bot monitors new posts and/or comments in the specified subreddits.

When a user submits content, the bot checks:

- The age of the user's Reddit account.

- The user’s combined karma.

- If the user does not meet the configured criteria, their post/comment is removed with custom message.

---
