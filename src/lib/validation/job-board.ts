import { z } from "zod";

import { optionalUrl, requiredText } from "./common";

export const jobBoardSchema = z.object({
  name: requiredText(60, "Name"),
  url: optionalUrl.pipe(z.string("Link is required")),
});
