import { describe, expect, it } from "vitest";

import { isRejection, stripQuotedText } from "@/lib/email/rejection";

const email = (subject: string, body: string) => ({ subject, body });

describe("isRejection: real-world rejections", () => {
  it.each([
    [
      "Your application to Stripe",
      "Hi Ishaan,\n\nThank you for your interest in Stripe. After careful consideration, we have decided not to move forward with your application at this time.\n\nBest,\nStripe Recruiting",
    ],
    [
      "Update on your application",
      "Thanks for applying to the Software Engineering Intern role. Unfortunately, we will not be moving forward with your candidacy.",
    ],
    [
      "Shopify application update",
      "We’ve decided to move forward with other candidates whose experience more closely matches our needs.",
    ],
    [
      "Your application",
      "We regret to inform you that you have not been selected for the Summer 2027 internship.",
    ],
    ["Re: Internship", "Unfortunately the position has been filled. We wish you the best of luck."],
    [
      "Thank you for applying",
      "Unfortunately, your application was unsuccessful on this occasion.",
    ],
    [
      "Application status",
      "We are unable to offer you a position at this time, but encourage you to apply again.",
    ],
    [
      "Following up",
      "After reviewing your application, we have decided to pursue other candidates for this role.",
    ],
    ["Your candidacy", "We won't be proceeding with your application. Thank you for your time."],
    [
      "Interview outcome",
      "Thank you for interviewing with us. You will not be moving on to the next round.",
    ],
    ["Your application", "Your application is no longer under consideration for this role."],
    [
      "Re: your application",
      "Unfortunately, after careful consideration, we have decided to go in a different direction. We will keep your resume on file and wish you the best in your job search. Thank you for your interest in Acme.",
    ],
  ])("%s", (subject, body) => {
    expect(isRejection(email(subject, body))).toBe(true);
  });
});

describe("isRejection: not rejections", () => {
  it.each([
    [
      "Application received",
      "Thank you for applying to Stripe! We have received your application and will review it soon.",
    ],
    [
      "Interview invitation",
      "We'd like to move forward with your application and schedule an interview with the team.",
    ],
    [
      "Offer",
      "Congratulations! We are pleased to offer you the Software Engineering Intern position.",
    ],
    [
      "Complete your application",
      "If you are unable to proceed with your application, please contact our support team.",
    ],
    [
      "Reminder",
      "If you do not complete the assessment, we will not be able to move forward with your application.",
    ],
    ["Next steps", "Great news! We are excited to invite you to the online assessment."],
    [
      "Job alert: 25 new internships",
      "New internships matching your search: Software Engineer Intern at Ramp, Notion and Figma.",
    ],
    ["Lunch?", "Unfortunately I can't make it on Friday. Want to move it to Monday?"],
    [
      "Event cancelled",
      "Unfortunately, we regret to inform you that the info session is cancelled.",
    ],
    [
      "Mixed news",
      "Unfortunately you were not selected for the Backend role, but congratulations: we'd like to interview you for Frontend.",
    ],
  ])("%s", (subject, body) => {
    expect(isRejection(email(subject, body))).toBe(false);
  });
});

describe("stripQuotedText", () => {
  it("ignores a rejection that is only quoted in a reply", () => {
    const body =
      "Thanks for letting me know, I appreciate it!\n\nOn Mon, Oct 12, 2026 at 9:00 AM Stripe <no-reply@stripe.com> wrote:\n> We will not be moving forward with your application.";
    expect(stripQuotedText(body)).not.toMatch(/moving forward/);
    expect(isRejection(email("Re: Your application to Stripe", body))).toBe(false);
  });

  it("drops lines quoted with >", () => {
    expect(stripQuotedText("Hello\n> we will not be moving forward with you\nBye")).toBe(
      "Hello\nBye",
    );
  });
});
