/**
 * The Google Apps Script the user pastes into script.google.com. It runs in
 * their own Google account every 10 minutes and posts new Gmail messages to
 * /api/email/sync with their sync key. Nothing else (no Google Cloud project,
 * no OAuth app) is needed.
 */
export function gmailAppsScript({ origin, key }: { origin: string; key: string }): string {
  return `// InternTrack email sync: marks applications Rejected when a rejection email arrives.
// Setup: choose "setup" in the toolbar's function menu, click Run, and allow access.
// It then runs by itself every 10 minutes. To stop it, delete this project.

const ENDPOINT = ${JSON.stringify(`${origin}/api/email/sync`)};
const SYNC_KEY = ${JSON.stringify(key)}; // Keep this private: it can update your tracker.

const FIRST_RUN_DAYS = 30;
const OVERLAP_MINUTES = 15;
const BATCH_SIZE = 25;
const MAX_BODY_CHARS = 20000;
const TIME_BUDGET_MS = 4 * 60 * 1000;

function setup() {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === "syncInbox") ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger("syncInbox").timeBased().everyMinutes(10).create();
  syncInbox();
}

function syncInbox() {
  const props = PropertiesService.getScriptProperties();
  const startedAt = Date.now();
  const last = Number(props.getProperty("lastSync")) || 0;
  const since = last
    ? last - OVERLAP_MINUTES * 60 * 1000
    : startedAt - FIRST_RUN_DAYS * 24 * 60 * 60 * 1000;
  const days = Math.ceil((startedAt - since) / (24 * 60 * 60 * 1000)) + 1;

  const mine = [Session.getActiveUser().getEmail()]
    .concat(GmailApp.getAliases())
    .map((address) => address.toLowerCase());

  const messages = [];
  const query = "newer_than:" + days + "d -in:sent -in:drafts -in:chats";
  for (let start = 0; ; start += 100) {
    const threads = GmailApp.search(query, start, 100);
    for (const thread of threads) {
      for (const message of thread.getMessages()) {
        if (message.getDate().getTime() < since || message.isDraft()) continue;
        const from = message.getFrom();
        if (mine.some((address) => address && from.toLowerCase().includes(address))) continue;
        messages.push({
          id: message.getId(),
          from: from.slice(0, 500),
          subject: message.getSubject(),
          body: message.getPlainBody().slice(0, MAX_BODY_CHARS),
          receivedAt: message.getDate().toISOString(),
        });
      }
    }
    if (threads.length < 100) break;
  }

  // Oldest first, so a run cut short can save how far it got.
  messages.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  // Always send at least once: each call also checks any connected Outlook mailboxes.
  for (let i = 0; i === 0 || i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    send(batch);
    const more = i + BATCH_SIZE < messages.length;
    if (more && Date.now() - startedAt > TIME_BUDGET_MS) {
      // Apps Script stops runs after 6 minutes. Save progress; the next run continues.
      const sentUpTo = Date.parse(batch[batch.length - 1].receivedAt);
      props.setProperty("lastSync", String(sentUpTo + OVERLAP_MINUTES * 60 * 1000));
      return;
    }
  }
  props.setProperty("lastSync", String(startedAt));
}

function send(batch) {
  const response = UrlFetchApp.fetch(ENDPOINT, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + SYNC_KEY },
    payload: JSON.stringify({ messages: batch }),
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code !== 200) {
    // Failing here keeps lastSync unchanged, so these emails are sent again next run.
    throw new Error("InternTrack sync failed (" + code + "): " + response.getContentText().slice(0, 300));
  }
}
`;
}
